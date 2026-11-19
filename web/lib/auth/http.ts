import { NextResponse } from "next/server";
import { defaultLocale, hasLocale, type Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";
import { behindTrustedProxy } from "./client-ip";

export type ErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "weak_password"
  | "common_password"
  | "email_unverified"
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
 * cross-site and fetch() POSTs, and it must match the configured public origin or the host the request was
 * addressed to. `X-Forwarded-Host` is believed only behind a trusted proxy (see client-ip.ts); otherwise any
 * client could send a matching pair of Origin and X-Forwarded-Host.
 */
export function hasSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (new URL(siteUrl).host === originHost) return true;
  const forwarded = behindTrustedProxy() ? req.headers.get("x-forwarded-host") : null;
  const host = forwarded ?? req.headers.get("host");
  return host !== null && host === originHost;
}

const MAX_BODY_CHARS = 8 * 1024;
const MAX_BODY_BYTES = MAX_BODY_CHARS * 4;

/**
 * Reads at most `maxBytes` of a body as UTF-8, or returns null once it grows past that. Streaming matters for
 * chunked uploads without Content-Length: `req.text()` would buffer an arbitrarily large body before any check.
 */
export async function readLimitedText(req: Request, maxBytes: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Parses a small JSON object body; returns null for wrong content type, oversize or invalid JSON. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  // Reject an oversize body from its declared length before reading any of it.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await readLimitedText(req, MAX_BODY_BYTES);
  if (text === null || text.length > MAX_BODY_CHARS) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Control characters are never valid in these fields; NUL in particular makes PostgreSQL reject the query (500).
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) && !CONTROL_RE.test(email) ? email : null;
}

export function parseDisplayName(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length <= 80 && !CONTROL_RE.test(name) ? name : null;
}

export function parseLocale(value: unknown): Locale {
  return typeof value === "string" && hasLocale(value) ? value : defaultLocale;
}

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export function safeNextPath(value: unknown, lang: Locale): string {
  const fallback = `/${lang}`;
  if (typeof value !== "string" || value.length > 200) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  return value;
}
