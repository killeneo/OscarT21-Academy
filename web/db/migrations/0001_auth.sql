-- Authentication schema: users, external identities, sessions, rate limits, replay guard.

CREATE TYPE user_role AS ENUM ('parent', 'specialist', 'organization', 'moderator', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended');

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text,
  email_verified_at timestamptz,
  password_hash     text,
  display_name      text NOT NULL DEFAULT '',
  role              user_role NOT NULL DEFAULT 'parent',
  status            user_status NOT NULL DEFAULT 'active',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower CHECK (email IS NULL OR email = lower(email))
);

-- Case-insensitive uniqueness (emails are stored lower-cased; NULL for Telegram-only users).
CREATE UNIQUE INDEX users_email_key ON users (email) WHERE email IS NOT NULL;

CREATE TABLE identities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider         text NOT NULL CHECK (provider IN ('google', 'telegram')),
  provider_user_id text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX identities_user_id_idx ON identities (user_id);

CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   bytea NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- Fixed-window counters. Keys contain only hashes / IPs, never raw emails.
CREATE TABLE rate_limits (
  key      text PRIMARY KEY,
  count    integer NOT NULL,
  reset_at timestamptz NOT NULL
);

-- One-time markers (Telegram payload replay protection).
CREATE TABLE auth_replay (
  key        text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_replay_expires_at_idx ON auth_replay (expires_at);
