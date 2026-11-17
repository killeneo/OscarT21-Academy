import { clientIp, fail, hasSameOrigin, ok, parseEmail, readJson } from "@/lib/auth/http";
import { PASSWORD_MAX, burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { allow, hashKey } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";

export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allow(`login:ip:${clientIp(req)}`, 30, 900))) return fail("rate_limited", 429);

    const body = await readJson(req);
    const email = parseEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : null;
    if (!email || password === null || [...password].length > PASSWORD_MAX) return fail("invalid_input", 400);

    // Per-account limit stops distributed guessing against one email.
    if (!(await allow(`login:email:${hashKey(email)}`, 8, 900))) return fail("rate_limited", 429);

    const user = await findUserByEmail(email);
    if (!user || !user.password_hash) {
      await burnPasswordCheck(password);
      return fail("invalid_credentials", 401);
    }
    if (!(await verifyPassword(password, user.password_hash))) return fail("invalid_credentials", 401);
    if (user.status !== "active") return fail("account_suspended", 403);

    await createSession(user.id);
    return ok();
  } catch (err) {
    console.error("login failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
