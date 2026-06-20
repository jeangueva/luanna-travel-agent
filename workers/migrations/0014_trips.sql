-- Generated trip itineraries. Luanna builds a structured itinerary from the
-- conversation, persists it here, and renders it both as a shareable web page
-- (/trip/:slug) and as a PDF (Browser Rendering). The full structured document
-- lives in the JSONB `content` column, validated by a Zod schema on write, so
-- web and PDF render from one source of truth without over-normalizing the
-- day/place tree into many tables.
CREATE TABLE IF NOT EXISTS trips (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  total_days INT,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at);
