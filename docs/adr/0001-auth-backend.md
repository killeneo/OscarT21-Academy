# ADR 0001: Authentication backend (Google / Telegram / Email + password)

Status: accepted by the product owner (2026-11-12) for the MVP login slice; revisit before launch.

## Context

The frontend (`web/`, Next.js App Router) needs working sign-in via Google, Telegram and Email + password.
No backend stack had been chosen. Personal data of parents and children is sensitive and the launch jurisdiction and
data-residency regime are not yet reviewed (see `CLAUDE.md`, section 5).

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A. Next.js route handlers in `web/` + PostgreSQL | Fastest to MVP, one deployable, no CORS/CSRF across origins | Backend coupled to the frontend deployment; must not be hosted where data residency is unacceptable |
| B. Separate NestJS / FastAPI service | Clean separation, easier to place in a compliant region | New project, Docker, cross-origin cookies, slower start |
| C. Auth.js (next-auth v5) | Ready-made OAuth | v5 is still a beta line; no Telegram provider; Credentials + database sessions are not supported together, so we would end up with JWT sessions and custom code anyway |

## Decision

Option A, implemented **without Auth.js**: a small, auditable in-repo module (`web/lib/auth`) with a single new runtime
dependency (`pg`).

- **Sessions:** opaque random 256-bit token in an `httpOnly`, `SameSite=Lax` cookie (`__Host-` prefix and `Secure` in
  production). Only the SHA-256 of the token is stored (`sessions` table), so a database leak does not leak live sessions.
  Sessions can be revoked server-side.
- **Passwords:** scrypt (N=2^15, r=8, p=3) with a per-user salt and constant-time comparison; length 10..128, no
  composition rules (NIST 800-63B). Login errors are generic and a dummy hash is checked for unknown emails.
- **Google:** authorization code flow with PKCE and `state`; profile is read from the OpenID userinfo endpoint over TLS.
- **Telegram:** Login Widget payload verified with HMAC-SHA256 (key = SHA-256 of the bot token), `auth_date` freshness
  window of 5 minutes and replay protection.
- **Account linking:** a verified Google email is linked to an existing account by email only; if that account was an
  unverified password account its password is cleared and its sessions revoked (pre-hijacking mitigation).
- **CSRF:** `SameSite=Lax` + `Origin` must match `Host` + JSON-only bodies on state-changing routes.
- **Abuse:** database-backed rate limits (per IP and per hashed email).
- **Roles:** `parent`, `specialist`, `organization` can be self-selected at sign-up; `moderator` and `admin` can never be
  assigned through public endpoints.

## Consequences / open items

- **E-mail verification and password reset** are implemented with single-use, expiring tokens (SHA-256 stored,
  24 h / 1 h). There is **no mail provider yet**: mails are printed to the server console in development (or with
  `MAIL_TRANSPORT=console`) and are not sent in production until a provider is approved and wired into
  `web/lib/auth/mailer.ts`. Confirmation is POST-only so link scanners cannot consume the token. Verification does
  not yet gate any feature; sign-up still reveals whether an e-mail is taken.
- **Consent:** registration (password, Google, Telegram) requires explicit consent to personal-data processing;
  the consent version and time are stored on the user (`privacy_consent_*`). The privacy policy page is a **draft**
  that a lawyer must review before launch.
- **Onboarding:** after sign-up each role fills a minimal profile (`/onboarding`). A specialist profile is saved as
  `draft` or sent as `submitted`; the client can never set verification status or publish. Document upload and
  the moderator queue are not built yet.
- Rate limiting trusts `X-Forwarded-For`; set up the reverse proxy so clients cannot spoof it.
- Hosting: PostgreSQL and the app must be placed only after the legal data-residency review.
- Permission matrix for non-auth resources is still to be written before more modules are added.
