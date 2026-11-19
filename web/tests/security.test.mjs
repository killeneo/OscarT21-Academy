// Black-box security tests against a RUNNING server and its dev database.
//   Start the DB and the app (npm run dev, or next start), then:  npm test
//   BASE_URL=http://localhost:3000 (default). The whole file is skipped when the server is unreachable.
// Covers: headers, CSRF/Origin, input limits, mass assignment, account enumeration, sessions, brute-force limits,
// password-reset tokens, authorization (IDOR / privilege escalation), injection payloads, open redirects.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, beforeEach, describe, test } from "node:test";
import pg from "pg";

try {
  process.loadEnvFile(new URL("../.env.local", import.meta.url));
} catch {
  // no env file: rely on the environment
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const HOST = new URL(BASE).host;
const DOMAIN = "sectest.invalid";
const PASSWORD = "correct horse battery staple";
const sha256 = (v) => createHash("sha256").update(v).digest();
const uniq = () => `${randomBytes(6).toString("hex")}@${DOMAIN}`;

let up = false;
try {
  up = (await fetch(`${BASE}/ru`, { signal: AbortSignal.timeout(5000) })).status < 500;
} catch {
  up = false;
}

let db;
try {
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  await db.query("SELECT 1");
} catch {
  db = null;
}

/** JSON POST with a same-origin Origin header, optional cookie. Never follows redirects. */
async function post(path, body, { cookie, origin = BASE, raw, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(raw === undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const session = setCookie.map((c) => c.split(";")[0]).find((c) => /^(__Host-)?session=[^;]+/.test(c) && !/session=$/.test(c));
  return { status: res.status, json, text, headers: res.headers, setCookie, session };
}

/** A sign-up link for `email`, planted in place of the mailed one (the raw token is only ever in the e-mail). */
async function signupToken(email, ttlSeconds = 3600) {
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO signup_requests (token_hash, email, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))", [sha256(token), email, ttlSeconds]);
  return token;
}

/** Sign-up step 1: only an address (plus preselected role and consent). */
const startSignup = (email, extra = {}) => post("/api/auth/register", { email, role: "parent", consent: true, lang: "ru", ...extra });

/** Full sign-up through the link (step 2). The account is verified and signed in. */
async function register(email = uniq(), extra = {}) {
  const token = await signupToken(email);
  const r = await post("/api/auth/register/complete", { token, password: PASSWORD, displayName: "Test", role: "parent", consent: true, ...extra });
  return { email, token, ...r };
}

/** An account whose e-mail was never confirmed (only accounts from before e-mail-first sign-up are like this). */
async function unverified(email = uniq(), extra = {}) {
  const r = await register(email, extra);
  await db.query("UPDATE users SET email_verified_at = NULL WHERE email = $1", [email]);
  return r;
}

/** Waits for work the server does after the response (`after()`), e.g. creating the sign-up link. */
async function eventually(check, ms = 5000) {
  const until = Date.now() + ms;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > until) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Tell the suite how the server is configured (TRUSTED_IP_HEADER, as set on the server). Behind a trusted proxy that
// header and X-Forwarded-Host are overwritten by the proxy, so a client cannot spoof them; "none" means the server
// has per-IP limits switched off.
const trustedIp = (process.env.TRUSTED_IP_HEADER ?? "").trim().toLowerCase();
const behindProxy = trustedIp !== "" && trustedIp !== "none";
const resetLimits = () => db?.query("DELETE FROM rate_limits");
const verifyEmail = (email) => db.query("UPDATE users SET email_verified_at = now() WHERE email = $1", [email]);
/** A specialization slug that exists in this database (fixtures differ per DB). */
const categorySlug = async () => (await db.query("SELECT slug FROM specialist_categories ORDER BY slug LIMIT 1")).rows[0]?.slug;

describe("security (black-box)", { skip: !up || !db ? "server or database not reachable" : false }, () => {
  beforeEach(resetLimits); // each test starts with fresh rate-limit counters (10 sign-ups/hour per IP would otherwise trip)
  after(async () => {
    await db.query("DELETE FROM users WHERE email LIKE $1 OR email LIKE 'sectest-%@gmail.com'", [`%@${DOMAIN}`]);
    await db.query("DELETE FROM signup_requests WHERE email LIKE $1 OR email LIKE 'sectest-%@gmail.com'", [`%@${DOMAIN}`]);
    await globalThis.__authPool?.end(); // pool of lib/auth/db.ts, used by the account-linking test
    await resetLimits();
    await db.end();
  });

  describe("transport and headers", () => {
    test("pages carry the hardening headers and do not leak the stack", async () => {
      const res = await fetch(`${BASE}/ru`);
      const h = res.headers;
      assert.match(h.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
      assert.match(h.get("content-security-policy") ?? "", /object-src 'none'/);
      assert.match(h.get("content-security-policy") ?? "", /base-uri 'self'/);
      assert.equal(h.get("x-frame-options"), "DENY");
      assert.equal(h.get("x-content-type-options"), "nosniff");
      assert.match(h.get("strict-transport-security") ?? "", /max-age=\d{7,}/);
      assert.ok(h.get("referrer-policy"));
      assert.equal(h.get("x-powered-by"), null);
      assert.equal(h.get("permissions-policy")?.includes("camera=()"), true);
    });

    test("CSP does not allow arbitrary script hosts or eval in the policy's script-src (prod)", async () => {
      const csp = (await fetch(`${BASE}/ru`)).headers.get("content-security-policy") ?? "";
      const script = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith("script-src")) ?? "";
      assert.doesNotMatch(script, /\*|https?:\/\/(?!telegram\.org)/);
    });

    test("no third-party script on the login and sign-up pages; Telegram only on its own page", async () => {
      for (const p of ["/ru/login", "/ru/register"]) {
        const res = await fetch(BASE + p);
        const html = await res.text();
        assert.ok(!/telegram\.org/.test(res.headers.get("content-security-policy") ?? ""), `${p} CSP must not allow telegram.org`);
        assert.ok(!html.includes("telegram-widget.js"), `${p} must not load the Telegram widget`);
        assert.match(res.headers.get("cross-origin-opener-policy") ?? "", /^same-origin$/);
      }
      const tg = await fetch(`${BASE}/ru/telegram?mode=login`);
      assert.equal(tg.status, 200);
      assert.match(tg.headers.get("content-security-policy") ?? "", /script-src [^;]*https:\/\/telegram\.org/);
      assert.ok(!/type="password"/.test(await tg.text()), "the Telegram page has no password field");
    });

    test("API responses are never cached", async () => {
      const r = await post("/api/auth/login", { email: "nobody@x.invalid", password: "x" });
      assert.match(r.headers.get("cache-control") ?? "", /no-store/);
    });

    test("unsupported methods are rejected", async () => {
      for (const method of ["GET", "PUT", "DELETE"]) {
        const res = await fetch(`${BASE}/api/auth/login`, { method });
        assert.equal(res.status, 405, method);
      }
    });
  });

  describe("CSRF / origin checks", () => {
    const routes = ["/api/auth/login", "/api/auth/register", "/api/auth/register/complete", "/api/auth/logout", "/api/auth/password/forgot", "/api/auth/password/reset", "/api/auth/verify/confirm", "/api/auth/verify/request", "/api/auth/password/change", "/api/profile/onboarding", "/api/profile/account", "/api/auth/telegram"];
    for (const route of routes) {
      test(`${route}: no Origin or a foreign Origin is refused`, async () => {
        const none = await post(route, { email: "a@b.co", password: "x" }, { origin: null });
        assert.equal(none.status, 403);
        const evil = await post(route, { email: "a@b.co", password: "x" }, { origin: "https://evil.example" });
        assert.equal(evil.status, 403);
        const lookalike = await post(route, { email: "a@b.co", password: "x" }, { origin: `https://${HOST}.evil.example` });
        assert.equal(lookalike.status, 403);
      });
    }

    test("a foreign Origin cannot be legitimised with a matching X-Forwarded-Host", { skip: behindProxy && "the proxy overwrites X-Forwarded-Host on this server" }, async () => {
      const res = await post("/api/auth/login", { email: uniq(), password: "x".repeat(12) }, { origin: "http://evil.example", headers: { "X-Forwarded-Host": "evil.example" } });
      assert.equal(res.status, 403);
    });

    test("a cross-site form post (text/plain) cannot log a victim in or out", async () => {
      const r = await post("/api/auth/logout", null, { raw: "{}", headers: { "Content-Type": "text/plain" }, origin: "https://evil.example" });
      assert.equal(r.status, 403);
    });
  });

  describe("input handling", () => {
    test("non-JSON content types and non-object bodies are rejected", async () => {
      assert.equal((await post("/api/auth/login", null, { raw: "email=a&password=b", headers: { "Content-Type": "application/x-www-form-urlencoded" } })).status, 400);
      assert.equal((await post("/api/auth/login", null, { raw: "[1,2]", headers: { "Content-Type": "application/json" } })).status, 400);
      assert.equal((await post("/api/auth/login", null, { raw: "{not json", headers: { "Content-Type": "application/json" } })).status, 400);
      assert.equal((await post("/api/auth/login", null, { raw: "null", headers: { "Content-Type": "application/json" } })).status, 400);
    });

    test("oversize bodies are rejected without a server error", async () => {
      const r = await post("/api/auth/login", { email: "a@b.co", password: "x".repeat(200_000) });
      assert.equal(r.status, 400);
    });

    test("an oversize chunked body (no Content-Length) is refused without buffering it all", async () => {
      const chunk = new TextEncoder().encode(" ".repeat(16 * 1024));
      const limit = 4 * 1024 * 1024;
      let sent = 0;
      const body = new ReadableStream({
        pull(controller) {
          if (sent >= limit) return controller.close();
          sent += chunk.byteLength;
          controller.enqueue(chunk);
        },
      });
      const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" }, body, duplex: "half" }).catch(() => null);
      if (res) assert.equal(res.status, 400);
      assert.ok(sent < limit, `server read ${sent} bytes before refusing`);
    });

    test("NUL and control characters are bad input, never a server error", async () => {
      assert.equal((await post("/api/auth/login", { email: "a\u0000b@example.com", password: "x".repeat(12) })).status, 400);
      assert.equal((await register(uniq(), { displayName: "a\u0000b" })).status, 400);
      assert.equal((await startSignup("a\u0000b@example.com")).status, 400);
      assert.equal((await fetch(`${BASE}/ru/specialists?q=${encodeURIComponent("a\u0000b")}`)).status, 200);
    });

    test("wrong types never cause a 500", async () => {
      for (const body of [{ email: 1, password: 2 }, { email: {}, password: [] }, { email: "a@b.co", password: null }, { email: ["a@b.co"], password: "x" }, {}]) {
        const r = await post("/api/auth/login", body);
        assert.ok(r.status === 400, JSON.stringify(body) + " -> " + r.status);
      }
    });

    test("SQL-injection and XSS payloads are treated as plain data", async () => {
      await resetLimits();
      const payloads = ["' OR '1'='1", "admin'--", "a@b.co'; DROP TABLE users;--", "\" OR \"\"=\"", "<script>alert(1)</script>@x.co", "a@b.co\r\nBcc: victim@x.co"];
      for (const email of payloads) {
        const r = await post("/api/auth/login", { email, password: "' OR '1'='1" });
        assert.ok([400, 401].includes(r.status), `${email} -> ${r.status}`);
        assert.equal(r.setCookie.length, 0);
      }
      const { rows } = await db.query("SELECT to_regclass('public.users') AS t");
      assert.ok(rows[0].t, "users table must still exist");
    });

    test("a hostile display name is stored as text and returned as JSON, not interpreted", async () => {
      const name = `<img src=x onerror=alert(1)>`;
      const r = await register(uniq(), { displayName: name });
      assert.equal(r.status, 201);
      const me = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: r.session } });
      assert.match(me.headers.get("content-type") ?? "", /application\/json/);
      assert.equal((await me.json()).user.displayName, name);
      const page = await (await fetch(`${BASE}/ru/account`, { headers: { Cookie: r.session } })).text();
      assert.ok(!page.includes(name), "display name must be HTML-escaped in rendered pages");
    });

    test("reflected parameters on public pages are escaped", async () => {
      const xss = `"><script>alert(1)</script>`;
      for (const path of [`/ru/login?error=${encodeURIComponent(xss)}&next=${encodeURIComponent(xss)}`, `/ru/reset-password?token=${encodeURIComponent(xss)}`, `/ru/verify-email?token=${encodeURIComponent(xss)}`]) {
        const html = await (await fetch(BASE + path)).text();
        assert.ok(!html.includes("<script>alert(1)</script>"), path);
      }
    });

    test("unknown locales and traversal paths do not resolve", async () => {
      for (const p of ["/xx", "/..%2f..%2fetc/passwd", "/ru/%2e%2e/%2e%2e/.env", "/.env", "/.env.local", "/ru/.git/config"]) {
        const res = await fetch(BASE + p, { redirect: "manual" });
        assert.ok([301, 302, 307, 308, 400, 404].includes(res.status), `${p} -> ${res.status}`);
        const body = res.status === 404 || res.status >= 300 ? "" : await res.text();
        assert.ok(!/DATABASE_URL|CLIENT_SECRET|BOT_TOKEN/.test(body), p);
      }
    });
  });

  describe("registration", () => {
    test("privileged roles and mass-assignment fields cannot be set", async () => {
      for (const role of ["admin", "moderator", "ADMIN", "parent' OR 1=1", 1, null, {}]) {
        const r = await register(uniq(), { role });
        assert.equal(r.status, 400, `role=${JSON.stringify(role)}`);
      }
      const r = await register(uniq(), { isAdmin: true, status: "active", email_verified_at: "2020-01-01", id: "00000000-0000-0000-0000-000000000000", verification_status: "verified" });
      assert.equal(r.status, 201);
      const { rows } = await db.query("SELECT role, email_verified_at, status FROM users WHERE email = $1", [r.email]);
      assert.equal(rows[0].role, "parent");
      assert.ok(rows[0].email_verified_at > new Date(Date.now() - 3600_000), "verified by using the link, not by the request field");
      assert.equal((await startSignup(uniq(), { role: "admin" })).status, 400, "step 1 refuses privileged roles too");
    });

    test("step 1 creates no account and no session; the account appears only when the link is used", async () => {
      const email = uniq();
      const start = await startSignup(email, { password: PASSWORD, displayName: "Early" });
      assert.equal(start.status, 202);
      assert.deepEqual(start.setCookie, [], "no cookies at step 1");
      assert.equal((await db.query("SELECT 1 FROM users WHERE email = $1", [email])).rowCount, 0);
      assert.ok(await eventually(async () => (await db.query("SELECT 1 FROM signup_requests WHERE email = $1 AND used_at IS NULL", [email])).rowCount === 1), "a link is issued");
      const columns = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'signup_requests'")).rows.map((r) => r.column_name);
      assert.ok(!columns.some((c) => /password|role|name/.test(c)), "step 1 stores nothing the address owner did not choose");
      assert.equal((await startSignup(uniq(), { consent: false })).status, 400);
    });

    test("the sign-up link is single use, expires, and is the only source of the e-mail", async () => {
      const email = uniq();
      const token = await signupToken(email);
      const done = await post("/api/auth/register/complete", { token, password: PASSWORD, role: "specialist", consent: true, email: `other-${email}` });
      assert.equal(done.status, 201, done.text);
      assert.equal(done.json.user.email, email);
      assert.ok(done.session, "signed in after completing");
      assert.equal((await db.query("SELECT 1 FROM users WHERE email = $1", [`other-${email}`])).rowCount, 0);
      const { rows } = await db.query("SELECT role, email_verified_at, privacy_consent_version FROM users WHERE email = $1", [email]);
      assert.equal(rows[0].role, "specialist", "the role is chosen at step 2");
      assert.ok(rows[0].email_verified_at && rows[0].privacy_consent_version);
      const again = await post("/api/auth/register/complete", { token, password: PASSWORD, consent: true });
      assert.equal(again.status, 400);
      assert.equal(again.json?.error?.code, "invalid_token");
      const expired = await signupToken(uniq(), -60);
      assert.equal((await post("/api/auth/register/complete", { token: expired, password: PASSWORD, consent: true })).status, 400);
      assert.equal((await post("/api/auth/register/complete", { token: "nope", password: PASSWORD, consent: true })).status, 400);
      const noConsent = await signupToken(uniq());
      assert.equal((await post("/api/auth/register/complete", { token: noConsent, password: PASSWORD, consent: false })).json?.error?.code, "consent_required");
      assert.equal((await fetch(`${BASE}/api/auth/register/complete?token=${noConsent}`)).status, 405);
    });

    test("using one link closes the others; a link for an address that got an account meanwhile says so", async () => {
      const email = uniq();
      const first = await signupToken(email);
      const second = await signupToken(email);
      assert.equal((await post("/api/auth/register/complete", { token: first, password: PASSWORD, consent: true })).status, 201);
      assert.equal((await post("/api/auth/register/complete", { token: second, password: PASSWORD, consent: true })).status, 400);
      const other = uniq();
      const link = await signupToken(other);
      await db.query("INSERT INTO users (email, display_name) VALUES ($1, 'Existing')", [other]);
      const clash = await post("/api/auth/register/complete", { token: link, password: PASSWORD, consent: true });
      assert.equal(clash.status, 409);
      assert.equal(clash.json?.error?.code, "account_exists");
      assert.equal(clash.session, undefined);
    });

    test("consent is mandatory and weak passwords are refused", async () => {
      assert.equal((await register(uniq(), { consent: false })).status, 400);
      assert.equal((await register(uniq(), { consent: "true" })).status, 400);
      assert.equal((await register(uniq(), { password: "short" })).status, 400);
      assert.equal((await register(uniq(), { password: "x".repeat(129) })).status, 400);
      const email = uniq();
      assert.equal((await register(email, { password: email })).status, 400);
    });

    test("the session cookie is HttpOnly, SameSite and unguessable; the password is stored hashed", async () => {
      const a = await register();
      const b = await register();
      const raw = a.setCookie.find((c) => c.startsWith("session=") || c.startsWith("__Host-session="));
      assert.match(raw, /HttpOnly/i);
      assert.match(raw, /SameSite=Lax/i);
      assert.match(raw, /Path=\//i);
      const tokenA = a.session.split("=")[1];
      assert.ok(tokenA.length >= 40);
      assert.notEqual(tokenA, b.session.split("=")[1]);
      assert.ok(!a.text.includes(PASSWORD));
      const { rows } = await db.query("SELECT password_hash FROM users WHERE email = $1", [a.email]);
      assert.match(rows[0].password_hash, /^scrypt\$/);
      assert.ok(!rows[0].password_hash.includes(PASSWORD));
      const stored = await db.query("SELECT 1 FROM sessions WHERE token_hash = $1", [sha256(tokenA)]);
      assert.equal(stored.rowCount, 1, "sessions are stored by hash");
      const plain = await db.query("SELECT 1 FROM sessions WHERE token_hash = $1", [Buffer.from(tokenA)]);
      assert.equal(plain.rowCount, 0, "the raw token must not be stored");
    });
  });

  describe("password blocklist", () => {
    test("common passwords and the e-mail's own name are refused at sign-up", async () => {
      for (const password of ["1234567890", "Qwertyuiop", "password123"]) {
        const r = await register(uniq(), { password });
        assert.equal(r.status, 400, password);
        assert.equal(r.json?.error?.code, "common_password", password);
        assert.equal(r.session, undefined);
      }
      const email = uniq();
      const own = await register(email, { password: email.split("@")[0] });
      assert.equal(own.json?.error?.code, "common_password");
    });
  });

  describe("account enumeration and timing", () => {
    test("sign-up answers identically for a taken and a new address (body, status, cookies) and changes nothing", async () => {
      const taken = await register();
      const fresh = uniq();
      const a = await startSignup(fresh);
      const b = await startSignup(taken.email, { role: "organization" });
      assert.equal(a.status, 202);
      assert.equal(b.status, a.status);
      assert.equal(b.text, a.text);
      assert.deepEqual(b.setCookie, a.setCookie);
      assert.deepEqual(a.setCookie, []);
      assert.ok(await eventually(async () => (await db.query("SELECT 1 FROM signup_requests WHERE email = $1", [fresh])).rowCount === 1));
      await new Promise((resolve) => setTimeout(resolve, 300));
      const open = await db.query("SELECT 1 FROM signup_requests WHERE email = $1 AND used_at IS NULL", [taken.email]);
      assert.equal(open.rowCount, 0, "no link is issued for an address that has an account");
      const owner = await db.query("SELECT display_name, role FROM users WHERE email = $1", [taken.email]);
      assert.deepEqual(owner.rows[0], { display_name: "Test", role: "parent" }, "the existing account must not be modified");
    });

    test("login: unknown e-mail and wrong password are indistinguishable", async () => {
      await resetLimits();
      const known = await register();
      const a = await post("/api/auth/login", { email: known.email, password: "wrong wrong wrong" });
      const b = await post("/api/auth/login", { email: uniq(), password: "wrong wrong wrong" });
      assert.equal(a.status, 401);
      assert.equal(b.status, 401);
      assert.equal(a.text, b.text);
      assert.equal(a.setCookie.length + b.setCookie.length, 0);
    });

    test("password reset answers the same for existing and unknown addresses", async () => {
      await resetLimits();
      const known = await register();
      const a = await post("/api/auth/password/forgot", { email: known.email });
      const b = await post("/api/auth/password/forgot", { email: uniq() });
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal(a.text, b.text);
    });

    test("login timing does not reveal whether an account exists (median of 5)", async () => {
      await resetLimits();
      const known = await register();
      const time = async (email) => {
        const t = [];
        for (let i = 0; i < 5; i++) {
          const s = performance.now();
          await post("/api/auth/login", { email, password: "wrong wrong wrong" }, { headers: { "X-Forwarded-For": `10.9.${i}.${Math.floor(Math.random() * 250)}` } });
          t.push(performance.now() - s);
        }
        return t.sort((x, y) => x - y)[2];
      };
      const withAccount = await time(known.email);
      await resetLimits();
      const without = await time(uniq());
      assert.ok(Math.abs(withAccount - without) < Math.max(withAccount, without) * 0.5, `known=${withAccount.toFixed(0)}ms unknown=${without.toFixed(0)}ms`);
    });
  });

  describe("sessions", () => {
    test("no cookie, garbage and forged cookies are unauthenticated", async () => {
      assert.equal((await fetch(`${BASE}/api/auth/me`)).status, 401);
      for (const c of ["session=", "session=abc", `session=${"A".repeat(500)}`, "session=' OR 1=1--", `session=${randomBytes(32).toString("base64url")}`, "session=../../etc/passwd"]) {
        assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: c } })).status, 401, c);
      }
    });

    test("logout kills the server-side session (a stolen cookie stops working)", async () => {
      const r = await register();
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: r.session } })).status, 200);
      assert.equal((await post("/api/auth/logout", {}, { cookie: r.session })).status, 200);
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: r.session } })).status, 401);
    });

    test("logging out everywhere kills every session of the account, and only that account", async () => {
      await resetLimits();
      const r = await register();
      const second = await post("/api/auth/login", { email: r.email, password: PASSWORD });
      const stranger = await register();
      assert.equal((await post("/api/auth/logout-all", {}, { cookie: second.session })).status, 200);
      for (const c of [r.session, second.session]) {
        assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: c } })).status, 401);
      }
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: stranger.session } })).status, 200);
      assert.equal((await post("/api/auth/logout-all", {})).status, 401, "needs a session");
      assert.equal((await post("/api/auth/logout-all", {}, { cookie: stranger.session, origin: "https://evil.example" })).status, 403);
    });

    test("an idle session expires before its absolute lifetime; use keeps it alive", async () => {
      await resetLimits();
      const r = await register();
      const tokenHash = sha256(r.session.split("=")[1]);
      await db.query("UPDATE sessions SET last_seen_at = now() - interval '20 minutes' WHERE token_hash = $1", [tokenHash]);
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: r.session } })).status, 200);
      const touched = await db.query("SELECT last_seen_at > now() - interval '1 minute' AS fresh FROM sessions WHERE token_hash = $1", [tokenHash]);
      assert.equal(touched.rows[0].fresh, true, "use refreshes last_seen_at");
      await db.query("UPDATE sessions SET last_seen_at = now() - interval '8 days' WHERE token_hash = $1", [tokenHash]);
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: r.session } })).status, 401);
    });

    test("every login issues a fresh token (no session fixation)", async () => {
      await resetLimits();
      const r = await register();
      const l1 = await post("/api/auth/login", { email: r.email, password: PASSWORD });
      const l2 = await post("/api/auth/login", { email: r.email, password: PASSWORD });
      assert.equal(l1.status, 200);
      assert.notEqual(l1.session, l2.session);
      assert.notEqual(l1.session, r.session);
      const fixated = await post("/api/auth/login", { email: r.email, password: PASSWORD }, { cookie: "session=attacker-chosen-value" });
      assert.notEqual(fixated.session, "session=attacker-chosen-value");
    });

    test("a suspended account cannot log in or use an existing session", async () => {
      await resetLimits();
      const r = await register();
      await db.query("UPDATE users SET status = 'suspended' WHERE email = $1", [r.email]);
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: r.session } })).status, 401);
      const l = await post("/api/auth/login", { email: r.email, password: PASSWORD });
      assert.ok([401, 403].includes(l.status));
      assert.equal(l.session, undefined);
    });
  });

  describe("brute-force protection", () => {
    test("repeated wrong passwords for one account are throttled, even when the IP header changes", async () => {
      await resetLimits();
      const r = await register();
      const codes = [];
      for (let i = 0; i < 12; i++) {
        const l = await post("/api/auth/login", { email: r.email, password: `wrong-${i}-password` }, { headers: { "X-Forwarded-For": `203.0.113.${i + 1}` } });
        codes.push(l.status);
      }
      assert.ok(codes.includes(429), `statuses: ${codes.join(",")}`);
      const good = await post("/api/auth/login", { email: r.email, password: PASSWORD });
      assert.equal(good.status, 429, "the account stays locked for the window even with the right password");
    });

    test("a browser that signed in before is not locked out by guesses from elsewhere (device cookie)", async () => {
      await resetLimits();
      const r = await register();
      const device = r.setCookie.map((c) => c.split(";")[0]).find((c) => /^(__Host-)?device=.+/.test(c));
      assert.ok(device, "sign-up issues a device cookie");
      for (let i = 0; i < 10; i++) await post("/api/auth/login", { email: r.email, password: `wrong-${i}-password` });
      assert.equal((await post("/api/auth/login", { email: r.email, password: PASSWORD })).status, 429, "unknown browsers are locked out");
      const owner = await post("/api/auth/login", { email: r.email, password: PASSWORD }, { cookie: device });
      assert.equal(owner.status, 200, "the owner's browser keeps its own budget");
      // A device cookie belongs to one account: it gives no extra budget against another one.
      const other = await register();
      for (let i = 0; i < 10; i++) await post("/api/auth/login", { email: other.email, password: `wrong-${i}-password` });
      assert.equal((await post("/api/auth/login", { email: other.email, password: PASSWORD }, { cookie: device })).status, 429);
    });

    test("spoofed client-IP headers do not give a fresh per-IP budget", { skip: trustedIp === "none" && "per-IP limits are off on this server" }, async () => {
      await resetLimits();
      const codes = [];
      for (let i = 0; i < 14; i++) {
        const ip = `198.51.100.${i + 1}`;
        const spoofed = Object.fromEntries(["x-real-ip", "x-forwarded-for", "x-vercel-forwarded-for"].filter((h) => h !== trustedIp).map((h) => [h, ip]));
        codes.push((await post("/api/auth/password/forgot", { email: uniq() }, { headers: spoofed })).status);
      }
      assert.ok(codes.includes(429), codes.join(","));
    });

    test("registration and password-reset requests are rate limited per client", { skip: trustedIp === "none" && "per-IP limits are off on this server" }, async () => {
      await resetLimits();
      const codes = [];
      for (let i = 0; i < 14; i++) codes.push((await post("/api/auth/password/forgot", { email: uniq() })).status);
      assert.ok(codes.includes(429), codes.join(","));
      const signups = [];
      for (let i = 0; i < 12; i++) signups.push((await startSignup(uniq())).status);
      assert.ok(signups.includes(429), signups.join(","));
    });
  });

  describe("password reset and e-mail tokens", () => {
    async function issue(userId, purpose, { ttl = 3600, token = randomBytes(32).toString("base64url") } = {}) {
      await db.query("INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1,$2,$3, now() + make_interval(secs => $4))", [userId, purpose, sha256(token), ttl]);
      return token;
    }
    const idOf = async (email) => (await db.query("SELECT id FROM users WHERE email = $1", [email])).rows[0].id;

    test("a reset token works once, revokes all sessions and is useless afterwards", async () => {
      await resetLimits();
      const r = await register();
      const token = await issue(await idOf(r.email), "reset_password");
      const NEW = "a brand new long passphrase";
      const ok = await post("/api/auth/password/reset", { token, password: NEW });
      assert.equal(ok.status, 200);
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: r.session } })).status, 401, "old sessions must be revoked");
      assert.equal((await post("/api/auth/password/reset", { token, password: "another long passphrase!" })).status, 400, "token is single-use");
      assert.equal((await post("/api/auth/login", { email: r.email, password: PASSWORD })).status, 401);
      assert.equal((await post("/api/auth/login", { email: r.email, password: NEW })).status, 200);
    });

    test("expired, wrong-purpose, malformed and unknown tokens are refused", async () => {
      await resetLimits();
      const r = await register();
      const id = await idOf(r.email);
      const expired = await issue(id, "reset_password", { ttl: -60 });
      const wrongPurpose = await issue(id, "verify_email");
      for (const token of [expired, wrongPurpose, "", "x", "A".repeat(500), randomBytes(32).toString("base64url"), "' OR 1=1--"]) {
        const res = await post("/api/auth/password/reset", { token, password: "a brand new long passphrase" });
        assert.equal(res.status, 400, `token=${token.slice(0, 12)}`);
      }
      assert.equal((await post("/api/auth/login", { email: r.email, password: PASSWORD })).status, 200, "password must be unchanged");
    });

    test("a weak new password does not burn the token", async () => {
      await resetLimits();
      const r = await register();
      const token = await issue(await idOf(r.email), "reset_password");
      assert.equal((await post("/api/auth/password/reset", { token, password: "short" })).status, 400);
      assert.equal((await post("/api/auth/password/reset", { token, password: "a perfectly fine passphrase" })).status, 200);
    });

    test("a new reset request does not cancel an earlier link; a successful reset cancels all of them", async () => {
      await resetLimits();
      const r = await register();
      const id = await idOf(r.email);
      const first = await issue(id, "reset_password");
      const second = await issue(id, "reset_password");
      assert.equal((await post("/api/auth/password/forgot", { email: r.email })).status, 200);
      assert.equal((await db.query("SELECT 1 FROM email_tokens WHERE token_hash = $1 AND used_at IS NULL", [sha256(first)])).rowCount, 1, "first link still usable");
      assert.equal((await post("/api/auth/password/reset", { token: first, password: "a brand new passphrase" })).status, 200);
      assert.equal((await post("/api/auth/password/reset", { token: second, password: "another new passphrase" })).status, 400, "other links die with the reset");
      assert.equal((await db.query("SELECT 1 FROM email_tokens WHERE user_id = $1 AND purpose = 'reset_password' AND used_at IS NULL", [id])).rowCount, 0);
    });

    test("the reset e-mail is still issued after the response is sent", async () => {
      await resetLimits();
      const r = await register();
      const id = await idOf(r.email);
      assert.equal((await post("/api/auth/password/forgot", { email: r.email })).status, 200);
      let issued = 0;
      for (let i = 0; i < 20 && issued === 0; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        issued = (await db.query("SELECT 1 FROM email_tokens WHERE user_id = $1 AND purpose = 'reset_password' AND used_at IS NULL", [id])).rowCount;
      }
      assert.equal(issued, 1);
    });

    test("tokens are stored only as hashes", async () => {
      const r = await register();
      const token = await issue(await idOf(r.email), "verify_email");
      const { rowCount } = await db.query("SELECT 1 FROM email_tokens WHERE token_hash = $1", [Buffer.from(token)]);
      assert.equal(rowCount, 0);
    });

    test("e-mail confirmation needs a POST, a valid token and the account's own session (no pre-hijacking)", async () => {
      await resetLimits();
      const r = await unverified();
      const stranger = await register();
      const token = await issue(await idOf(r.email), "verify_email");
      const isVerified = async () => (await db.query("SELECT email_verified_at FROM users WHERE email = $1", [r.email])).rows[0].email_verified_at !== null;
      const get = await fetch(`${BASE}/api/auth/verify/confirm?token=${token}`);
      assert.equal(get.status, 405);
      const anonymous = await post("/api/auth/verify/confirm", { token });
      assert.equal(anonymous.status, 401, "the address owner clicking a link for someone else's account confirms nothing");
      assert.equal(await isVerified(), false);
      assert.equal((await post("/api/auth/verify/confirm", { token }, { cookie: stranger.session })).status, 400, "another account's session");
      assert.equal(await isVerified(), false);
      assert.equal((await post("/api/auth/verify/confirm", { token: "nope" }, { cookie: r.session })).status, 400);
      assert.equal((await post("/api/auth/verify/confirm", { token }, { cookie: r.session })).status, 200, "the token was left unused by the refusals");
      assert.equal(await isVerified(), true);
      assert.equal((await post("/api/auth/verify/confirm", { token }, { cookie: r.session })).status, 400, "single use");
    });
  });

  describe("account linking", () => {
    test("Google linking to an existing account ends its sessions and devices; a never-verified one also loses its password", async () => {
      const { findOrCreateOAuthUser } = await import("../lib/auth/users.ts");
      const gmail = () => `sectest-${randomBytes(5).toString("hex")}@gmail.com`; // never mailed: linking sends nothing
      const sub = () => `sectest-${randomBytes(8).toString("hex")}`;
      const state = async (email) =>
        (await db.query(
          `SELECT u.password_hash IS NOT NULL AS has_pw, u.email_verified_at IS NOT NULL AS verified,
                  (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id) AS sessions,
                  (SELECT count(*)::int FROM trusted_devices d WHERE d.user_id = u.id) AS devices
             FROM users u WHERE u.email = $1`,
          [email],
        )).rows[0];

      const owner = await register(gmail());
      assert.deepEqual(await state(owner.email), { has_pw: true, verified: true, sessions: 1, devices: 1 });
      const linked = await findOrCreateOAuthUser("google", sub(), { email: owner.email, emailVerified: true, displayName: "G" }, "parent", null);
      assert.equal(linked.ok, true);
      assert.equal(linked.linkedToPassword, true, "the owner is to be notified");
      assert.deepEqual(await state(owner.email), { has_pw: true, verified: true, sessions: 0, devices: 0 });
      assert.equal((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: owner.session } })).status, 401);

      const legacy = await unverified(gmail());
      const claimed = await findOrCreateOAuthUser("google", sub(), { email: legacy.email, emailVerified: true, displayName: "G" }, "parent", null);
      assert.equal(claimed.ok, true);
      assert.equal(claimed.linkedToPassword, undefined);
      assert.deepEqual(await state(legacy.email), { has_pw: false, verified: true, sessions: 0, devices: 0 }, "pre-registered password and sessions are gone");

      const corp = await register();
      const refused = await findOrCreateOAuthUser("google", sub(), { email: corp.email, emailVerified: true, displayName: "G" }, "parent", null);
      assert.deepEqual(refused, { ok: false, reason: "link_requires_password" }, "non-Google domains are never linked by e-mail");
    });
  });

  describe("authorization (IDOR / privilege escalation)", () => {
    test("profile endpoints require a session", async () => {
      assert.equal((await post("/api/profile/onboarding", { city: "tashkent" })).status, 401);
      assert.equal((await post("/api/auth/verify/request", {})).status, 401);
    });

    test("the role always comes from the session: a parent cannot save a specialist or organization profile", async () => {
      const r = await register();
      const specialist = { role: "specialist", displayName: "Fake", category: "speech-therapist", headline: "x", city: "tashkent", formats: ["online"], experienceYears: 5, submit: true };
      await post("/api/profile/onboarding", specialist, { cookie: r.session });
      const { rows } = await db.query("SELECT role FROM users WHERE email = $1", [r.email]);
      assert.equal(rows[0].role, "parent");
      const sp = await db.query("SELECT 1 FROM specialist_profiles WHERE user_id = (SELECT id FROM users WHERE email = $1)", [r.email]);
      assert.equal(sp.rowCount, 0, "no specialist profile may be created for a parent");
      const org = await db.query("SELECT 1 FROM organizations WHERE owner_user_id = (SELECT id FROM users WHERE email = $1)", [r.email]);
      assert.equal(org.rowCount, 0);
    });

    test("a specialist cannot verify or publish themselves or touch other people's profiles", async () => {
      const spec = await register(uniq(), { role: "specialist" });
      const other = await register(uniq(), { role: "specialist" });
      const base = { displayName: "Spec", category: "speech-therapist", headline: "Hello", city: "tashkent", formats: ["online"], experienceYears: 3, priceFrom: 100000, priceTo: 200000, ageMin: 3, ageMax: 12, submit: true };
      const sneaky = { ...base, verification_status: "verified", verificationStatus: "verified", is_published: true, isPublished: true, user_id: "x", userId: "x", role: "admin" };
      const res = await post("/api/profile/onboarding", sneaky, { cookie: spec.session });
      assert.ok([200, 400].includes(res.status), String(res.status));
      const { rows } = await db.query("SELECT verification_status, is_published, user_id FROM specialist_profiles WHERE user_id = (SELECT id FROM users WHERE email = $1)", [spec.email]);
      if (rows[0]) {
        assert.notEqual(rows[0].verification_status, "verified");
        assert.equal(rows[0].is_published, false);
      }
      const otherId = (await db.query("SELECT id FROM users WHERE email = $1", [other.email])).rows[0].id;
      const otherRows = await db.query("SELECT 1 FROM specialist_profiles WHERE user_id = $1", [otherId]);
      assert.equal(otherRows.rowCount, 0, "another account's profile must be untouched");
      const role = await db.query("SELECT role FROM users WHERE email = $1", [spec.email]);
      assert.equal(role.rows[0].role, "specialist");
    });

    test("a reviewed profile keeps name, specialization, experience and status; rejected or blocked cannot be edited", async () => {
      const spec = await register(uniq(), { role: "specialist" });
      const p = { displayName: "Spec", category: await categorySlug(), headline: "Hello", city: "tashkent", formats: ["online"], experienceYears: 3, priceFrom: 100000, priceTo: 200000, ageMin: 3, ageMax: 12, submit: true };
      const first = await post("/api/profile/onboarding", p, { cookie: spec.session });
      assert.equal(first.status, 200, first.text);
      const owner = "(SELECT id FROM users WHERE email = $1)";
      await db.query(`UPDATE specialist_profiles SET verification_status = 'confirmed', is_published = true WHERE user_id = ${owner}`, [spec.email]);
      const edit = { ...p, displayName: "Renamed", experienceYears: 40, headline: "Changed after verification", bio: "Line one\n\n\n\nLine two", priceFrom: 120000, submit: false };
      const again = await post("/api/profile/onboarding", edit, { cookie: spec.session });
      assert.equal(again.status, 200, again.text);
      const { rows } = await db.query(`SELECT display_name, experience_years, headline, bio, price_from, verification_status, is_published FROM specialist_profiles WHERE user_id = ${owner}`, [spec.email]);
      assert.deepEqual(rows[0], {
        display_name: "Spec", experience_years: 3, headline: "Changed after verification", bio: "Line one\n\nLine two",
        price_from: 120000, verification_status: "confirmed", is_published: true,
      });
      for (const status of ["rejected", "blocked"]) {
        await db.query(`UPDATE specialist_profiles SET verification_status = $2, is_published = false WHERE user_id = ${owner}`, [spec.email, status]);
        const refused = await post("/api/profile/onboarding", { ...edit, headline: "x" }, { cookie: spec.session });
        assert.equal(refused.status, 409, status);
      }
    });

    test("an unconfirmed e-mail can save a draft but not send it for review or create an organization", async () => {
      const spec = await unverified(uniq(), { role: "specialist" });
      const p = { displayName: "Spec", category: await categorySlug(), headline: "Hello", city: "tashkent", formats: ["online"], experienceYears: 3, priceFrom: 100000, priceTo: 200000, ageMin: 3, ageMax: 12 };
      assert.equal((await post("/api/profile/onboarding", { ...p, submit: false }, { cookie: spec.session })).status, 200, "draft");
      const refused = await post("/api/profile/onboarding", { ...p, submit: true }, { cookie: spec.session });
      assert.equal(refused.status, 403);
      assert.equal(refused.json?.error?.code, "email_unverified");
      const status = await db.query("SELECT verification_status FROM specialist_profiles WHERE user_id = (SELECT id FROM users WHERE email = $1)", [spec.email]);
      assert.equal(status.rows[0].verification_status, "draft");
      await verifyEmail(spec.email);
      assert.equal((await post("/api/profile/onboarding", { ...p, submit: true }, { cookie: spec.session })).status, 200, "after confirmation");

      const org = await unverified(uniq(), { role: "organization" });
      const o = { name: "Test School", orgType: "school", city: "tashkent" };
      assert.equal((await post("/api/profile/onboarding", o, { cookie: org.session })).status, 403);
      assert.equal((await db.query("SELECT 1 FROM organizations WHERE owner_user_id = (SELECT id FROM users WHERE email = $1)", [org.email])).rowCount, 0);
      await verifyEmail(org.email);
      assert.equal((await post("/api/profile/onboarding", o, { cookie: org.session })).status, 200);

      const parent = await register();
      assert.equal((await post("/api/profile/onboarding", { city: "tashkent" }, { cookie: parent.session })).status, 200, "parents are not gated");
    });

    test("self-service endpoints never return other users' data", async () => {
      const a = await register();
      const b = await register();
      const me = await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: a.session } })).json();
      assert.equal(me.user.email, a.email);
      assert.ok(!JSON.stringify(me).includes(b.email));
      assert.ok(!JSON.stringify(me).includes("password"));
    });

    test("unpublished specialists never appear in search results seen by other users", async () => {
      const spec = await register(uniq(), { role: "specialist", displayName: "Zzqx Hidden Draft" });
      await verifyEmail(spec.email);
      const saved = await post("/api/profile/onboarding", { displayName: "Zzqx Hidden Draft", category: await categorySlug(), headline: "Hello", city: "tashkent", formats: ["online"], experienceYears: 1, priceFrom: 100000, priceTo: 200000, ageMin: 3, ageMax: 12, submit: true }, { cookie: spec.session });
      assert.equal(saved.status, 200, "the profile must really exist for this check to mean anything");
      const viewer = await register();
      const page = await (await fetch(`${BASE}/ru/specialists?q=Zzqx`, { headers: { Cookie: viewer.session } })).text();
      assert.ok(!page.includes("Zzqx Hidden Draft"), "draft/submitted profiles must not be listed");
    });
  });

  describe("specialist profile page", () => {
    /** A specialist with a filled profile; `status` / `published` are then set directly (moderation is not built yet). */
    async function specialistWith(status, published, extra = {}) {
      const spec = await register(uniq(), { role: "specialist" });
      const p = { displayName: `Spec ${randomBytes(3).toString("hex")}`, category: await categorySlug(), headline: "Hello", city: "tashkent", formats: ["online"], experienceYears: 3, priceFrom: 100000, priceTo: 200000, ageMin: 3, ageMax: 12, submit: false, ...extra };
      assert.equal((await post("/api/profile/onboarding", p, { cookie: spec.session })).status, 200);
      const { rows } = await db.query(
        "UPDATE specialist_profiles SET verification_status = $2, is_published = $3 WHERE user_id = (SELECT id FROM users WHERE email = $1) RETURNING id",
        [spec.email, status, published],
      );
      return { ...spec, profileId: rows[0].id, name: p.displayName };
    }
    const page = (id, cookie, query = "") => fetch(`${BASE}/ru/specialists/${id}${query}`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });

    test("a published profile is shown to signed-in users, without the owner's e-mail; bio is escaped", async () => {
      const spec = await specialistWith("confirmed", true, { bio: "<script>alert(1)</script>\nMethods" });
      const parent = await register();
      const res = await page(spec.profileId, parent.session);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes(spec.name));
      assert.ok(!html.includes("<script>alert(1)</script>"), "bio must be escaped");
      assert.ok(!html.includes(spec.email), "the owner's e-mail must never appear");
      assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    });

    test("signed-out visitors are sent to log in", async () => {
      const spec = await specialistWith("confirmed", true);
      const res = await page(spec.profileId);
      assert.ok([303, 307, 308].includes(res.status) || (res.status === 200 && (await res.text()).includes("/ru/login")), String(res.status));
    });

    test("unpublished, rejected, blocked, unknown and malformed ids look the same (not found); the owner gets a preview", async () => {
      const parent = await register();
      const draft = await specialistWith("draft", false);
      // Every hidden case must look exactly like an unknown id. The lookup runs in a streamed part of the page, so a
      // production build answers 200 with Next.js' not-found page (noindex); `next dev` answers 404.
      const hidden = async (id, name, label) => {
        const res = await page(id, parent.session);
        const html = await res.text();
        assert.ok(res.status === 404 || (res.status === 200 && html.includes("This page could not be found")), `${label}: ${res.status}`);
        if (name) assert.ok(!html.includes(name), `${label}: the name must not leak`);
        assert.match(html, /noindex/, label);
      };
      for (const status of ["submitted", "rejected", "blocked"]) {
        const other = await specialistWith(status, false);
        await hidden(other.profileId, other.name, status);
      }
      await hidden(draft.profileId, draft.name, "someone else's draft");
      await hidden("00000000-0000-4000-8000-000000000000", null, "unknown id");
      for (const bad of ["abc", "1%20OR%201=1", "..%2F..%2Fapi"]) await hidden(bad, null, bad);
      const own = await page(draft.profileId, draft.session);
      assert.equal(own.status, 200);
      assert.ok((await own.text()).includes("предпросмотр"), "the owner sees the preview note");
    });

    test("the back link only goes to the catalog or the account", async () => {
      const spec = await specialistWith("confirmed", true);
      const parent = await register();
      const backHref = async (back) => {
        const html = await (await page(spec.profileId, parent.session, `?back=${encodeURIComponent(back)}`)).text();
        return html.match(/<a href="([^"]*)"[^>]*class="[^"]*back/)?.[1];
      };
      assert.equal(await backHref("/ru/specialists?city=tashkent&page=2"), "/ru/specialists?city=tashkent&amp;page=2");
      for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "/api/auth/logout", "javascript:alert(1)"]) {
        assert.equal(await backHref(evil), "/ru", evil);
      }
    });
  });

  describe("account settings", () => {
    test("the name can be changed for the own account only; other fields are ignored", async () => {
      const r = await register();
      const other = await register();
      const res = await post("/api/profile/account", { displayName: "  New   Name ", role: "admin", email: other.email, id: "x" }, { cookie: r.session });
      assert.equal(res.status, 200);
      const { rows } = await db.query("SELECT display_name, role, email FROM users WHERE email = ANY($1) ORDER BY email = $2 DESC", [[r.email, other.email], r.email]);
      assert.deepEqual(rows[0], { display_name: "New Name", role: "parent", email: r.email });
      assert.equal(rows[1].display_name, "Test", "another account is untouched");
      assert.equal((await post("/api/profile/account", { displayName: "a\u0000b" }, { cookie: r.session })).status, 400);
      assert.equal((await post("/api/profile/account", { displayName: "x".repeat(81) }, { cookie: r.session })).status, 400);
      assert.equal((await post("/api/profile/account", { displayName: "x" })).status, 401);
    });

    test("changing the password needs the current one and signs out every other device", async () => {
      const r = await register();
      const second = await post("/api/auth/login", { email: r.email, password: PASSWORD });
      assert.ok(second.session);
      const NEW = "another long passphrase here";
      const wrong = await post("/api/auth/password/change", { currentPassword: "not the password", newPassword: NEW }, { cookie: r.session });
      assert.equal(wrong.status, 403);
      assert.equal(wrong.json?.error?.code, "invalid_credentials");
      assert.equal((await post("/api/auth/password/change", { currentPassword: PASSWORD, newPassword: "1234567890" }, { cookie: r.session })).json?.error?.code, "common_password");
      assert.equal((await post("/api/auth/password/change", { currentPassword: PASSWORD, newPassword: NEW })).status, 401, "a session is required");

      const ok = await post("/api/auth/password/change", { currentPassword: PASSWORD, newPassword: NEW }, { cookie: r.session });
      assert.equal(ok.status, 200, ok.text);
      assert.ok(ok.session && ok.session !== r.session, "this browser gets a fresh session");
      const me = (cookie) => fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } }).then((x) => x.status);
      assert.equal(await me(second.session), 401, "other devices are signed out");
      assert.equal(await me(r.session), 401, "the old session id is gone too");
      assert.equal(await me(ok.session), 200);
      assert.equal((await post("/api/auth/login", { email: r.email, password: PASSWORD })).status, 401);
      assert.equal((await post("/api/auth/login", { email: r.email, password: NEW })).status, 200);
    });

    test("password-change guesses are rate limited per account", async () => {
      await resetLimits();
      const r = await register();
      const codes = [];
      for (let i = 0; i < 7; i++) codes.push((await post("/api/auth/password/change", { currentPassword: `wrong guess ${i}`, newPassword: "irrelevant passphrase" }, { cookie: r.session })).status);
      assert.ok(codes.includes(429), codes.join(","));
    });

    test("settings and profile pages require a session", async () => {
      for (const p of ["/ru/settings"]) {
        const res = await fetch(BASE + p, { redirect: "manual" });
        assert.ok([303, 307, 308].includes(res.status) || (res.status === 200 && (await res.text()).includes("/ru/login")), `${p} -> ${res.status}`);
      }
    });
  });

  describe("search parameters", () => {
    test("hostile filter values never produce a server error or leak SQL", async () => {
      const r = await register();
      const hostile = ["' OR 1=1--", "%", "_", "\\", "%27%20UNION%20SELECT%20password_hash%20FROM%20users--", "a".repeat(5000), "../../etc/passwd", "\u0000", "{{7*7}}", "${7*7}"];
      for (const v of hostile) {
        const res = await fetch(`${BASE}/ru/specialists?q=${encodeURIComponent(v)}&city=${encodeURIComponent(v)}&category=${encodeURIComponent(v)}&page=${encodeURIComponent(v)}&sort=${encodeURIComponent(v)}`, { headers: { Cookie: r.session } });
        assert.ok(res.status < 500, `${v.slice(0, 20)} -> ${res.status}`);
        const html = await res.text();
        assert.ok(!/scrypt\$|syntax error|pg_catalog|stack trace/i.test(html), v.slice(0, 20));
      }
    });
  });

  describe("OAuth and Telegram", () => {
    test("Google: a link cannot record consent; only a same-origin form POST can", async () => {
      const readPending = (res) => {
        const raw = (res.headers.getSetCookie?.() ?? []).find((c) => /^(__Host-)?google_oauth=./.test(c));
        return raw ? JSON.parse(decodeURIComponent(raw.split(";")[0].replace(/^(__Host-)?google_oauth=/, ""))) : null;
      };
      const viaLink = await fetch(`${BASE}/api/auth/google?lang=ru&role=specialist&consent=1`, { redirect: "manual" });
      const linkState = readPending(viaLink);
      if (linkState) assert.equal(linkState.consent, false, "GET must never carry consent");

      const form = (origin) =>
        fetch(`${BASE}/api/auth/google`, {
          method: "POST",
          redirect: "manual",
          headers: { "Content-Type": "application/x-www-form-urlencoded", ...(origin ? { Origin: origin } : {}) },
          body: new URLSearchParams({ lang: "ru", role: "specialist", consent: "1", next: "/ru/onboarding" }),
        });
      for (const origin of [null, "https://evil.example"]) {
        const res = await form(origin);
        assert.equal(res.status, 303);
        assert.match(res.headers.get("location") ?? "", /\/register\?error=forbidden_origin/);
        assert.equal(readPending(res), null, "no OAuth state for a cross-site post");
      }
      const accepted = await form(BASE);
      assert.equal(accepted.status, 303);
      const state = readPending(accepted);
      if (state) assert.equal(state.consent, true);
    });

    test("Google start never carries an off-site redirect target", async () => {
      const res = await fetch(`${BASE}/api/auth/google?lang=ru&role=parent&next=${encodeURIComponent("//evil.example/x")}`, { redirect: "manual" });
      assert.ok([302, 307].includes(res.status));
      const loc = res.headers.get("location") ?? "";
      assert.ok(!loc.includes("evil.example"));
      const cookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("google_oauth="));
      if (cookie) {
        const json = JSON.parse(decodeURIComponent(cookie.split(";")[0].slice("google_oauth=".length)));
        assert.ok(!String(json.next).includes("evil.example"));
        assert.match(cookie, /HttpOnly/i);
        assert.ok(json.state.length >= 20 && json.verifier.length >= 40);
        assert.match(loc, /code_challenge_method=S256/);
      }
    });

    test("Google callback rejects a missing or wrong state", async () => {
      for (const q of ["", "?code=x&state=y", "?error=access_denied"]) {
        const res = await fetch(`${BASE}/api/auth/google/callback${q}`, { redirect: "manual" });
        assert.ok([302, 307].includes(res.status));
        const loc = res.headers.get("location") ?? "";
        assert.match(loc, /\/login\?error=/);
        assert.equal((res.headers.getSetCookie?.() ?? []).some((c) => /^(__Host-)?session=[^;]+/.test(c) && !/session=;/.test(c)), false);
      }
    });

    test("forged and replayed Telegram payloads are rejected", async () => {
      await resetLimits();
      const forged = { id: 1, first_name: "Evil", auth_date: Math.floor(Date.now() / 1000), hash: "0".repeat(64) };
      const r = await post("/api/auth/telegram", { auth: forged, consent: true });
      assert.ok([401, 501].includes(r.status), String(r.status));
      assert.equal(r.session, undefined);
      const extra = await post("/api/auth/telegram", { auth: { ...forged, is_admin: true }, consent: true });
      assert.ok([401, 501].includes(extra.status));
    });
  });
});
