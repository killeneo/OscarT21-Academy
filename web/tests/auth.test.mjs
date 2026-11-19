// Unit tests for the pure auth helpers. Run: npm test (Node strips TypeScript types natively).
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { TrustedProxyConfigError, behindTrustedProxy, clientIp, ipSource } from "../lib/auth/client-ip.ts";
import { isGoogleOwnedEmail } from "../lib/auth/google-email.ts";
import { consoleMailAllowed } from "../lib/auth/mail-policy.ts";
import { PasswordHashBusyError, checkPasswordPolicy, createLimiter, hashPassword, verifyPassword } from "../lib/auth/password.ts";
import { verifyTelegramAuth } from "../lib/auth/telegram.ts";

test("password hash verifies and is salted", async () => {
  const a = await hashPassword("correct horse battery");
  const b = await hashPassword("correct horse battery");
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$32768\$8\$3\$/);
  assert.equal(await verifyPassword("correct horse battery", a), true);
  assert.equal(await verifyPassword("correct horse batterY", a), false);
});

test("password verification rejects malformed hashes", async () => {
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
  assert.equal(await verifyPassword("x", "scrypt$a$b$c$d$e"), false);
});

test("password policy: length limits, no composition rules", () => {
  assert.equal(checkPasswordPolicy("short", "a@b.co"), "weak_password");
  assert.equal(checkPasswordPolicy("x".repeat(129), "a@b.co"), "weak_password");
  assert.equal(checkPasswordPolicy("a long enough phrase", "a@b.co"), null);
});

test("password policy: common passwords and the account's own e-mail are refused (case-insensitive)", () => {
  for (const p of ["1234567890", "QWERTYUIOP", "qwertyuiop", "Password123", "йцукенгшщз", "1q2w3e4r5t"]) {
    assert.equal(checkPasswordPolicy(p, "a@b.co"), "common_password", p);
  }
  assert.equal(checkPasswordPolicy("alice@example.com", "alice@example.com"), "common_password");
  assert.equal(checkPasswordPolicy("ALICE.SMITH1", "alice.smith1@example.com"), "common_password");
  assert.equal(checkPasswordPolicy("correct horse battery staple", "a@b.co"), null);
});

const BOT_TOKEN = "123456:TEST-TOKEN-not-real";
const NOW = 1_800_000_000;

function sign(fields, token = BOT_TOKEN) {
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  return { ...fields, hash: createHmac("sha256", secret).update(check).digest("hex") };
}

test("telegram: valid payload is accepted", () => {
  const data = sign({ id: 42, first_name: "Ada", last_name: "L", username: "ada", auth_date: NOW - 10 });
  const v = verifyTelegramAuth(data, BOT_TOKEN, NOW);
  assert.deepEqual(v, { ok: true, id: "42", authDate: NOW - 10, displayName: "Ada L" });
});

test("telegram: tampered field, wrong token and bad hash are rejected", () => {
  const data = sign({ id: 42, first_name: "Ada", auth_date: NOW - 10 });
  assert.equal(verifyTelegramAuth({ ...data, id: 43 }, BOT_TOKEN, NOW).reason, "bad_hash");
  assert.equal(verifyTelegramAuth(data, "999:OTHER", NOW).reason, "bad_hash");
  assert.equal(verifyTelegramAuth({ ...data, hash: "0".repeat(64) }, BOT_TOKEN, NOW).reason, "bad_hash");
});

test("telegram: stale and future payloads are rejected", () => {
  assert.equal(verifyTelegramAuth(sign({ id: 1, auth_date: NOW - 301 }), BOT_TOKEN, NOW).reason, "expired");
  assert.equal(verifyTelegramAuth(sign({ id: 1, auth_date: NOW + 120 }), BOT_TOKEN, NOW).reason, "expired");
  assert.equal(verifyTelegramAuth(sign({ id: 1, auth_date: NOW - 299 }), BOT_TOKEN, NOW).ok, true);
});

test("telegram: malformed input is rejected", () => {
  for (const bad of [null, "x", [], {}, { ...sign({ id: 1, auth_date: NOW }), extra: "1" }, { id: "abc", auth_date: NOW, hash: "0".repeat(64) }]) {
    assert.equal(verifyTelegramAuth(bad, BOT_TOKEN, NOW).ok, false);
  }
});

// --- client IP, hashing concurrency, console mail policy, Google e-mail linking -----------------------------------

const reqWith = (headers) => new Request("http://localhost/", { headers });

