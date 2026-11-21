import type { PoolClient } from "pg";
import { db } from "./db.ts";
import type { SelfRole } from "./config.ts";
import { isGoogleOwnedEmail } from "./google-email.ts";

export type UserRow = { id: string; email: string | null; password_hash: string | null; status: "active" | "suspended" };

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await db().query<UserRow>(
    "SELECT id, email, password_hash, status FROM users WHERE email = $1",
    [email],
  );
  return rows[0] ?? null;
}

export type OAuthProfile = { email: string | null; emailVerified: boolean; displayName: string };
export type OAuthResult =
  /** `linkedToPassword`: the identity was just attached to an existing account that has a password (tell its owner). */
  | { ok: true; userId: string; linkedToPassword?: boolean }
  | { ok: false; reason: "suspended" | "consent_required" | "link_requires_password" };

/**
 * Finds or creates the user for an external identity (Google / Telegram).
 *
 * Linking to an existing account by email happens only for a *verified* provider email on a Google-owned domain
 * (gmail.com): for other domains it is refused and the person signs in with their password instead, so a
 * re-registered domain cannot take over its old users' accounts. If the matching local account never proved
 * ownership of the email (password sign-up without verification), its password is cleared and its sessions
 * revoked, so someone who pre-registered a victim's email cannot keep access (pre-hijacking). Linking to a verified
 * account that has a password also ends all its sessions and remembered devices, and the caller notifies the owner,
 * so a session or device someone else held on that account does not survive the new way in.
 *
 * Kept free of framework imports (explicit .ts paths) so it can be tested against the dev database with plain Node.
 */
export async function findOrCreateOAuthUser(
  provider: "google" | "telegram",
  providerUserId: string,
  profile: OAuthProfile,
  role: SelfRole,
  consentVersion: string | null,
): Promise<OAuthResult> {
  const client = await db().connect();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await client.query("BEGIN");
        const result = await resolve(client, provider, providerUserId, profile, role, consentVersion);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        // Concurrent first sign-in with the same identity/email: retry once and pick up the winner.
        if ((err as { code?: string }).code === "23505" && attempt === 0) continue;
        throw err;
      }
    }
    throw new Error("unreachable");
  } finally {
    client.release();
  }
}

async function resolve(
  client: PoolClient,
  provider: string,
  providerUserId: string,
  profile: OAuthProfile,
  role: SelfRole,
  consentVersion: string | null,
): Promise<OAuthResult> {
  const existing = await client.query<{ id: string; status: string }>(
    `SELECT u.id, u.status FROM identities i JOIN users u ON u.id = i.user_id
      WHERE i.provider = $1 AND i.provider_user_id = $2`,
    [provider, providerUserId],
  );
  if (existing.rows[0]) {
    return existing.rows[0].status === "active"
      ? { ok: true, userId: existing.rows[0].id }
      : { ok: false, reason: "suspended" };
  }

  const email = profile.emailVerified && profile.email ? profile.email.toLowerCase() : null;
  let userId: string | null = null;
  let linkedToPassword = false;

  if (email) {
    const byEmail = await client.query<{ id: string; status: string; email_verified_at: Date | null; has_password: boolean }>(
      "SELECT id, status, email_verified_at, password_hash IS NOT NULL AS has_password FROM users WHERE email = $1 FOR UPDATE",
      [email],
    );
    const match = byEmail.rows[0];
    if (match) {
      if (match.status !== "active") return { ok: false, reason: "suspended" };
      if (provider === "google" && !isGoogleOwnedEmail(email)) return { ok: false, reason: "link_requires_password" };
      if (!match.email_verified_at) {
        await client.query(
          "UPDATE users SET email_verified_at = now(), password_hash = NULL, updated_at = now() WHERE id = $1",
          [match.id],
        );
      } else if (match.has_password) {
        linkedToPassword = true;
      }
      await client.query("DELETE FROM sessions WHERE user_id = $1", [match.id]);
      await client.query("DELETE FROM trusted_devices WHERE user_id = $1", [match.id]);
      userId = match.id;
    }
  }

  if (!userId) {
    // A brand-new account needs explicit consent to personal-data processing.
    if (!consentVersion) return { ok: false, reason: "consent_required" };
    const created = await client.query<{ id: string }>(
      `INSERT INTO users (email, email_verified_at, display_name, role, privacy_consent_at, privacy_consent_version)
       VALUES ($1, CASE WHEN $1::text IS NULL THEN NULL ELSE now() END, $2, $3, now(), $4) RETURNING id`,
      [email, profile.displayName.slice(0, 80), role, consentVersion],
    );
    userId = created.rows[0].id;
  }

  await client.query("INSERT INTO identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)", [
    userId,
    provider,
    providerUserId,
  ]);
  return linkedToPassword ? { ok: true, userId, linkedToPassword } : { ok: true, userId };
}
