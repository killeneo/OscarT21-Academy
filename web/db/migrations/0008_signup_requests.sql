-- E-mail-first sign-up: step 1 stores only the address and a link token; the account (with password, role and
-- consent chosen by the address owner) is created when the mailed link is used. Nobody can pre-register someone
-- else's address with a password, and step 1 answers the same way for new and taken addresses.
-- Only the SHA-256 of the token is stored. Rows are removed a day after they expire (see lib/auth/signup.ts).
-- Rollback: DROP TABLE signup_requests;

CREATE TABLE signup_requests (
  token_hash bytea PRIMARY KEY,
  email      text NOT NULL CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);
CREATE INDEX signup_requests_email_idx ON signup_requests (email);
CREATE INDEX signup_requests_expires_at_idx ON signup_requests (expires_at);
