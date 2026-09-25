-- Idempotent reference migration. Runtime also applies the same CREATE IF NOT EXISTS statements.
CREATE TABLE IF NOT EXISTS economy_players (
  user_key TEXT PRIMARY KEY,
  tiktok_username TEXT NOT NULL,
  tiktok_user_id TEXT,
  lifetime_kills INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_kills >= 0),
  spent_kills INTEGER NOT NULL DEFAULT 0 CHECK (spent_kills >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS economy_ledger (
  id UUID PRIMARY KEY,
  user_key TEXT NOT NULL REFERENCES economy_players(user_key),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reference_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_key, kind, reference_id)
);
CREATE INDEX IF NOT EXISTS economy_ledger_user_created_idx ON economy_ledger(user_key, created_at DESC);
CREATE TABLE IF NOT EXISTS economy_catalog (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0), damage INTEGER NOT NULL DEFAULT 0,
  range_px INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL, cooldown_ms INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS economy_inventory (
  id UUID PRIMARY KEY, user_key TEXT NOT NULL REFERENCES economy_players(user_key), item_id TEXT NOT NULL REFERENCES economy_catalog(id),
  status TEXT NOT NULL, purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(), bound_until TIMESTAMPTZ NOT NULL,
  holder_key TEXT NOT NULL, x REAL, y REAL, dropped_at TIMESTAMPTZ, picked_up_at TIMESTAMPTZ, operation_key TEXT UNIQUE NOT NULL
);
CREATE INDEX IF NOT EXISTS economy_inventory_holder_idx ON economy_inventory(holder_key, status);
