CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  email TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ddr_status_time ON data_deletion_requests(status, created_at);
