import { CONSENT_VERSION, DEFAULT_ROLE, isSelfRole, telegramConfig } from "@/lib/auth/config";
import { fail, hasSameOrigin, ok, readJson } from "@/lib/auth/http";
import { allowPerIp, claimOnce } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { verifyTelegramAuth } from "@/lib/auth/telegram";
import { findOrCreateOAuthUser } from "@/lib/auth/users";

export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    const config = telegramConfig();
    if (!config) return fail("not_configured", 501);
    if (!(await allowPerIp(req, "telegram", 30, 900))) return fail("rate_limited", 429);

    const body = await readJson(req);
    const role = body?.role === undefined ? DEFAULT_ROLE : body.role;
    if (!body || !isSelfRole(role)) return fail("invalid_input", 400);

    const verdict = verifyTelegramAuth(body.auth, config.botToken);
    if (!verdict.ok) return fail("telegram_invalid", 401);

    // A signed payload is valid for 5 minutes; accept each (user, auth_date) pair only once.
    if (!(await claimOnce(`telegram:${verdict.id}:${verdict.authDate}`, 600))) return fail("telegram_invalid", 401);

    const result = await findOrCreateOAuthUser(
      "telegram",
      verdict.id,
      { email: null, emailVerified: false, displayName: verdict.displayName },
      role,
      body.consent === true ? CONSENT_VERSION : null,
    );
    if (!result.ok) return result.reason === "consent_required" ? fail("consent_required", 400) : fail("account_suspended", 403);

    await createSession(result.userId);
    return ok();
  } catch (err) {
    console.error("telegram login failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
