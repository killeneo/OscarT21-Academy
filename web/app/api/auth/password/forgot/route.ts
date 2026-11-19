import { afterResponse } from "@/lib/auth/background";
import { fail, hasSameOrigin, ok, parseEmail, parseLocale, readJson } from "@/lib/auth/http";
import { sendPasswordResetEmail } from "@/lib/auth/mailer";
import { allow, allowPerIp, hashKey } from "@/lib/auth/rate-limit";
import { issueToken } from "@/lib/auth/tokens";
import { findUserByEmail } from "@/lib/auth/users";

/** Always answers the same way, so it cannot be used to discover which e-mails are registered. */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allowPerIp(req, "forgot", 10, 3600))) return fail("rate_limited", 429);
    const body = await readJson(req);
    const email = parseEmail(body?.email);
    if (!email) return fail("invalid_input", 400);
    if (!(await allow(`forgot:email:${hashKey(email)}`, 3, 3600))) return ok(); // silently throttled

    // Looking the account up, issuing the token and sending the mail all happen after the response, so the answer
    // takes the same time whether or not the address has an account.
    const lang = parseLocale(body?.lang);
    afterResponse("password reset e-mail", async () => {
      const user = await findUserByEmail(email);
      if (user && user.status === "active") await sendPasswordResetEmail(email, lang, await issueToken(user.id, "reset_password"));
    });
    return ok();
  } catch (err) {
    console.error("forgot password failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
