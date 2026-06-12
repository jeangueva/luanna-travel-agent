-- Gamification: partner promo codes dispensed by level.
-- Codes are loaded manually (negotiated with partners) and the bot hands one
-- out when a user's computed level qualifies. One code per user.
CREATE TABLE IF NOT EXISTS promo_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  min_level INTEGER NOT NULL DEFAULT 1,        -- 1=Explorador 2=Viajero 3=Trotamundos
  active BOOLEAN NOT NULL DEFAULT TRUE,
  claimed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_available
  ON promo_codes(min_level, active) WHERE claimed_by IS NULL;
