// GET /api/questions?pack=couples&lang=en — returns questions for a pack+lang
export async function onRequestGet(context) {
  const db = context.env.DB;
  const url = new URL(context.request.url);
  const pack = url.searchParams.get('pack');
  const lang = url.searchParams.get('lang') || 'en';

  if (!pack) {
    return new Response(JSON.stringify({ error: 'pack parameter required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Try requested language, fall back to English
  let res = await db.prepare(
    'SELECT q, options, pi, format, traits FROM questions WHERE pack_key = ? AND lang = ? ORDER BY sort_order'
  ).bind(pack, lang).all();

  if (res.results.length === 0 && lang !== 'en') {
    res = await db.prepare(
      'SELECT q, options, pi, format, traits FROM questions WHERE pack_key = ? AND lang = ? ORDER BY sort_order'
    ).bind(pack, 'en').all();
  }

  const questions = res.results.map(r => {
    const q = { q: r.q, options: JSON.parse(r.options) };
    if (r.pi != null) q.pi = r.pi;
    if (r.format) q.format = r.format;
    if (r.traits) q.traits = JSON.parse(r.traits);
    return q;
  });

  return new Response(JSON.stringify(questions), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
}
