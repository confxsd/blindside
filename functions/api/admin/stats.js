// GET /api/admin/stats — returns D1 content stats for admin panel
export async function onRequestGet(context) {
  const db = context.env.DB;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };

  const [packsRes, catsRes, collsRes, questionsRes, langRes, topPacksRes] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM packs').first(),
    db.prepare('SELECT COUNT(*) as count FROM categories').first(),
    db.prepare('SELECT COUNT(*) as count FROM collections').first(),
    db.prepare('SELECT COUNT(*) as count FROM questions').first(),
    db.prepare('SELECT lang, COUNT(*) as count FROM questions GROUP BY lang ORDER BY count DESC').all(),
    db.prepare(`
      SELECT key, emoji, name_key, cat, plays, badge, solo,
        (SELECT COUNT(*) FROM questions WHERE pack_key = packs.key AND lang = 'en') as question_count
      FROM packs ORDER BY CAST(plays AS INTEGER) DESC LIMIT 15
    `).all(),
  ]);

  const soloRes = await db.prepare('SELECT COUNT(*) as count FROM packs WHERE solo = 1').first();
  const featuredRes = await db.prepare('SELECT COUNT(*) as count FROM packs WHERE featured = 1').first();
  const catBreakdown = await db.prepare(`
    SELECT cat, COUNT(*) as count FROM packs GROUP BY cat ORDER BY count DESC
  `).all();

  return new Response(JSON.stringify({
    totals: {
      packs: packsRes.count,
      categories: catsRes.count,
      collections: collsRes.count,
      questions: questionsRes.count,
      soloPacks: soloRes.count,
      featuredPacks: featuredRes.count,
    },
    languages: langRes.results,
    topPacks: topPacksRes.results,
    categoryBreakdown: catBreakdown.results,
  }), { headers });
}
