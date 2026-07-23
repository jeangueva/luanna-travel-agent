-- Deterministic link-selection fallback: when search_flights shows multiple
-- options, options beyond the top one are numbered instead of linked inline
-- (the model has repeatedly proven unreliable at transcribing the opaque
-- /r/ tracking code for every option in a list — this makes real-link
-- delivery a DB lookup + number match instead of a model transcription).
-- Replaced wholesale on every new search (DELETE + INSERT), never appended to.
CREATE TABLE IF NOT EXISTS pending_link_options (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, idx)
);
