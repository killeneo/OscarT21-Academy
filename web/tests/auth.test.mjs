// Unit tests for the pure auth helpers. Run: npm test (Node strips TypeScript types natively).
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "../lib/auth/password.ts";
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

test("password policy is length-only and rejects email as password", () => {
  assert.equal(checkPasswordPolicy("short", "a@b.co"), "weak_password");
  assert.equal(checkPasswordPolicy("x".repeat(129), "a@b.co"), "weak_password");
  assert.equal(checkPasswordPolicy("alice@example.com", "alice@example.com"), "weak_password");
  assert.equal(checkPasswordPolicy("a long enough phrase", "a@b.co"), null);
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
