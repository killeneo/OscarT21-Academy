-- Device cookies (OWASP "slow down online guessing attacks with device cookies"): a browser that has signed in
-- to an account before gets its own login-attempt budget, so failed guesses from elsewhere, which share the
-- per-account budget, cannot lock the owner out. Only the SHA-256 of the cookie value is stored.
-- Rollback: DROP TABLE trusted_devices;

CREATE TABLE trusted_devices (
  token_hash bytea PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX trusted_devices_user_id_idx ON trusted_devices (user_id);
CREATE INDEX trusted_devices_expires_at_idx ON trusted_devices (expires_at);
