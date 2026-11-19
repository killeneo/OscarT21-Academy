# ADR 0001: Authentication backend (Google / Telegram / Email + password)

Status: accepted by the product owner (2026-11-12) for the MVP login slice; updated 2026-11-19 after the security review; revisit before launch.

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
  Sessions end after 14 days (absolute) or 7 days without use (idle, `last_seen_at`, written at most every 10 minutes).
  They can be revoked server-side: logout, "log out on all devices", password reset and suspension.
- **Passwords:** scrypt (N=2^15, r=8, p=3) with a per-user salt and constant-time comparison; length 10..128, no
  composition rules, plus a blocklist of ~9k common passwords and the e-mail's local part (NIST 800-63B). Login errors
  are generic and a dummy hash is checked for unknown emails. At most 2 hashes run at once per process (64 queued,
  then `503`), so bursts cannot exhaust memory or the libuv pool.
- **Google:** authorization code flow with PKCE and `state` (`__Host-` cookie in production); profile is read from the
  OpenID userinfo endpoint over TLS. Sign-up consent travels only through a same-origin form POST, never a link.
- **Telegram:** Login Widget payload verified with HMAC-SHA256 (key = SHA-256 of the bot token), `auth_date` freshness
  window of 5 minutes and replay protection. The widget (third-party script) runs only on `/[lang]/telegram`, a page
  without password fields; the CSP allows `telegram.org` only there.
- **Account linking:** a verified Google email is linked to an existing account by email only for Google-owned
  domains (`gmail.com`, `googlemail.com`); other domains can change hands when they expire, so those users sign in
  with their password. Linking always ends the account's sessions and remembered devices. If the account was never
  verified its password is cleared too (pre-hijacking mitigation); if it has a password, the owner gets an e-mail.
- **Password sign-up is e-mail-first** (re-audit R-01/R-02, migration `0008`): step 1 (`POST /api/auth/register`)
  takes only the address, the role to preselect and consent, and answers `202` with no cookies for new and taken
  addresses alike; a link (24 h, single use, SHA-256 stored in `signup_requests`) or an "account exists" notice is
  mailed after the response. Step 2 (`POST /api/auth/register/complete`, page `/[lang]/register/complete`) is done by
  whoever controls the mailbox: they choose password, name and role and give their own consent; the account is created
  already verified and signed in. Nobody can pre-register someone else's address with a password.
- **E-mail confirmation** of older unverified accounts works only in the account's own session; a signed-out visitor
  is asked to sign in first, and another account's session is refused.
- **CSRF:** `SameSite=Lax` + `Origin` must match the configured site origin or `Host` (`X-Forwarded-Host` only behind
  a trusted proxy) + JSON-only bodies on state-changing routes.
- **Abuse:** database-backed rate limits per account / hashed e-mail and per client IP. The client IP comes only from a
  header the infrastructure overwrites: `x-vercel-forwarded-for` on Vercel, otherwise `TRUSTED_IP_HEADER` (or `none`
  to switch per-IP limits off). A production server outside Vercel without that setting refuses auth requests and
  logs why, because one shared bucket would let anyone lock every user out. Browsers that signed in before get their
  own login budget (device cookie), so failed guesses from elsewhere cannot lock the owner out.
- **Roles:** `parent`, `specialist`, `organization` can be self-selected at sign-up; `moderator` and `admin` can never be
  assigned through public endpoints.

## Consequences / open items

- **E-mail verification and password reset** are implemented with single-use, expiring tokens (SHA-256 stored,
  24 h / 1 h; earlier reset links stay valid until one is used, then all die). The token is removed from the address
  bar once the page has read it. Mail work runs after the response (`after()`), so timing does not reveal accounts.
  There is **no mail provider yet**: mails are printed to the server console in development (or with
  `MAIL_TRANSPORT=console` on a localhost production build) and are not sent in production until a provider is approved
  and wired into `web/lib/auth/mailer.ts`. Confirmation is POST-only so link scanners cannot consume the token.
- **Verification gates:** sending a specialist profile for review and creating an organization need a confirmed
  e-mail. Password sign-ups are verified by construction; the gates matter for accounts created before `0008`.
- **No mail provider = no password sign-up in production.** Until a provider is wired in, new users there can only
  use Google or Telegram.
- **Consent:** registration (password, Google, Telegram) requires explicit consent to personal-data processing (for
  password sign-up: at step 1 to process the address, and again by the address owner at step 2);
  the consent version and time are stored on the user (`privacy_consent_*`). The privacy policy page is a **draft**
  that a lawyer must review before launch.
- **Onboarding:** after sign-up each role fills a minimal profile (`/onboarding`). A specialist profile is saved as
  `draft` or sent as `submitted`; the client can never set verification status or publish. Document upload and
  the moderator queue are not built yet.
- **Deployment checklist:** set `TRUSTED_IP_HEADER` (or rely on Vercel), run migrations up to `0008`, set
  `NEXT_PUBLIC_SITE_URL`, keep `MAIL_TRANSPORT` unset on real hosts.
- Hosting: PostgreSQL and the app must be placed only after the legal data-residency review.
- Permission matrix for non-auth resources is still to be written before more modules are added.
- Security review: `docs/security/2026-11-audit.md` and `docs/security/2026-11-19-reaudit.md` (findings and their status).
