-- Pending magic-link merge requests. A web user clicks Vincular, we issue
-- a short code, they send it to Luanna in WhatsApp, the webhook merges the
-- web user into the WhatsApp user, and the web client polls the status.
CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  web_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_link_codes_web_user_id ON link_codes(web_user_id);
CREATE INDEX IF NOT EXISTS idx_link_codes_expires_at ON link_codes(expires_at);
