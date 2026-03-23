-- blindside D1 schema
-- Packs: metadata for each deck
CREATE TABLE IF NOT EXISTS packs (
  key         TEXT PRIMARY KEY,
  emoji       TEXT NOT NULL,
  name_key    TEXT NOT NULL,
  count_key   TEXT NOT NULL,
  desc_key    TEXT,
  cat         TEXT NOT NULL,
  badge       TEXT,
  plays       TEXT DEFAULT '0',
  featured    INTEGER DEFAULT 0,
  featured_badge TEXT,
  solo        INTEGER DEFAULT 0,
  wide        INTEGER DEFAULT 0,
  sort_order  INTEGER DEFAULT 0
);

-- Categories: filter pills
CREATE TABLE IF NOT EXISTS categories (
  key        TEXT PRIMARY KEY,
  label_key  TEXT NOT NULL,
  icon       TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

-- Collections: curated groups of packs
CREATE TABLE IF NOT EXISTS collections (
  key        TEXT PRIMARY KEY,
  emoji      TEXT NOT NULL,
  gradient   TEXT NOT NULL,        -- JSON array: ["#hex1","#hex2"]
  name_key   TEXT NOT NULL,
  desc_key   TEXT NOT NULL,
  mode       TEXT NOT NULL,        -- 'partner' or 'self'
  badge      TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Collection-pack join table (ordered)
CREATE TABLE IF NOT EXISTS collection_packs (
  collection_key TEXT NOT NULL REFERENCES collections(key),
  pack_key       TEXT NOT NULL REFERENCES packs(key),
  sort_order     INTEGER DEFAULT 0,
  PRIMARY KEY (collection_key, pack_key)
);

-- Questions: one row per question per language
CREATE TABLE IF NOT EXISTS questions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_key   TEXT NOT NULL REFERENCES packs(key),
  lang       TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  q          TEXT NOT NULL,
  options    TEXT NOT NULL,         -- JSON array of strings
  pi         INTEGER,              -- partner answer index (null for trait-based)
  format     TEXT,                 -- 'bubble','vs','swipe','blindguess' or null
  traits     TEXT                  -- JSON array of trait objects (null for pi-based)
);

CREATE INDEX IF NOT EXISTS idx_questions_pack_lang ON questions(pack_key, lang);
