import { db } from "@/lib/auth/db";
import { trustDevice } from "@/lib/auth/devices";
import { fail, hasSameOrigin, ok, readJson } from "@/lib/auth/http";
import { PASSWORD_MAX, PasswordHashBusyError, checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";
import { allow, allowPerIp } from "@/lib/auth/rate-limit";
import { createSession, getSessionUser } from "@/lib/auth/session";

/**
 * Changes the password of the signed-in user. The current password is required (a session alone is not enough, so
 * an unlocked device or a stolen session cookie cannot take the account over). Afterwards every session and
 * remembered device of the account ends, outstanding reset links die, and this browser gets a fresh session.
 * Accounts without a password (Google / Telegram) set one through password recovery instead.
 */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    const user = await getSessionUser();
    if (!user) return fail("unauthorized", 401);
    if (!(await allow(`pwchange:user:${user.id}`, 5, 900)) || !(await allowPerIp(req, "pwchange", 20, 3600))) {
      return fail("rate_limited", 429);
    }

    const body = await readJson(req);
    const current = typeof body?.currentPassword === "string" ? body.currentPassword : null;
    const next = typeof body?.newPassword === "string" ? body.newPassword : null;
    if (current === null || next === null || [...current].length > PASSWORD_MAX) return fail("invalid_input", 400);

    const { rows } = await db().query<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    const stored = rows[0]?.password_hash;
    if (!stored || !(await verifyPassword(current, stored))) return fail("invalid_credentials", 403);
    const policy = checkPasswordPolicy(next, user.email ?? "");
    if (policy) return fail(policy, 400);
    const passwordHash = await hashPassword(next);

    const client = await db().connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [user.id, passwordHash]);
      await client.query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
      await client.query("DELETE FROM trusted_devices WHERE user_id = $1", [user.id]);
      await client.query(
        "UPDATE email_tokens SET used_at = now() WHERE user_id = $1 AND purpose = 'reset_password' AND used_at IS NULL",
        [user.id],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    await createSession(user.id);
    await trustDevice(user.id);
    return ok();
  } catch (err) {
    if (err instanceof PasswordHashBusyError) return fail("rate_limited", 503);
    console.error("password change failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
