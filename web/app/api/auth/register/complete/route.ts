import { CONSENT_VERSION, DEFAULT_ROLE, isSelfRole } from "@/lib/auth/config";
import { trustDevice } from "@/lib/auth/devices";
import { fail, hasSameOrigin, ok, parseDisplayName, readJson } from "@/lib/auth/http";
import { PasswordHashBusyError, checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { allowPerIp } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { completeSignup, peekSignup } from "@/lib/auth/signup";

/**
 * Sign-up, step 2: the person who opened the mailed link sets the password, name and role and gives their own
 * consent. The e-mail comes from the link, never from the request, and counts as verified.
 */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allowPerIp(req, "register-complete", 20, 3600))) return fail("rate_limited", 429);

    const body = await readJson(req);
    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : null;
    const displayName = parseDisplayName(body?.displayName);
    const role = body?.role === undefined ? DEFAULT_ROLE : body.role;
    if (!token || password === null || displayName === null || !isSelfRole(role)) return fail("invalid_input", 400);
    if (body?.consent !== true) return fail("consent_required", 400);

    const found = await peekSignup(token);
    if (!found) return fail("invalid_token", 400);
    const policy = checkPasswordPolicy(password, found.email);
    if (policy) return fail(policy, 400);

    // Hash before using up the link: if hashing is refused as busy, the link still works for a retry.
    const passwordHash = await hashPassword(password);
    const result = await completeSignup(token, { passwordHash, displayName, role, consentVersion: CONSENT_VERSION });
    if (!result.ok) return result.reason === "account_exists" ? fail("account_exists", 409) : fail("invalid_token", 400);

    await createSession(result.userId);
    await trustDevice(result.userId);
    return ok({ user: { email: result.email, displayName, role } }, 201);
  } catch (err) {
    if (err instanceof PasswordHashBusyError) return fail("rate_limited", 503);
    console.error("register complete failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
