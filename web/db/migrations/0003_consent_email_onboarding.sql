-- Registration completion: personal-data consent, e-mail verification / password reset tokens, onboarding profiles.

ALTER TABLE users
  ADD COLUMN privacy_consent_at      timestamptz,
  ADD COLUMN privacy_consent_version text,
  ADD COLUMN city                    text CHECK (city IS NULL OR city ~ '^[a-z_]{1,30}$'),
  ADD COLUMN onboarding_completed_at timestamptz;

CREATE TYPE email_token_purpose AS ENUM ('verify_email', 'reset_password');

-- Single-use, expiring tokens. Only the SHA-256 of the token is stored.
CREATE TABLE email_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose    email_token_purpose NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_idx ON email_tokens (user_id, purpose);

-- Organization profile (one per owner for now; staff accounts come later).
CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  org_type      text NOT NULL CHECK (org_type IN ('school', 'center', 'ngo', 'other')),
  city          text NOT NULL CHECK (city ~ '^[a-z_]{1,30}$'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
