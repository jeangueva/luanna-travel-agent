-- Re-engagement cap: prevent pushing more than 1 unsolicited nudge per user per ~2 weeks.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nudge_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_last_nudge_at ON users(last_nudge_at);

-- Click tracking: every affiliate link we hand out goes through /r/<id> so we
-- log intent. The original url stays as TEXT (Aviasales links are long).
CREATE TABLE IF NOT EXISTS click_redirects (
  id TEXT PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  original_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('flight','hotel','package','offer','other')),
  click_count INTEGER NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_click_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_click_redirects_user_created ON click_redirects(user_id, created_at DESC);

-- Price history: every cheapest-price observation from cron + tool calls.
-- Used to detect *real* drops in the watchlist cron (current < 90% of recent avg).
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  origin_iata TEXT NOT NULL,
  destination_iata TEXT NOT NULL,
  price_usd INTEGER NOT NULL CHECK (price_usd > 0),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('watchlist_cron','tool_search','offer_cron'))
);
CREATE INDEX IF NOT EXISTS idx_price_history_route_time
  ON price_history(origin_iata, destination_iata, observed_at DESC);
