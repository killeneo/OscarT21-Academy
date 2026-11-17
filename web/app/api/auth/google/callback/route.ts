import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CONSENT_VERSION, DEFAULT_ROLE, GOOGLE_COOKIE, googleConfig, isSelfRole, type SelfRole } from "@/lib/auth/config";
import { clientIp, parseLocale, safeNextPath } from "@/lib/auth/http";
import { allow } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { findOrCreateOAuthUser } from "@/lib/auth/users";
import { siteUrl } from "@/lib/site";

type Pending = { state: string; verifier: string; role: SelfRole; lang: string; next: string; consent: boolean };

function readPending(raw: string | undefined): Pending | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.state !== "string" || typeof v.verifier !== "string") return null;
    return {
      state: v.state,
      verifier: v.verifier,
      role: isSelfRole(v.role) ? v.role : DEFAULT_ROLE,
      lang: typeof v.lang === "string" ? v.lang : "ru",
      next: typeof v.next === "string" ? v.next : "",
      consent: v.consent === true,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const jar = await cookies();
  const pending = readPending(jar.get(GOOGLE_COOKIE)?.value);
  jar.set(GOOGLE_COOKIE, "", { path: "/api/auth/google", maxAge: 0 }); // single use
  const lang = parseLocale(pending?.lang);
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/${lang}/login?error=${error}`, siteUrl));

  const config = googleConfig();
  if (!config) return toLogin("not_configured");

  const params = new URL(req.url).searchParams;
  if (params.get("error")) return toLogin("google_denied");
  const code = params.get("code");
  const state = params.get("state");
  if (!pending || !code || !state || state !== pending.state) return toLogin("google_failed");

  try {
    if (!(await allow(`google:ip:${clientIp(req)}`, 30, 900))) return toLogin("rate_limited");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: pending.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) return toLogin("google_failed");
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return toLogin("google_failed");

    // Profile comes straight from Google over TLS with the token we just obtained.
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!infoRes.ok) return toLogin("google_failed");
    const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
    if (!info.sub) return toLogin("google_failed");

    const result = await findOrCreateOAuthUser(
      "google",
      info.sub,
      {
        email: typeof info.email === "string" ? info.email : null,
        emailVerified: info.email_verified === true,
        displayName: typeof info.name === "string" ? info.name : "",
      },
      pending.role,
      pending.consent ? CONSENT_VERSION : null,
    );
    if (!result.ok) return toLogin(result.reason === "consent_required" ? "consent_required" : "account_suspended");

    await createSession(result.userId);
    return NextResponse.redirect(new URL(safeNextPath(pending.next, lang), siteUrl));
  } catch (err) {
    console.error("google callback failed:", err instanceof Error ? err.message : "unknown error");
    return toLogin("google_failed");
  }
}
