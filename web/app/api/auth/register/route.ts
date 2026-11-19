import { DEFAULT_ROLE, isSelfRole } from "@/lib/auth/config";
import { afterResponse } from "@/lib/auth/background";
import { fail, hasSameOrigin, ok, parseEmail, parseLocale, readJson } from "@/lib/auth/http";
import { sendAccountExistsEmail, sendSignupEmail } from "@/lib/auth/mailer";
import { allow, allowPerIp, hashKey } from "@/lib/auth/rate-limit";
import { createSignupRequest } from "@/lib/auth/signup";
import { findUserByEmail } from "@/lib/auth/users";

/**
 * Sign-up, step 1: takes only an e-mail address (plus the role to preselect on the next step and the visitor's
 * consent to process the address) and mails a link. The answer, its headers and its timing are the same whether
 * or not the address already has an account: the lookup and the mail happen after the response, no session is
 * created, and nothing is stored for a taken address. The account itself is created by /register/complete.
 */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    if (!(await allowPerIp(req, "register", 10, 3600))) return fail("rate_limited", 429);

    const body = await readJson(req);
    const email = parseEmail(body?.email);
    const role = body?.role === undefined ? DEFAULT_ROLE : body.role;
    if (!email || !isSelfRole(role)) return fail("invalid_input", 400);
    if (body?.consent !== true) return fail("consent_required", 400);
    const lang = parseLocale(body?.lang);

    // At most 3 mails per address per day, silently: the form cannot be used to flood someone's inbox.
    if (!(await allow(`register:email:${hashKey(email)}`, 3, 86400))) return ok({}, 202);

    afterResponse("sign-up e-mail", async () => {
      if (await findUserByEmail(email)) {
        // The owner is told someone tried; at most one such notice per address per day.
        if (await allow(`register:exists:${hashKey(email)}`, 1, 86400)) await sendAccountExistsEmail(email, lang);
        return;
      }
      await sendSignupEmail(email, lang, await createSignupRequest(email), role);
    });
    return ok({}, 202);
  } catch (err) {
    console.error("register failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
