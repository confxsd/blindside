// GET /api/packs — returns pack metadata, categories, and collections
export async function onRequestGet(context) {
  const db = context.env.DB;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' };

  const [packsRes, catsRes, collsRes, cpRes] = await Promise.all([
    db.prepare('SELECT * FROM packs ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM categories ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM collections ORDER BY sort_order').all(),
    db.prepare('SELECT * FROM collection_packs ORDER BY collection_key, sort_order').all(),
  ]);

  // Map DB rows back to the shape the frontend expects
  const packDefs = packsRes.results.map(r => {
    const p = {
      key: r.key, emoji: r.emoji, nameKey: r.name_key,
      countKey: r.count_key, cat: r.cat, plays: r.plays,
    };
    if (r.desc_key) p.descKey = r.desc_key;
    if (r.badge) p.badge = r.badge;
    if (r.featured) { p.featured = true; p.featuredBadge = r.featured_badge; }
    if (r.solo) p.solo = true;
    if (r.wide) p.wide = true;
    return p;
  });

  const packCategories = catsRes.results.map(r => ({
    key: r.key, labelKey: r.label_key, icon: r.icon,
  }));

  // Group collection_packs by collection key
  const cpMap = {};
  for (const cp of cpRes.results) {
    (cpMap[cp.collection_key] ||= []).push(cp.pack_key);
  }

  const packCollections = collsRes.results.map(r => {
    const c = {
      key: r.key, emoji: r.emoji, gradient: JSON.parse(r.gradient),
      nameKey: r.name_key, descKey: r.desc_key,
      packs: cpMap[r.key] || [], mode: r.mode,
    };
    if (r.badge) c.badge = r.badge;
    return c;
  });

  return new Response(JSON.stringify({ packDefs, packCategories, packCollections }), { headers });
}
