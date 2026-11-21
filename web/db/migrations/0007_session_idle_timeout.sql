-- Idle timeout for sessions (ASVS V3.3): a session unused for SESSION_IDLE_SECONDS stops working even before its
-- absolute expiry. Existing sessions start counting from the time this migration runs.
-- Rollback: ALTER TABLE sessions DROP COLUMN last_seen_at;

ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
