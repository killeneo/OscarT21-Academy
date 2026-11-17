import { clientIp, fail, hasSameOrigin, ok, readJson } from "@/lib/auth/http";
import { db } from "@/lib/auth/db";
import { allow } from "@/lib/auth/rate-limit";
import { consumeToken } from "@/lib/auth/tokens";

/** Confirms an e-mail address. POST (not GET) so link scanners that prefetch URLs cannot use up the token. */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allow(`verify-confirm:ip:${clientIp(req)}`, 30, 900))) return fail("rate_limited", 429);
    const body = await readJson(req);
    const token = typeof body?.token === "string" ? body.token : "";
    const used = await consumeToken(token, "verify_email");
    if (!used) return fail("invalid_token", 400);
    await db().query("UPDATE users SET email_verified_at = coalesce(email_verified_at, now()), updated_at = now() WHERE id = $1", [used.userId]);
    return ok();
  } catch (err) {
    console.error("verify confirm failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
