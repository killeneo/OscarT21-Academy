import type { PoolClient } from "pg";
import { db } from "./db";
import type { SelfRole } from "./config";
import { isGoogleOwnedEmail } from "./google-email";

export type UserRow = { id: string; email: string | null; password_hash: string | null; status: "active" | "suspended" };

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await db().query<UserRow>(
    "SELECT id, email, password_hash, status FROM users WHERE email = $1",
    [email],
  );
  return rows[0] ?? null;
}

/** Returns the new user id, or null if the email is already taken (unique violation). */
export async function createPasswordUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
  role: SelfRole;
  consentVersion: string;
}): Promise<string | null> {
  try {
    const { rows } = await db().query<{ id: string }>(
      "INSERT INTO users (email, password_hash, display_name, role, privacy_consent_at, privacy_consent_version) VALUES ($1, $2, $3, $4, now(), $5) RETURNING id",
      [input.email, input.passwordHash, input.displayName, input.role, input.consentVersion],
    );
    return rows[0].id;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return null;
    throw err;
  }
}

export type OAuthProfile = { email: string | null; emailVerified: boolean; displayName: string };
export type OAuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "suspended" | "consent_required" | "link_requires_password" };

/**
 * Finds or creates the user for an external identity (Google / Telegram).
 *
 * Linking to an existing account by email happens only for a *verified* provider email on a Google-owned domain
 * (gmail.com): for other domains it is refused and the person signs in with their password instead, so a
 * re-registered domain cannot take over its old users' accounts. If the matching local account never proved
 * ownership of the email (password sign-up without verification), its password is cleared and its sessions
 * revoked, so someone who pre-registered a victim's email cannot keep access (pre-hijacking).
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

  if (email) {
    const byEmail = await client.query<{ id: string; status: string; email_verified_at: Date | null }>(
      "SELECT id, status, email_verified_at FROM users WHERE email = $1 FOR UPDATE",
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
        await client.query("DELETE FROM sessions WHERE user_id = $1", [match.id]);
      }
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
  return { ok: true, userId };
}
