import { fail, hasSameOrigin, ok, parseLocale, readJson } from "@/lib/auth/http";
import { sendVerificationEmail } from "@/lib/auth/mailer";
import { allow, allowPerIp } from "@/lib/auth/rate-limit";
import { getSessionUser } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";

/** Signed-in user asks for a fresh confirmation e-mail. */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    const user = await getSessionUser();
    if (!user) return fail("unauthorized", 401);
    if (!user.email || user.emailVerified) return ok();
    if (!(await allow(`verify:user:${user.id}`, 3, 3600)) || !(await allowPerIp(req, "verify", 20, 3600))) {
      return fail("rate_limited", 429);
    }
    const body = await readJson(req);
    await sendVerificationEmail(user.email, parseLocale(body?.lang), await issueToken(user.id, "verify_email"));
    return ok();
  } catch (err) {
    console.error("verify request failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
