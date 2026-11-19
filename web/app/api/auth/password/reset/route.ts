import { clientIp, fail, hasSameOrigin, ok, readJson } from "@/lib/auth/http";
import { db } from "@/lib/auth/db";
import { PasswordHashBusyError, checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { allow } from "@/lib/auth/rate-limit";
import { consumeToken, peekToken } from "@/lib/auth/tokens";

/** Sets a new password from a reset link. All existing sessions of the account are revoked. */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allow(`reset:ip:${clientIp(req)}`, 20, 3600))) return fail("rate_limited", 429);
    const body = await readJson(req);
    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : null;
    if (password === null) return fail("invalid_input", 400);

    const found = await peekToken(token, "reset_password");
    if (!found) return fail("invalid_token", 400);
    const policy = checkPasswordPolicy(password, found.email ?? "");
    if (policy) return fail(policy, 400);

    // Hash before using up the token: if hashing is refused as busy, the link still works for a retry.
    const passwordHash = await hashPassword(password);
    const used = await consumeToken(token, "reset_password");
    if (!used) return fail("invalid_token", 400);

    const client = await db().connect();
    try {
      await client.query("BEGIN");
      // Following the link proves control of the mailbox, so the e-mail counts as verified.
      await client.query(
        "UPDATE users SET password_hash = $2, email_verified_at = coalesce(email_verified_at, now()), updated_at = now() WHERE id = $1",
        [used.userId, passwordHash],
      );
      await client.query("DELETE FROM sessions WHERE user_id = $1", [used.userId]);
      // Browsers remembered before the reset (possibly the attacker's) lose their own login-attempt budget.
      await client.query("DELETE FROM trusted_devices WHERE user_id = $1", [used.userId]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return ok();
  } catch (err) {
    if (err instanceof PasswordHashBusyError) return fail("rate_limited", 503);
    console.error("reset password failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
