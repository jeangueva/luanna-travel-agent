-- Count of silence-based nudges sent since the user's last reply.
-- Reset to 0 on any incoming message. Cron stops at 3 (day 1, 3, 7).
ALTER TABLE users ADD COLUMN IF NOT EXISTS inactivity_nudge_count INTEGER NOT NULL DEFAULT 0;
