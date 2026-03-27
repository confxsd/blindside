// POST /api/strangers/vote — Submit chat vote after reveal
// GET  /api/strangers/vote — Poll vote status

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');
  if (!userId) return json({ error: 'auth_required' }, 401);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'invalid_body' }, 400); }

  const { session_code, vote } = body;
  if (!session_code || !['yes', 'no'].includes(vote)) {
    return json({ error: 'invalid_params' }, 400);
  }

  // Batch read to force primary (avoids stale replica reads)
  const [matchRes] = await db.batch([
    db.prepare(`SELECT * FROM stranger_matches WHERE session_code = ?`).bind(session_code),
  ]);

  const match = matchRes.results[0];
  if (!match) return json({ error: 'match_not_found' }, 404);

  const isUserA = match.user_a_id === userId;
  const isUserB = match.user_b_id === userId;
  if (!isUserA && !isUserB) return json({ error: 'not_in_match' }, 403);

  const voteCol = isUserA ? 'user_a_vote' : 'user_b_vote';

  if (match.state === 'playing' || match.state === 'voting') {
    // Set vote + transition to voting state, set deadline if first vote
    await db.prepare(
      `UPDATE stranger_matches SET ${voteCol} = ?, state = 'voting',
       vote_deadline = COALESCE(vote_deadline, datetime('now', '+60 seconds'))
       WHERE session_code = ?`
    ).bind(vote, session_code).run();

    // Re-read from primary via batch
    const [updatedRes] = await db.batch([
      db.prepare(`SELECT * FROM stranger_matches WHERE session_code = ?`).bind(session_code),
    ]);
    const updated = updatedRes.results[0];

    const myVote = isUserA ? updated.user_a_vote : updated.user_b_vote;
    const theirVote = isUserA ? updated.user_b_vote : updated.user_a_vote;

    if (myVote && theirVote) {
      const mutual = myVote === 'yes' && theirVote === 'yes';
      const result = mutual ? 'match' : 'pass';
      await db.prepare(
        `UPDATE stranger_matches SET state = 'resolved', result = ? WHERE session_code = ?`
      ).bind(result, session_code).run();
      return json({ voted: true, resolved: true, mutual });
    }

    return json({ voted: true, waiting_for_partner: true });
  }

  if (match.state === 'resolved') {
    const myVote = isUserA ? match.user_a_vote : match.user_b_vote;
    const theirVote = isUserA ? match.user_b_vote : match.user_a_vote;
    const mutual = myVote === 'yes' && theirVote === 'yes';
    return json({ voted: true, resolved: true, mutual });
  }

  return json({ error: 'invalid_state' }, 400);
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');
  if (!userId) return json({ error: 'auth_required' }, 401);

  const url = new URL(context.request.url);
  const sessionCode = url.searchParams.get('session_code');
  if (!sessionCode) return json({ error: 'missing_session_code' }, 400);

  // Batch to force primary read
  const [matchRes] = await db.batch([
    db.prepare(`SELECT * FROM stranger_matches WHERE session_code = ?`).bind(sessionCode),
  ]);

  const match = matchRes.results[0];
  if (!match) return json({ error: 'match_not_found' }, 404);

  const isUserA = match.user_a_id === userId;
  const isUserB = match.user_b_id === userId;
  if (!isUserA && !isUserB) return json({ error: 'not_in_match' }, 403);

  const myVote = isUserA ? match.user_a_vote : match.user_b_vote;
  const theirVote = isUserA ? match.user_b_vote : match.user_a_vote;

  if (match.state === 'resolved') {
    return json({ status: 'resolved', mutual: match.result === 'match', your_vote: myVote });
  }

  if (match.state === 'voting') {
    // Check deadline
    if (match.vote_deadline && new Date(match.vote_deadline + 'Z') < new Date()) {
      const result = (myVote === 'yes' && theirVote === 'yes') ? 'match' : 'pass';
      await db.prepare(
        `UPDATE stranger_matches SET state = 'resolved', result = ? WHERE session_code = ?`
      ).bind(result, sessionCode).run();
      return json({ status: 'resolved', mutual: result === 'match', your_vote: myVote });
    }

    if (myVote && theirVote) {
      const mutual = myVote === 'yes' && theirVote === 'yes';
      await db.prepare(
        `UPDATE stranger_matches SET state = 'resolved', result = ? WHERE session_code = ?`
      ).bind(mutual ? 'match' : 'pass', sessionCode).run();
      return json({ status: 'resolved', mutual, your_vote: myVote });
    }

    return json({ status: 'waiting', your_vote: myVote });
  }

  return json({ status: 'playing' });
}
