// Reads data/ JSON files and generates seed.sql for D1
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const meta = JSON.parse(fs.readFileSync(path.join(dataDir, 'packs.json'), 'utf8'));

const esc = (s) => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
const lines = [];

// Clear existing data (order matters for FK-like constraints)
lines.push('DELETE FROM questions;');
lines.push('DELETE FROM collection_packs;');
lines.push('DELETE FROM collections;');
lines.push('DELETE FROM categories;');
lines.push('DELETE FROM packs;');

// --- Packs ---
meta.packDefs.forEach((p, i) => {
  lines.push(`INSERT INTO packs (key, emoji, name_key, count_key, desc_key, cat, badge, plays, featured, featured_badge, solo, wide, sort_order) VALUES (${esc(p.key)}, ${esc(p.emoji)}, ${esc(p.nameKey)}, ${esc(p.countKey)}, ${esc(p.descKey || null)}, ${esc(p.cat)}, ${esc(p.badge || null)}, ${esc(p.plays || '0')}, ${p.featured ? 1 : 0}, ${esc(p.featuredBadge || null)}, ${p.solo ? 1 : 0}, ${p.wide ? 1 : 0}, ${i});`);
});

// --- Categories ---
meta.packCategories.forEach((c, i) => {
  lines.push(`INSERT INTO categories (key, label_key, icon, sort_order) VALUES (${esc(c.key)}, ${esc(c.labelKey)}, ${esc(c.icon)}, ${i});`);
});

// --- Collections ---
meta.packCollections.forEach((c, i) => {
  const grad = JSON.stringify(c.gradient);
  lines.push(`INSERT INTO collections (key, emoji, gradient, name_key, desc_key, mode, badge, sort_order) VALUES (${esc(c.key)}, ${esc(c.emoji)}, ${esc(grad)}, ${esc(c.nameKey)}, ${esc(c.descKey)}, ${esc(c.mode)}, ${esc(c.badge || null)}, ${i});`);
  c.packs.forEach((pk, j) => {
    lines.push(`INSERT INTO collection_packs (collection_key, pack_key, sort_order) VALUES (${esc(c.key)}, ${esc(pk)}, ${j});`);
  });
});

// --- Questions ---
const langs = fs.readdirSync(dataDir).filter(f => {
  const fp = path.join(dataDir, f);
  return fs.statSync(fp).isDirectory();
});

for (const lang of langs) {
  const langDir = path.join(dataDir, lang);
  const files = fs.readdirSync(langDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const packKey = file.replace('.json', '');
    const questions = JSON.parse(fs.readFileSync(path.join(langDir, file), 'utf8'));
    questions.forEach((q, i) => {
      const opts = JSON.stringify(q.options);
      const traits = q.traits ? JSON.stringify(q.traits) : null;
      lines.push(`INSERT INTO questions (pack_key, lang, sort_order, q, options, pi, format, traits) VALUES (${esc(packKey)}, ${esc(lang)}, ${i}, ${esc(q.q)}, ${esc(opts)}, ${q.pi != null ? q.pi : 'NULL'}, ${esc(q.format || null)}, ${esc(traits)});`);
    });
  }
}

fs.writeFileSync(path.join(__dirname, 'seed.sql'), lines.join('\n') + '\n');
console.log(`Generated ${lines.length} INSERT statements`);
