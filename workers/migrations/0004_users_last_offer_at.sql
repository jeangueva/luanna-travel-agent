ALTER TABLE users ADD COLUMN IF NOT EXISTS last_offer_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_last_offer_at ON users(last_offer_at);
