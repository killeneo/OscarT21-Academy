import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export type TokenPurpose = "verify_email" | "reset_password";

export const TOKEN_TTL_SECONDS: Record<TokenPurpose, number> = {
  verify_email: 60 * 60 * 24,
  reset_password: 60 * 60,
};

const sha256 = (v: string) => createHash("sha256").update(v).digest();

/**
 * Creates a fresh single-use token. Returns the raw token.
 *  - verify_email: older unused tokens stop working (only the newest link counts);
 *  - reset_password: older links keep working until one of them is used. Otherwise anyone who knows the address
 *    could keep requesting resets and cancel the link the owner is about to open. Requests are rate limited per
 *    address, and a successful reset invalidates every outstanding link (see the password reset route).
 */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    if (purpose === "verify_email") {
      await client.query("UPDATE email_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [
        userId,
        purpose,
      ]);
    }
    await client.query(
      "INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(secs => $4))",
      [userId, purpose, sha256(token), TOKEN_TTL_SECONDS[purpose]],
    );
    await client.query("DELETE FROM email_tokens WHERE expires_at < now() - interval '7 days'");
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return token;
}

/** Looks a token up without using it (to validate input before consuming). */
export async function peekToken(token: string, purpose: TokenPurpose): Promise<{ userId: string; email: string | null } | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db().query<{ user_id: string; email: string | null }>(
    `SELECT t.user_id, u.email FROM email_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.purpose = $2 AND t.used_at IS NULL AND t.expires_at > now() AND u.status = 'active'`,
    [sha256(token), purpose],
  );
  return rows[0] ? { userId: rows[0].user_id, email: rows[0].email } : null;
}

/**
 * Atomically marks a valid token as used. Returns the owner, or null if invalid, expired or already used.
 * With `userId`, only a token issued to that user is accepted; a token of another account is left untouched.
 */
export async function consumeToken(token: string, purpose: TokenPurpose, userId?: string): Promise<{ userId: string } | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db().query<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
        AND ($3::uuid IS NULL OR user_id = $3::uuid)
      RETURNING user_id`,
    [sha256(token), purpose, userId ?? null],
  );
  return rows[0] ? { userId: rows[0].user_id } : null;
}
