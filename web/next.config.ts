import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Next.js emits small inline bootstrap scripts, and pages are statically rendered, so a
 * per-request nonce is not possible: 'unsafe-inline' is kept for scripts. The policy still blocks the things
 * that matter most: foreign script hosts, plugins (object-src), clickjacking (frame-ancestors), <base> hijacking
 * and form posts to other sites (Google's sign-in page is the one allowed form redirect).
 * No third-party script runs on regular pages. Telegram's login widget (script, iframe, popup) is allowed only on
 * /[lang]/telegram, a page without password fields. Dev needs eval + websockets for hot reload.
 */
function buildCsp({ telegram }: { telegram: boolean }) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${telegram ? " https://telegram.org" : ""}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${telegram ? " https://telegram.org https://t.me" : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    `frame-src ${telegram ? "https://oauth.telegram.org" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    // The Google sign-up form posts to our own route, which redirects to Google; form-action also covers that hop.
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp({ telegram: false }) },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Dev only: lets the site be opened from a phone or another PC on the home network; without this the
  // dev server blocks its own scripts for such hosts and the page never becomes interactive.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
  // Every language has its own page; the bare root goes to the default locale.
  async redirects() {
    return [{ source: "/", destination: "/ru", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Later entries override earlier ones for the same header key.
      {
        source: "/:lang/telegram",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp({ telegram: true }) },
          // The Telegram login popup must be able to talk back to this window.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