test("client IP: no header is trusted unless configured (development: one local bucket)", () => {
  const spoofed = reqWith({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2", "x-vercel-forwarded-for": "3.3.3.3" });
  assert.deepEqual(ipSource({}), { kind: "local" });
  assert.equal(clientIp(spoofed, {}), "local");
  assert.equal(clientIp(spoofed, { NODE_ENV: "development" }), "local");
});

test("client IP: an unconfigured production server refuses instead of sharing one bucket", () => {
  assert.throws(() => ipSource({ NODE_ENV: "production" }), TrustedProxyConfigError);
  assert.throws(() => clientIp(reqWith({ "x-real-ip": "1.1.1.1" }), { NODE_ENV: "production" }), TrustedProxyConfigError);
  assert.equal(behindTrustedProxy({ NODE_ENV: "production" }), false);
});

test("client IP: TRUSTED_IP_HEADER=none switches per-IP limits off", () => {
  assert.equal(clientIp(reqWith({ "x-real-ip": "1.1.1.1" }), { NODE_ENV: "production", TRUSTED_IP_HEADER: "none" }), null);
  assert.equal(behindTrustedProxy({ TRUSTED_IP_HEADER: "None" }), false);
  assert.equal(behindTrustedProxy({ TRUSTED_IP_HEADER: "x-real-ip" }), true);
  assert.equal(behindTrustedProxy({ VERCEL: "1", NODE_ENV: "production" }), true);
});

test("client IP: Vercel header only on Vercel, configured header otherwise", () => {
  assert.equal(clientIp(reqWith({ "x-vercel-forwarded-for": "3.3.3.3", "x-real-ip": "1.1.1.1" }), { VERCEL: "1", NODE_ENV: "production" }), "3.3.3.3");
  assert.equal(clientIp(reqWith({ "x-real-ip": "1.1.1.1" }), { TRUSTED_IP_HEADER: "X-Real-IP" }), "1.1.1.1");
  assert.equal(clientIp(reqWith({}), { TRUSTED_IP_HEADER: "x-real-ip" }), "unknown");
});

test("client IP: x-forwarded-for uses the right-most (proxy-appended) entry", () => {
  const req = reqWith({ "x-forwarded-for": "6.6.6.6, 7.7.7.7,  10.0.0.5 " });
  assert.equal(clientIp(req, { TRUSTED_IP_HEADER: "x-forwarded-for" }), "10.0.0.5");
});

test("hash limiter: caps concurrency, queues, then refuses", async () => {
  const run = createLimiter(1, 1);
  let release;
  let running = 0;
  let peak = 0;
  const task = () =>
    new Promise((resolve) => {
      running++;
      peak = Math.max(peak, running);
      release = () => {
        running--;
        resolve("done");
      };
    });
  const first = run(task);
  const second = run(task); // queued
  await assert.rejects(run(task), PasswordHashBusyError);
  release();
  assert.equal(await first, "done");
  await new Promise((r) => setImmediate(r));
  release();
  assert.equal(await second, "done");
  assert.equal(peak, 1);
  assert.equal(await run(async () => "free again"), "free again");
});

test("hash limiter: a failing task frees its slot", async () => {
  const run = createLimiter(1, 0);
  await assert.rejects(run(async () => { throw new Error("boom"); }), /boom/);
  assert.equal(await run(async () => 1), 1);
});

test("console mail: allowed in dev, refused on a real production host", () => {
  assert.equal(consoleMailAllowed({ NODE_ENV: "development" }), true);
  assert.equal(consoleMailAllowed({ NODE_ENV: "production" }), false);
  assert.equal(consoleMailAllowed({ NODE_ENV: "production", MAIL_TRANSPORT: "console" }), false);
  assert.equal(consoleMailAllowed({ NODE_ENV: "production", MAIL_TRANSPORT: "console", NEXT_PUBLIC_SITE_URL: "https://example.org" }), false);
  assert.equal(consoleMailAllowed({ NODE_ENV: "production", MAIL_TRANSPORT: "console", NEXT_PUBLIC_SITE_URL: "https://localhost.example.org" }), false);
  assert.equal(consoleMailAllowed({ NODE_ENV: "production", MAIL_TRANSPORT: "console", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }), true);
  assert.equal(consoleMailAllowed({ NODE_ENV: "production", MAIL_TRANSPORT: "console", NEXT_PUBLIC_SITE_URL: "not a url" }), false);
});

test("google linking by e-mail: only Google-owned domains", () => {
  assert.equal(isGoogleOwnedEmail("someone@gmail.com"), true);
  assert.equal(isGoogleOwnedEmail("Someone@GoogleMail.com"), true);
  for (const e of ["ceo@startup.io", "user@mail.ru", "x@gmail.com.evil.io", "gmail.com", "@gmail.com", "a@sub.gmail.com"]) {
    assert.equal(isGoogleOwnedEmail(e), false, e);
  }
});
