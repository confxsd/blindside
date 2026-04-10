// POST /api/profiles — Create or update a Mira profile
// GET  /api/profiles — Get current user's profile

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

  let body = {};
  try { body = await context.request.json(); } catch {}

  const {
    username, name, email, age, gender, neighborhood,
    traits, weekend, values, ageMin, ageMax,
    idealPerson, dealbreaker, phone,
    referredBy, referrerName,
  } = body;

  // Upsert profile
  const existing = await db.prepare('SELECT id FROM mira_profiles WHERE user_id = ?').bind(userId).first();

  if (existing) {
    await db.prepare(
      `UPDATE mira_profiles SET
        username = ?, name = ?, email = ?, age = ?, gender = ?, neighborhood = ?,
        traits = ?, weekend = ?, values_list = ?, age_min = ?, age_max = ?,
        ideal_person = ?, dealbreaker = ?, phone = ?,
        referred_by = COALESCE(referred_by, ?), referrer_name = COALESCE(referrer_name, ?),
        updated_at = datetime('now')
      WHERE user_id = ?`
    ).bind(
      username || null, name || null, email || null, age || null, gender || null, neighborhood || null,
      JSON.stringify(traits || []), JSON.stringify(weekend || []), JSON.stringify(values || []),
      ageMin || null, ageMax || null,
      idealPerson || null, dealbreaker || null, phone || null,
      referredBy || null, referrerName || null,
      userId
    ).run();
  } else {
    await db.prepare(
      `INSERT INTO mira_profiles (user_id, username, name, email, age, gender, neighborhood,
        traits, weekend, values_list, age_min, age_max, ideal_person, dealbreaker, phone,
        referred_by, referrer_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId, username || null, name || null, email || null, age || null, gender || null, neighborhood || null,
      JSON.stringify(traits || []), JSON.stringify(weekend || []), JSON.stringify(values || []),
      ageMin || null, ageMax || null,
      idealPerson || null, dealbreaker || null, phone || null,
      referredBy || null, referrerName || null
    ).run();
  }

  return json({ ok: true });
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  const userId = context.request.headers.get('X-User-Id');
  if (!userId) return json({ error: 'auth_required' }, 401);

  const profile = await db.prepare(
    'SELECT * FROM mira_profiles WHERE user_id = ?'
  ).bind(userId).first();

  if (!profile) return json({ profile: null });

  // Parse JSON fields
  profile.traits = JSON.parse(profile.traits || '[]');
  profile.weekend = JSON.parse(profile.weekend || '[]');
  profile.values_list = JSON.parse(profile.values_list || '[]');

  return json({ profile });
}
