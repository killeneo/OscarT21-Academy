import { createHash, randomBytes } from "node:crypto";
import type { SelfRole } from "./config";
import { db } from "./db";

/**
 * E-mail-first sign-up (closes account enumeration and pre-registration of someone else's address):
 *  1. `createSignupRequest`: an address without an account gets a single-use link; nothing else is stored.
 *  2. `completeSignup`: whoever opens the link (i.e. controls the mailbox) chooses the password, role and consent,
 *     and only then the account is created, already verified.
 * Older links stay valid until one of them is used, so requesting links for someone's address cannot cancel the
 * link they are about to open; requests are rate limited per address.
 */
export const SIGNUP_TTL_SECONDS = 60 * 60 * 24;

const sha256 = (v: string) => createHash("sha256").update(v).digest();

export async function createSignupRequest(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // Addresses of people who never finished signing up are not kept longer than needed.
  await db().query("DELETE FROM signup_requests WHERE expires_at < now() - interval '1 day'");
  await db().query(
    "INSERT INTO signup_requests (token_hash, email, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))",
    [sha256(token), email, SIGNUP_TTL_SECONDS],
  );
  return token;
}

/** The address a valid, unused sign-up link belongs to, without using the link up. */
export async function peekSignup(token: string): Promise<{ email: string } | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db().query<{ email: string }>(
    "SELECT email FROM signup_requests WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()",
    [sha256(token)],
  );
  return rows[0] ?? null;
}

export type CompleteSignupResult = { ok: true; userId: string; email: string } | { ok: false; reason: "invalid_token" | "account_exists" };

/**
 * Uses the link and creates the account in one transaction. Every other open link for the address dies with it.
 * `account_exists`: the address got an account in the meantime (another link, Google); only the mailbox owner
 * can see this answer, so it reveals nothing to anyone else. The link then stays unused.
 */
export async function completeSignup(
  token: string,
  input: { passwordHash: string; displayName: string; role: SelfRole; consentVersion: string },
): Promise<CompleteSignupResult> {
  if (!token || token.length > 200) return { ok: false, reason: "invalid_token" };
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const used = await client.query<{ email: string }>(
      `UPDATE signup_requests SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING email`,
      [sha256(token)],
    );
    const email = used.rows[0]?.email;
    if (!email) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "invalid_token" };
    }
    await client.query("UPDATE signup_requests SET used_at = now() WHERE email = $1 AND used_at IS NULL", [email]);
    const created = await client.query<{ id: string }>(
      `INSERT INTO users (email, email_verified_at, password_hash, display_name, role, privacy_consent_at, privacy_consent_version)
       VALUES ($1, now(), $2, $3, $4, now(), $5) RETURNING id`,
      [email, input.passwordHash, input.displayName, input.role, input.consentVersion],
    );
    await client.query("COMMIT");
    return { ok: true, userId: created.rows[0].id, email };
  } catch (err) {
    await client.query("ROLLBACK");
    if ((err as { code?: string }).code === "23505") return { ok: false, reason: "account_exists" };
    throw err;
  } finally {
    client.release();
  }
}
