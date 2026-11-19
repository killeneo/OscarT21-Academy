/**
 * Client IP for rate limiting, read only from a header that our own infrastructure overwrites.
 *
 * Every request header is written by the client unless a proxy in front of the app replaces it, so no header is
 * trusted by default (an attacker could otherwise send a new `X-Real-IP` on every request and get a fresh
 * rate-limit bucket each time):
 *  - on Vercel (`VERCEL=1`) the platform overwrites `x-vercel-forwarded-for`;
 *  - elsewhere set `TRUSTED_IP_HEADER` to the header your reverse proxy overwrites (e.g. `x-real-ip`), or to
 *    `x-forwarded-for`, whose RIGHT-most entry (appended by that proxy) is used;
 *  - `TRUSTED_IP_HEADER=none`: there is no proxy to trust, so per-IP limits are switched off (per-account and
 *    per-e-mail limits and the password-hashing gate still apply).
 *
 * In production the choice is mandatory. Sharing one bucket between all clients would let anyone lock every user
 * out with a handful of requests, so an unconfigured production server refuses auth requests instead
 * (TrustedProxyConfigError) and says why in the log. In development all clients share a "local" bucket.
 *
 * Kept free of framework imports so it can be unit-tested with plain Node.
 */
type Env = Record<string, string | undefined>;

export class TrustedProxyConfigError extends Error {
  constructor() {
    super("TRUSTED_IP_HEADER must be set in production outside Vercel (a header name, or 'none'): see web/.env.example");
  }
}

export type IpSource = { kind: "header"; header: string } | { kind: "none" } | { kind: "local" };

export function ipSource(env: Env = process.env): IpSource {
  const configured = env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (configured === "none") return { kind: "none" };
  if (configured) return { kind: "header", header: configured };
  if (env.VERCEL === "1") return { kind: "header", header: "x-vercel-forwarded-for" };
  if (env.NODE_ENV === "production") throw new TrustedProxyConfigError();
  return { kind: "local" };
}

/** True when a proxy we control sits in front of the app, so its forwarding headers can be believed. */
export function behindTrustedProxy(env: Env = process.env): boolean {
  try {
    return ipSource(env).kind === "header";
  } catch {
    return false;
  }
}

/** The client address, "unknown" when the trusted header is missing, or null when per-IP limits are off. */
export function clientIp(req: Request, env: Env = process.env): string | null {
  const source = ipSource(env);
  if (source.kind === "none") return null;
  if (source.kind === "local") return "local";
  // A proxy appends the address it saw, so the last entry is the one it wrote; earlier entries came from the client.
  const value = req.headers
    .get(source.header)
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .at(-1);
  return value ? value.slice(0, 64) : "unknown";
}
