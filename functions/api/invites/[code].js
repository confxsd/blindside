// GET /api/invites/:code — Get invite details (public, for onboarding page)
// PUT /api/invites/:code — Mark invite as joined

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  const code = context.params.code;

  const invite = await db.prepare(
    `SELECT code, referrer_name, friend_name, vouch_text, status, created_at
     FROM invites WHERE code = ?`
  ).bind(code).first();

  if (!invite) return json({ error: 'invite_not_found' }, 404);

  return json({ invite });
}

export async function onRequestPut(context) {
  const db = context.env.DB;
  const code = context.params.code;
  const userId = context.request.headers.get('X-User-Id');

  let body = {};
  try { body = await context.request.json(); } catch {}

  const invite = await db.prepare('SELECT * FROM invites WHERE code = ?').bind(code).first();
  if (!invite) return json({ error: 'invite_not_found' }, 404);
  if (invite.status === 'joined') return json({ error: 'already_used' }, 400);

  await db.prepare(
    `UPDATE invites SET status = 'joined', joined_by_id = ?, joined_by_name = ?, joined_at = datetime('now')
     WHERE code = ?`
  ).bind(userId || null, body.joinedByName || null, code).run();

  return json({ ok: true });
}
