import { siteUrl } from "@/lib/site";

/** Self-service roles. `moderator` and `admin` are never assignable through public endpoints. */
export const SELF_ROLES = ["parent", "specialist", "organization"] as const;
export type SelfRole = (typeof SELF_ROLES)[number];
export const DEFAULT_ROLE: SelfRole = "parent";

/** Version of the personal-data consent text the user agreed to (bump when the policy changes). */
export const CONSENT_VERSION = "2026-11-draft";

export function isSelfRole(value: unknown): value is SelfRole {
  return typeof value === "string" && (SELF_ROLES as readonly string[]).includes(value);
}

export const isProduction = process.env.NODE_ENV === "production";

/** `__Host-` cookies require Secure + Path=/ + no Domain, so they are used only in production (HTTPS). */
export const SESSION_COOKIE = isProduction ? "__Host-session" : "session";
/**
 * Short-lived cookie holding the OAuth state + PKCE verifier. `__Host-` in production: a sibling subdomain cannot
 * plant its own state/verifier (cookie tossing) to log the victim into an attacker's account.
 */
export const GOOGLE_COOKIE = isProduction ? "__Host-google_oauth" : "google_oauth";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
/** A session not used for this long ends even before SESSION_TTL_SECONDS (absolute lifetime). */
export const SESSION_IDLE_SECONDS = 60 * 60 * 24 * 7;
/** `last_seen_at` is written at most this often, so ordinary page views do not each cost a database write. */
export const SESSION_TOUCH_SECONDS = 60 * 10;
/** Device cookie: marks a browser that signed in to an account before (rate-limit budget only, not a credential). */
export const DEVICE_COOKIE = isProduction ? "__Host-device" : "device";
export const DEVICE_TTL_SECONDS = 60 * 60 * 24 * 180;

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${siteUrl}/api/auth/google/callback` };
}

export function telegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botToken || !botUsername) return null;
  return { botToken, botUsername };
}

/** Which providers are configured, safe to pass to client components (no secrets). */
export function providerAvailability() {
  return { google: googleConfig() !== null, telegramBot: telegramConfig()?.botUsername ?? null };
}
