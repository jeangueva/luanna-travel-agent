-- Hotel watchlists share the existing delivery/activation lifecycle with
-- flight alerts, but retain the stay dates and occupancy needed to re-price
-- the exact same market on each cron run. Existing rows remain flight alerts.
ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS alert_type TEXT NOT NULL DEFAULT 'flight'
  CHECK (alert_type IN ('flight', 'hotel'));
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS checkin DATE;
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS checkout DATE;
ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS adults INTEGER NOT NULL DEFAULT 2
  CHECK (adults BETWEEN 1 AND 16);

CREATE INDEX IF NOT EXISTS idx_watchlist_type_active
  ON watchlist(alert_type, active, last_checked_at);

-- The application already classifies alert clicks as "watchlist", so include
-- that value in the persisted constraint so alert URLs can actually be
-- shortened and attributed instead of silently falling back to the raw URL.
ALTER TABLE click_redirects
  DROP CONSTRAINT IF EXISTS click_redirects_kind_check;
ALTER TABLE click_redirects
  ADD CONSTRAINT click_redirects_kind_check
  CHECK (kind IN ('flight', 'hotel', 'package', 'offer', 'watchlist', 'other'));

-- One observation represents the cheapest valid hotel returned for the
-- requested city/dates/occupancy. This is intentionally separate from the
-- route-oriented flight history so neither baseline can pollute the other.
CREATE TABLE IF NOT EXISTS hotel_price_history (
  id BIGSERIAL PRIMARY KEY,
  watchlist_id BIGINT REFERENCES watchlist(id) ON DELETE SET NULL,
  city TEXT NOT NULL,
  property_token TEXT,
  property_name TEXT NOT NULL,
  checkin DATE NOT NULL,
  checkout DATE NOT NULL,
  adults INTEGER NOT NULL CHECK (adults BETWEEN 1 AND 16),
  price_per_night_usd INTEGER NOT NULL CHECK (price_per_night_usd > 0),
  price_total_usd INTEGER NOT NULL CHECK (price_total_usd > 0),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('watchlist_cron', 'tool_search'))
);

CREATE INDEX IF NOT EXISTS idx_hotel_price_history_market_time
  ON hotel_price_history(LOWER(city), checkin, checkout, adults, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_price_history_property_time
  ON hotel_price_history(property_token, observed_at DESC)
  WHERE property_token IS NOT NULL;
