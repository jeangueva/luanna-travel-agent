CREATE TABLE IF NOT EXISTS worker_errors (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS idx_worker_errors_occurred_at ON worker_errors USING BRIN (occurred_at);
CREATE INDEX IF NOT EXISTS idx_worker_errors_context ON worker_errors(context, occurred_at DESC);
