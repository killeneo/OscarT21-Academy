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

async function register(email = uniq(), extra = {}) {
  const r = await post("/api/auth/register", { email, password: PASSWORD, displayName: "Test", role: "parent", consent: true, lang: "ru", ...extra });
  return { email, ...r };
}

const resetLimits = () => db?.query("DELETE FROM rate_limits");
const verifyEmail = (email) => db.query("UPDATE users SET email_verified_at = now() WHERE email = $1", [email]);
/** A specialization slug that exists in this database (fixtures differ per DB). */
const categorySlug = async () => (await db.query("SELECT slug FROM specialist_categories ORDER BY slug LIMIT 1")).rows[0]?.slug;

describe("security (black-box)", { skip: !up || !db ? "server or database not reachable" : false }, () => {
  beforeEach(resetLimits); // each test starts with fresh rate-limit counters (10 sign-ups/hour per IP would otherwise trip)
  after(async () => {
    await db.query("DELETE FROM users WHERE email LIKE $1", [`%@${DOMAIN}`]);
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
    const routes = ["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/password/forgot", "/api/auth/password/reset", "/api/auth/verify/confirm", "/api/auth/verify/request", "/api/profile/onboarding", "/api/auth/telegram"];
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
      assert.equal((await post("/api/auth/register", { email: uniq(), password: PASSWORD, displayName: "a\u0000b", consent: true })).status, 400);
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
      assert.equal(rows[0].email_verified_at, null, "e-mail must stay unverified until the link is used");
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
        const r = await post("/api/auth/register", { email: uniq(), password, consent: true, lang: "ru" });
        assert.equal(r.status, 400, password);
        assert.equal(r.json?.error?.code, "common_password", password);
        assert.equal(r.session, undefined);
      }
      const email = uniq();
      const own = await post("/api/auth/register", { email, password: email.split("@")[0], consent: true, lang: "ru" });
      assert.equal(own.json?.error?.code, "common_password");
    });
  });

  describe("account enumeration and timing", () => {
    test("registering a taken e-mail looks identical to a new one and creates no session", async () => {
      const first = await register();
      const again = await register(first.email, { displayName: "Attacker" });
      assert.equal(again.status, first.status);
      assert.deepEqual(Object.keys(again.json).sort(), Object.keys(first.json).sort());
      assert.equal(again.session, undefined, "no session may be issued for an existing account");
      const owner = await db.query("SELECT display_name FROM users WHERE email = $1", [first.email]);
      assert.equal(owner.rows[0].display_name, "Test", "the existing account must not be modified");
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

    test("spoofed client-IP headers do not give a fresh per-IP budget", async () => {
      await resetLimits();
      const codes = [];
      for (let i = 0; i < 14; i++) {
        const ip = `198.51.100.${i + 1}`;
        codes.push((await post("/api/auth/password/forgot", { email: uniq() }, { headers: { "X-Real-IP": ip, "X-Forwarded-For": ip, "X-Vercel-Forwarded-For": ip } })).status);
      }
      assert.ok(codes.includes(429), codes.join(","));
    });

    test("registration and password-reset requests are rate limited per client", async () => {
      await resetLimits();
      const codes = [];
      for (let i = 0; i < 14; i++) codes.push((await post("/api/auth/password/forgot", { email: uniq() })).status);
      assert.ok(codes.includes(429), codes.join(","));
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

    test("tokens are stored only as hashes", async () => {
      const r = await register();
      const token = await issue(await idOf(r.email), "verify_email");
      const { rowCount } = await db.query("SELECT 1 FROM email_tokens WHERE token_hash = $1", [Buffer.from(token)]);
      assert.equal(rowCount, 0);
    });

    test("e-mail verification needs a valid token and a GET cannot consume it", async () => {
      await resetLimits();
      const r = await register();
      const token = await issue(await idOf(r.email), "verify_email");
      const get = await fetch(`${BASE}/api/auth/verify/confirm?token=${token}`);
      assert.equal(get.status, 405);
      assert.equal((await post("/api/auth/verify/confirm", { token: "nope" })).status, 400);
      assert.equal((await post("/api/auth/verify/confirm", { token })).status, 200);
      assert.equal((await post("/api/auth/verify/confirm", { token })).status, 400, "single use");
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

    test("a submitted profile is locked against edits", async () => {
      const spec = await register(uniq(), { role: "specialist" });
      await verifyEmail(spec.email);
      const p = { displayName: "Spec", category: await categorySlug(), headline: "Hello", city: "tashkent", formats: ["online"], experienceYears: 3, priceFrom: 100000, priceTo: 200000, ageMin: 3, ageMax: 12, submit: true };
      const first = await post("/api/profile/onboarding", p, { cookie: spec.session });
      assert.equal(first.status, 200, first.text);
      await db.query("UPDATE specialist_profiles SET verification_status = 'confirmed' WHERE user_id = (SELECT id FROM users WHERE email = $1)", [spec.email]);
      const again = await post("/api/profile/onboarding", { ...p, headline: "Changed after verification" }, { cookie: spec.session });
      assert.equal(again.status, 409);
    });

    test("an unconfirmed e-mail can save a draft but not send it for review or create an organization", async () => {
      const spec = await register(uniq(), { role: "specialist" });
      const p = { displayName: "Spec", category: await categorySlug(), headline: "Hello", city: "tashkent", formats: ["online"], experienceYears: 3, priceFrom: 100000, priceTo: 200000, ageMin: 3, ageMax: 12 };
      assert.equal((await post("/api/profile/onboarding", { ...p, submit: false }, { cookie: spec.session })).status, 200, "draft");
      const refused = await post("/api/profile/onboarding", { ...p, submit: true }, { cookie: spec.session });
      assert.equal(refused.status, 403);
      assert.equal(refused.json?.error?.code, "email_unverified");
      const status = await db.query("SELECT verification_status FROM specialist_profiles WHERE user_id = (SELECT id FROM users WHERE email = $1)", [spec.email]);
      assert.equal(status.rows[0].verification_status, "draft");
      await verifyEmail(spec.email);
      assert.equal((await post("/api/profile/onboarding", { ...p, submit: true }, { cookie: spec.session })).status, 200, "after confirmation");

      const org = await register(uniq(), { role: "organization" });
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
