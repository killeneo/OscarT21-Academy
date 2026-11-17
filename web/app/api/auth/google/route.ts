import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { DEFAULT_ROLE, GOOGLE_COOKIE, googleConfig, isProduction, isSelfRole } from "@/lib/auth/config";
import { parseLocale, safeNextPath } from "@/lib/auth/http";
import { siteUrl } from "@/lib/site";

/** Starts the Google authorization-code flow with PKCE and a random `state` kept in a short-lived cookie. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const lang = parseLocale(params.get("lang"));
  const config = googleConfig();
  if (!config) return NextResponse.redirect(new URL(`/${lang}/login?error=not_configured`, siteUrl));

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const role = isSelfRole(params.get("role")) ? params.get("role") : DEFAULT_ROLE;
  const next = safeNextPath(params.get("next"), lang);
  // Consent is given on the sign-up page and travels with the OAuth round trip in the short-lived cookie.
  const consent = params.get("consent") === "1";

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

  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_COOKIE, JSON.stringify({ state, verifier, role, lang, next, consent }), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax", // must be sent on the top-level redirect back from Google
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
