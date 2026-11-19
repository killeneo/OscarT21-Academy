import { CONSENT_VERSION, DEFAULT_ROLE, isSelfRole } from "@/lib/auth/config";
import { clientIp, fail, hasSameOrigin, ok, parseDisplayName, parseEmail, parseLocale, readJson } from "@/lib/auth/http";
import { sendAccountExistsEmail, sendVerificationEmail } from "@/lib/auth/mailer";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { allow } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";
import { createPasswordUser } from "@/lib/auth/users";

export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allow(`register:ip:${clientIp(req)}`, 10, 3600))) return fail("rate_limited", 429);

    const body = await readJson(req);
    const email = parseEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : null;
    const displayName = parseDisplayName(body?.displayName);
    const role = body?.role === undefined ? DEFAULT_ROLE : body.role;
    if (!email || password === null || displayName === null || !isSelfRole(role)) return fail("invalid_input", 400);

    // Registration requires explicit consent to personal-data processing.
    if (body?.consent !== true) return fail("consent_required", 400);

    const policy = checkPasswordPolicy(password, email);
    if (policy) return fail(policy, 400);

    const userId = await createPasswordUser({ email, passwordHash: await hashPassword(password), displayName, role, consentVersion: CONSENT_VERSION });
    if (!userId) {
      // Same answer as for a new account, so this form cannot be used to find out which e-mails are registered.
      // The real owner is told by e-mail; no session is created.
      try {
        await sendAccountExistsEmail(email, parseLocale(body?.lang));
      } catch (err) {
        console.error("account-exists e-mail failed:", err instanceof Error ? err.message : "unknown error");
      }
      return ok({ user: { email, displayName, role } }, 201);
    }

    await createSession(userId);
    // E-mail confirmation is best effort: a mail failure must not block the new account.
    try {
      await sendVerificationEmail(email, parseLocale(body?.lang), await issueToken(userId, "verify_email"));
    } catch (err) {
      console.error("verification e-mail failed:", err instanceof Error ? err.message : "unknown error");
    }
    return ok({ user: { email, displayName, role } }, 201);
  } catch (err) {
    console.error("register failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
