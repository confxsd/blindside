// POST /api/invites — Create a new invite
// GET  /api/invites — List invites for current user

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');

  let body = {};
  try { body = await context.request.json(); } catch {}

  const {
    referrerName,
    referrerEmail,
    friendName,
    friendContact,
    vouchText,
    relation,
  } = body;

  if (!referrerName) return json({ error: 'referrer_name_required' }, 400);

  const code = generateCode();

  await db.prepare(
    `INSERT INTO invites (code, referrer_id, referrer_name, referrer_email, friend_name, friend_contact, vouch_text, relation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(code, userId || null, referrerName, referrerEmail || null, friendName || null, friendContact || null, vouchText || null, relation || null).run();

  const inviteUrl = new URL(context.request.url).origin + '/onboarding.html?ref=' + code + '&by=' + encodeURIComponent(referrerName);

  return json({ code, inviteUrl });
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');

  if (!userId) return json({ error: 'auth_required' }, 401);

  const result = await db.prepare(
    `SELECT code, referrer_name, friend_name, friend_contact, status, joined_by_name, created_at, joined_at
     FROM invites WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 20`
  ).bind(userId).all();

  return json({ invites: result.results });
}
