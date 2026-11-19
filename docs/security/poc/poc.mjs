// Non-destructive PoCs against a LOCAL server and its dev database. Only rows on @sectest.invalid are created/removed.
// Usage: node --env-file=web/.env.local poc.mjs <BASE_URL> <web dir>
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const [BASE = "http://localhost:3100", WEB] = process.argv.slice(2);
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("local targets only");
const pg = createRequire(path.join(WEB, "package.json"))("pg");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const DOMAIN = "sectest.invalid";
const PASSWORD = "violet tram over the river 42";
const uniq = () => `poc-${randomBytes(5).toString("hex")}@${DOMAIN}`;
const sha256 = (v) => createHash("sha256").update(v).digest();
const resetLimits = () => db.query("DELETE FROM rate_limits");
const out = {};

async function post(p, body, { cookie, origin = BASE, headers = {} } = {}) {
  const res = await fetch(BASE + p, {
    method: "POST",
    redirect: "manual",
    headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const set = res.headers.getSetCookie?.() ?? [];
  const session = set.map((c) => c.split(";")[0]).find((c) => /^(__Host-)?session=.+/.test(c));
  return { status: res.status, text, set, session, headers: res.headers };
}
const register = async (extra = {}) => {
  const email = uniq();
  const r = await post("/api/auth/register", { email, password: PASSWORD, consent: true, lang: "ru", ...extra });
  return { email, ...r };
};
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

try {
  // 1. Shared per-IP bucket when no trusted IP header is configured (production build, self-hosted).
  await resetLimits();
  const victim = await register();
  await resetLimits();
  const flood = [];
  for (let i = 0; i < 30; i++) flood.push((await post("/api/auth/login", { email: uniq(), password: "wrong password 123" })).status);
  const victimLogin = await post("/api/auth/login", { email: victim.email, password: PASSWORD }, { headers: { "X-Real-IP": "203.0.113.77" } });
  await resetLimits();
  const signups = [];
  for (let i = 0; i < 10; i++) signups.push((await register()).status);
  const legitSignup = (await register()).status;
  out.sharedIpBucket = { floodStatuses: [...new Set(flood)], victimLoginAfterFlood: victimLogin.status, signupStatuses: [...new Set(signups)], eleventhSignup: legitSignup };

  // 2. Race: one reset token consumed by 20 parallel requests.
  await resetLimits();
  const u2 = await register();
  const id2 = (await db.query("SELECT id FROM users WHERE email = $1", [u2.email])).rows[0].id;
  const tok = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1,'reset_password',$2, now() + interval '1 hour')", [id2, sha256(tok)]);
  const resets = await Promise.all(Array.from({ length: 20 }, (_, i) => post("/api/auth/password/reset", { token: tok, password: `parallel new passphrase ${i}` })));
  out.resetRace = { ok200: resets.filter((r) => r.status === 200).length, statuses: [...new Set(resets.map((r) => r.status))] };

  // 3. Race: 10 parallel sign-ups with the same e-mail.
  await resetLimits();
  const same = uniq();
  const regs = await Promise.all(Array.from({ length: 10 }, () => post("/api/auth/register", { email: same, password: PASSWORD, consent: true })));
  const count = (await db.query("SELECT count(*)::int AS n FROM users WHERE email = $1", [same])).rows[0].n;
  out.registerRace = { users: count, sessionsIssued: regs.filter((r) => r.session).length, statuses: [...new Set(regs.map((r) => r.status))] };

  // 4. Race: 20 parallel wrong logins against one account (per-account limit 8 / 15 min).
  await resetLimits();
  const u4 = await register();
  await resetLimits();
  const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => post("/api/auth/login", { email: u4.email, password: `wrong-${i}-password` })));
  out.limiterRace = { notLimited: burst.filter((r) => r.status !== 429).length, limited: burst.filter((r) => r.status === 429).length };

  // 5. Timing of /password/forgot for an existing vs an unknown address (limits reset before every sample).
  const known = await register();
  const sample = async (email) => {
    const t = [];
    for (let i = 0; i < 15; i++) {
      await resetLimits();
      const s = performance.now();
      await post("/api/auth/password/forgot", { email });
      t.push(performance.now() - s);
    }
    return median(t);
  };
  await sample(known.email); // warm-up
  const tKnown = await sample(known.email);
  const tUnknown = await sample(uniq());
  out.forgotTiming = { knownMs: +tKnown.toFixed(1), unknownMs: +tUnknown.toFixed(1), diffMs: +(tKnown - tUnknown).toFixed(1) };

  // 6. Open redirect via ?next= for a signed-in visitor (server-side redirect on /login).
  await resetLimits();
  const u6 = await register();
  const payloads = ["//evil.example/x", "/\\evil.example", "/%5Cevil.example", "/%2F%2Fevil.example", "https://evil.example", "/\t/evil.example", "/ru@evil.example", "/%09/evil.example", "/　/evil.example", "javascript:alert(1)"];
  out.openRedirect = {};
  for (const p of payloads) {
    const res = await fetch(`${BASE}/ru/login?next=${encodeURIComponent(p)}`, { redirect: "manual", headers: { Cookie: u6.session } });
    const loc = res.headers.get("location") ?? "";
    const target = loc ? new URL(loc, BASE) : null;
    out.openRedirect[JSON.stringify(p)] = `${res.status} → ${target ? target.host + target.pathname : "(none)"}`;
  }

  // 7. Personalised data must not end up in shared/cached output (Cache Components / PPR).
  const html = async (p, cookie) => {
    const res = await fetch(BASE + p, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
    return { status: res.status, cc: res.headers.get("cache-control"), body: await res.text() };
  };
  out.cache = {};
  for (const p of ["/ru", "/ru/account", "/ru/specialists", "/ru/onboarding"]) {
    const mine = await html(p, u6.session);
    const anon = await html(p);
    out.cache[p] = { signedIn: `${mine.status} cc=${mine.cc}`, showsOwnEmail: mine.body.includes(u6.email), anon: `${anon.status} cc=${anon.cc}`, anonLeaksEmail: anon.body.includes(u6.email) };
  }

  // 8. Response headers and cookie flags.
  const r8 = await post("/api/auth/login", { email: u6.email, password: PASSWORD });
  out.cookies = r8.set.map((c) => c.replace(/=([^;]{6})[^;]*/, "=$1…"));
  const page = await fetch(`${BASE}/ru`);
  out.headers = Object.fromEntries(["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy", "cross-origin-opener-policy", "x-powered-by", "access-control-allow-origin", "server"].map((h) => [h, page.headers.get(h)]));

  // 9. Host / X-Forwarded-Host reflection and the Origin check.
  const evilHost = await fetch(`${BASE}/ru`, { headers: { "X-Forwarded-Host": "evil.example" } });
  const evilBody = await evilHost.text();
  const spoofed = await post("/api/auth/login", { email: uniq(), password: "x".repeat(12) }, { origin: "http://evil.example", headers: { "X-Forwarded-Host": "evil.example" } });
  const reset = await post("/api/auth/password/forgot", { email: u6.email }, { headers: { "X-Forwarded-Host": "evil.example" } });
  out.hostHeader = { reflectedInPage: evilBody.includes("evil.example"), loginWithForeignOriginAndMatchingXFH: spoofed.status, forgotWithXFH: reset.status };

  // 10. Path normalisation: protected pages and APIs reached by alternative spellings.
  out.paths = {};
  for (const p of ["/ru/account", "/ru/account/", "//ru/account", "/RU/account", "/ru/./account", "/ru/%61ccount", "/api/auth/me", "/api/auth/../auth/me", "/api/auth/me/", "/API/auth/me"]) {
    const res = await fetch(BASE + p, { redirect: "manual" });
    const body = await res.text();
    out.paths[p] = `${res.status}${res.headers.get("location") ? " → " + res.headers.get("location") : ""}${/"email"/.test(body) ? " LEAK" : ""}`;
  }

  // 11. Prototype pollution / mass assignment through JSON keys.
  await resetLimits();
  const ppEmail = uniq();
  const pp = await post("/api/auth/register", `{"email":"${ppEmail}","password":"${PASSWORD}","consent":true,"__proto__":{"role":"admin"},"constructor":{"prototype":{"role":"admin"}}}`);
  const ppRole = (await db.query("SELECT role FROM users WHERE email = $1", [ppEmail])).rows[0]?.role;
  out.prototypePollution = { status: pp.status, storedRole: ppRole };

  // 12. Error disclosure.
  const bad = await post("/api/auth/login", "{not json");
  const deep = await post("/api/auth/login", "[".repeat(5000) + "]".repeat(5000));
  const num = await post("/api/profile/onboarding", { city: "tashkent", priceFrom: 1e308 }, { cookie: u6.session });
  out.errors = { badJson: `${bad.status} ${bad.text}`, deepNesting: `${deep.status} ${deep.text}`, hugeNumber: `${num.status} ${num.text}` };

  // 13. Race on the specialist review state machine: parallel submit / draft edits on one profile.
  await resetLimits();
  const spec = await register({ role: "specialist" });
  await db.query("UPDATE users SET email_verified_at = now() WHERE email = $1", [spec.email]);
  const slug = (await db.query("SELECT slug FROM specialist_categories ORDER BY slug LIMIT 1")).rows[0].slug;
  const base = { displayName: "Race", category: slug, city: "tashkent", formats: ["online"], experienceYears: 2, priceFrom: 1, priceTo: 2, ageMin: 1, ageMax: 5 };
  await post("/api/profile/onboarding", { ...base, headline: "initial draft", submit: false }, { cookie: spec.session });
  const mixed = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      post("/api/profile/onboarding", { ...base, headline: i % 2 ? `submit ${i}` : `draft ${i}`, submit: i % 2 === 1 }, { cookie: spec.session }),
    ),
  );
  const row = (await db.query("SELECT verification_status, headline FROM specialist_profiles WHERE user_id = (SELECT id FROM users WHERE email = $1)", [spec.email])).rows[0];
  out.stateRace = { statuses: mixed.map((r) => r.status).join(","), final: row, consistent: row.verification_status === "submitted" ? row.headline.startsWith("submit") : row.headline.startsWith("draft") };
} finally {
  await db.query("DELETE FROM users WHERE email LIKE $1", [`%@${DOMAIN}`]);
  await resetLimits();
  await db.end();
}
console.log(JSON.stringify(out, null, 2));
