import { NextResponse } from "next/server";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n";

export type ErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "rate_limited"
  | "forbidden_origin"
  | "not_configured"
  | "telegram_invalid"
  | "account_suspended"
  | "consent_required"
  | "invalid_token"
  | "profile_locked"
  | "unauthorized"
  | "server_error";

export function ok(data: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(code: ErrorCode, status: number) {
  return NextResponse.json({ ok: false, error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * CSRF defence for state-changing routes (on top of SameSite=Lax cookies): browsers always send Origin on
 * cross-site and fetch() POSTs, and it must match the host the request was addressed to.
 */
export function hasSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Best-effort client IP. Only meaningful behind a trusted reverse proxy that overwrites X-Forwarded-For. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || "unknown";
}

const MAX_BODY_CHARS = 8 * 1024;

/** Parses a small JSON object body; returns null for wrong content type, oversize or invalid JSON. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

export function parseDisplayName(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length <= 80 ? name : null;
}

export function parseLocale(value: unknown): Locale {
  return typeof value === "string" && hasLocale(value) ? value : defaultLocale;
}

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export function safeNextPath(value: unknown, lang: Locale): string {
  const fallback = `/${lang}/specialists`;
  if (typeof value !== "string" || value.length > 200) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  return value;
}
