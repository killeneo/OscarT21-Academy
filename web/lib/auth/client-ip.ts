/**
 * Client IP for rate limiting, read only from a header that our own infrastructure overwrites.
 *
 * Every request header is written by the client unless a proxy in front of the app replaces it, so no header is
 * trusted by default (an attacker could otherwise send a new `X-Real-IP` on every request and get a fresh
 * rate-limit bucket each time):
 *  - on Vercel (`VERCEL=1`) the platform overwrites `x-vercel-forwarded-for`;
 *  - elsewhere set `TRUSTED_IP_HEADER` to the header your reverse proxy overwrites (e.g. `x-real-ip`), or to
 *    `x-forwarded-for`, whose RIGHT-most entry (appended by that proxy) is used.
 * Without either, all clients share one "unknown" bucket: limits still hold, but they are global, so configure it.
 *
 * Kept free of framework imports so it can be unit-tested with plain Node.
 */
export function trustedIpHeader(env: Record<string, string | undefined> = process.env): string | null {
  const configured = env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (configured) return configured;
  return env.VERCEL === "1" ? "x-vercel-forwarded-for" : null;
}

let warned = false;

export function clientIp(req: Request, env: Record<string, string | undefined> = process.env): string {
  const header = trustedIpHeader(env);
  if (!header) {
    if (env.NODE_ENV === "production" && !warned) {
      warned = true;
      console.warn("TRUSTED_IP_HEADER is not set: per-IP rate limits are shared by all clients (see .env.example)");
    }
    return "unknown";
  }
  // A proxy appends the address it saw, so the last entry is the one it wrote; earlier entries came from the client.
  const value = req.headers
    .get(header)
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .at(-1);
  return value ? value.slice(0, 64) : "unknown";
}
