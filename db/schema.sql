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

-- ==================== Stranger matching ====================

-- Matching queue: ephemeral, high write
CREATE TABLE IF NOT EXISTS match_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  username     TEXT NOT NULL,
  lang         TEXT DEFAULT 'en',
  status       TEXT DEFAULT 'waiting',  -- waiting | matched | expired | cancelled
  claim_token  TEXT,
  matched_with TEXT,
  session_code TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  expires_at   TEXT DEFAULT (datetime('now', '+2 minutes'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_user_active
  ON match_queue(user_id) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_queue_status
  ON match_queue(status, created_at);

-- Stranger match state (wraps a regular session)
CREATE TABLE IF NOT EXISTS stranger_matches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_code    TEXT NOT NULL UNIQUE,
  user_a_id       TEXT NOT NULL,
  user_b_id       TEXT NOT NULL,
  user_a_username TEXT NOT NULL,
  user_b_username TEXT NOT NULL,
  pack_key        TEXT NOT NULL,
  state           TEXT DEFAULT 'playing',  -- playing | voting | resolved
  user_a_vote     TEXT,    -- yes | no | NULL
  user_b_vote     TEXT,
  result          TEXT,    -- match | pass | expired | abandoned
  created_at      TEXT DEFAULT (datetime('now')),
  vote_deadline   TEXT
);

CREATE INDEX IF NOT EXISTS idx_stranger_users_a
  ON stranger_matches(user_a_id);
CREATE INDEX IF NOT EXISTS idx_stranger_users_b
  ON stranger_matches(user_b_id);
