import { fail, hasSameOrigin, ok, readJson } from "@/lib/auth/http";
import { db } from "@/lib/auth/db";
import { allowPerIp } from "@/lib/auth/rate-limit";
import { getSessionUser } from "@/lib/auth/session";
import { consumeToken } from "@/lib/auth/tokens";

/**
 * Confirms an e-mail address. POST (not GET) so link scanners that prefetch URLs cannot use up the token.
 *
 * Only the signed-in owner of the account can confirm it. Otherwise someone who signed up with another person's
 * address would keep a password and session for it, and the address owner's click on the mailed link would turn
 * that account into a verified one (account pre-hijacking). A token of another account is refused and left unused.
 */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allowPerIp(req, "verify-confirm", 30, 900))) return fail("rate_limited", 429);
    const user = await getSessionUser();
    if (!user) return fail("unauthorized", 401);
    const body = await readJson(req);
    const token = typeof body?.token === "string" ? body.token : "";
    const used = await consumeToken(token, "verify_email", user.id);
    if (!used) return fail("invalid_token", 400);
    await db().query("UPDATE users SET email_verified_at = coalesce(email_verified_at, now()), updated_at = now() WHERE id = $1", [used.userId]);
    return ok();
  } catch (err) {
    console.error("verify confirm failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
