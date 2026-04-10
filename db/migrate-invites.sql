-- Mira invites / referral system
CREATE TABLE IF NOT EXISTS invites (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  referrer_id  TEXT,                    -- bs-user-id of the person who created the invite
  referrer_name TEXT NOT NULL,
  referrer_email TEXT,
  friend_name  TEXT,
  friend_contact TEXT,
  vouch_text   TEXT,
  relation     TEXT,
  status       TEXT DEFAULT 'pending',  -- pending | joined | expired
  joined_by_id TEXT,                    -- bs-user-id of the person who used the invite
  joined_by_name TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  joined_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_referrer ON invites(referrer_id);
CREATE INDEX IF NOT EXISTS idx_invites_joined ON invites(joined_by_id);

-- Mira user profiles (extended data beyond blindside auth)
CREATE TABLE IF NOT EXISTS mira_profiles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL UNIQUE,   -- bs-user-id
  username        TEXT,
  name            TEXT,
  email           TEXT,
  age             INTEGER,
  gender          TEXT,
  neighborhood    TEXT,
  traits          TEXT,                   -- JSON array
  weekend         TEXT,                   -- JSON array
  values_list     TEXT,                   -- JSON array
  age_min         INTEGER,
  age_max         INTEGER,
  ideal_person    TEXT,
  dealbreaker     TEXT,
  phone           TEXT,
  referred_by     TEXT,                   -- invite code used to join
  referrer_name   TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mira_profiles_user ON mira_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_mira_profiles_referred ON mira_profiles(referred_by);
