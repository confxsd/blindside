// POST /api/strangers/queue — Enter matching queue (or get instant match)
// GET  /api/strangers/queue — Poll queue status
// DELETE /api/strangers/queue — Leave queue

const API_URL = 'https://api.rome.markets';
const STRANGER_PACKS = ['hottakes', 'chaotic', 'ethics', 'situations', 'worldtaste', 'cinemadebates'];

function randomPack() {
  return STRANGER_PACKS[Math.floor(Math.random() * STRANGER_PACKS.length)];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');
  const username = context.request.headers.get('X-Username');
  if (!userId || !username) return json({ error: 'auth_required' }, 401);

  let body = {};
  try { body = await context.request.json(); } catch {}
  const lang = body.lang || 'en';

  // Use batch for ALL reads+writes to ensure primary consistency.
  // D1 read replicas can serve stale data — batch forces primary.
  const [rateRes, , activeMatchRes] = await db.batch([
    db.prepare(
      `SELECT COUNT(*) as cnt FROM match_queue WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`
    ).bind(userId),
    // Step 1: Clean up stale entries for this user
    db.prepare(
      `UPDATE match_queue SET status = 'cancelled' WHERE user_id = ? AND status IN ('waiting', 'matched')`
    ).bind(userId),
    // Step 2: Check active match
    db.prepare(
      `SELECT * FROM stranger_matches WHERE (user_a_id = ? OR user_b_id = ?) AND state IN ('playing', 'voting') ORDER BY created_at DESC LIMIT 1`
    ).bind(userId, userId),
  ]);

  // Rate limit
  if (rateRes.results[0]?.cnt >= 20) return json({ error: 'rate_limited', retry_after: 300 }, 429);

  // Already in an active match
  if (activeMatchRes.results.length > 0) {
    const m = activeMatchRes.results[0];
    return json({
      matched: true,
      session_code: m.session_code,
      partner: m.user_a_id === userId ? m.user_b_username : m.user_a_username,
      pack_key: m.pack_key,
    });
  }

  // Step 3: Try to claim a waiting user (atomic, runs on primary)
  const claimToken = crypto.randomUUID();
  const claimed = await db.prepare(
    `UPDATE match_queue
     SET status = 'matched', claim_token = ?, matched_with = ?
     WHERE id = (
       SELECT mq.id FROM match_queue mq
       WHERE mq.status = 'waiting'
         AND mq.user_id != ?
         AND mq.expires_at > datetime('now')
         AND NOT EXISTS (
           SELECT 1 FROM stranger_matches sm
           WHERE (sm.user_a_id = mq.user_id OR sm.user_b_id = mq.user_id)
             AND sm.state IN ('playing', 'voting')
         )
       ORDER BY mq.created_at ASC LIMIT 1
     ) AND status = 'waiting'`
  ).bind(claimToken, userId, userId).run();

  if (claimed.meta.changes > 0) {
    const partner = await db.prepare(
      `SELECT * FROM match_queue WHERE claim_token = ?`
    ).bind(claimToken).first();

    if (!partner) return json({ error: 'match_failed' }, 500);

    const packKey = randomPack();

    // Create session via Rome API
    let session;
    try {
      const createRes = await fetch(`${API_URL}/api/blind/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': partner.user_id },
        body: JSON.stringify({ pack_key: packKey, lang }),
      });
      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error);
      session = createData.session;

      const joinRes = await fetch(`${API_URL}/api/blind/sessions/${session.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      });
      const joinData = await joinRes.json();
      if (joinData.error) throw new Error(joinData.error);
    } catch (e) {
      // Rollback: set partner back to waiting
      await db.prepare(
        `UPDATE match_queue SET status = 'waiting', claim_token = NULL, matched_with = NULL WHERE claim_token = ?`
      ).bind(claimToken).run();
      return json({ error: 'session_creation_failed' }, 500);
    }

    // Batch: update queue entry + create stranger match (both on primary)
    await db.batch([
      db.prepare(`UPDATE match_queue SET session_code = ? WHERE claim_token = ?`).bind(session.code, claimToken),
      db.prepare(
        `INSERT INTO stranger_matches (session_code, user_a_id, user_b_id, user_a_username, user_b_username, pack_key)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(session.code, partner.user_id, userId, partner.username, username, packKey),
    ]);

    return json({
      matched: true,
      session_code: session.code,
      partner: partner.username,
      pack_key: packKey,
    });
  }

  // Step 4: No one to match with — enter the queue
  await db.prepare(
    `INSERT INTO match_queue (user_id, username, lang) VALUES (?, ?, ?)`
  ).bind(userId, username, lang).run();

  const entry = await db.prepare(
    `SELECT id FROM match_queue WHERE user_id = ? AND status = 'waiting'`
  ).bind(userId).first();

  return json({ queued: true, queue_id: entry?.id });
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');
  if (!userId) return json({ error: 'auth_required' }, 401);

  // CRITICAL: Use batch to force ALL reads to hit the primary.
  // Without this, D1 read replicas in other regions serve stale data
  // and the polled user never sees their match.
  const [activeMatchRes, waitingRes, matchedRes] = await db.batch([
    db.prepare(
      `SELECT * FROM stranger_matches WHERE (user_a_id = ? OR user_b_id = ?) AND state IN ('playing', 'voting') ORDER BY created_at DESC LIMIT 1`
    ).bind(userId, userId),
    db.prepare(
      `SELECT * FROM match_queue WHERE user_id = ? AND status = 'waiting' LIMIT 1`
    ).bind(userId),
    db.prepare(
      `SELECT * FROM match_queue WHERE user_id = ? AND status = 'matched' ORDER BY created_at DESC LIMIT 1`
    ).bind(userId),
  ]);

  // Check active stranger match (source of truth)
  if (activeMatchRes.results.length > 0) {
    const m = activeMatchRes.results[0];
    const partner = m.user_a_id === userId ? m.user_b_username : m.user_a_username;
    return json({
      status: 'matched',
      session_code: m.session_code,
      partner,
      pack_key: m.pack_key,
    });
  }

  // Check waiting queue entry
  if (waitingRes.results.length > 0) {
    const w = waitingRes.results[0];
    if (new Date(w.expires_at + 'Z') < new Date()) {
      await db.prepare(`UPDATE match_queue SET status = 'expired' WHERE id = ?`).bind(w.id).run();
      return json({ status: 'expired' });
    }
    return json({ status: 'waiting' });
  }

  // Queue entry is matched but stranger_match not created yet (brief race window)
  if (matchedRes.results.length > 0) {
    return json({ status: 'waiting' });
  }

  return json({ status: 'none' });
}

export async function onRequestDelete(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');
  if (!userId) return json({ error: 'auth_required' }, 401);

  await db.prepare(
    `UPDATE match_queue SET status = 'cancelled' WHERE user_id = ? AND status = 'waiting'`
  ).bind(userId).run();

  return json({ ok: true });
}
