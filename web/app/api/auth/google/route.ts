import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_ROLE, GOOGLE_COOKIE, googleConfig, isProduction, isSelfRole } from "@/lib/auth/config";
import { hasSameOrigin, parseLocale, readLimitedText, safeNextPath } from "@/lib/auth/http";
import { siteUrl } from "@/lib/site";

/**
 * Starts the Google authorization-code flow with PKCE and a random `state` kept in a short-lived cookie.
 * `status` is 303 for the form POST so the browser follows with a GET.
 */
function start(params: URLSearchParams, consent: boolean, status: 302 | 303) {
  const lang = parseLocale(params.get("lang"));
  const config = googleConfig();
  if (!config) return NextResponse.redirect(new URL(`/${lang}/login?error=not_configured`, siteUrl), status);

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const role = isSelfRole(params.get("role")) ? params.get("role") : DEFAULT_ROLE;
  const next = safeNextPath(params.get("next"), lang);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url, status);
  res.cookies.set(GOOGLE_COOKIE, JSON.stringify({ state, verifier, role, lang, next, consent }), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax", // must be sent on the top-level redirect back from Google
    path: "/", // required by the __Host- prefix
    maxAge: 600,
  });
  return res;
}

/**
 * Sign-in link (login page). It never records consent to personal-data processing: a link can be sent to anyone,
 * so a `consent=1` in it would create an account the person never agreed to. A first sign-in through here is
 * answered with `consent_required` and the person is sent to the sign-up page.
 */
export async function GET(req: Request) {
  return start(new URL(req.url).searchParams, false, 302);
}

/**
 * Sign-up form (register page) with the consent checkbox. A same-origin form POST is the only way to pass consent:
 * the Origin check stops another site from auto-submitting it for a visitor.
 */
export async function POST(req: Request) {
  const fallback = new URL(`/${defaultLang(req)}/register?error=forbidden_origin`, siteUrl);
  if (!hasSameOrigin(req)) return NextResponse.redirect(fallback, 303);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return NextResponse.redirect(fallback, 303);
  }
  const text = await readLimitedText(req, 4096);
  if (text === null) return NextResponse.redirect(fallback, 303);
  const params = new URLSearchParams(text);
  return start(params, params.get("consent") === "1", 303);
}

function defaultLang(req: Request) {
  return parseLocale(new URL(req.url).searchParams.get("lang"));
}
