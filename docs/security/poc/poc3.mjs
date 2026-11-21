// PoC / retest for re-audit R-01 and R-02 (dev only). Synthetic accounts @sectest.invalid only; deleted at the end.
// Run from web/: node --env-file=.env.local ../docs/security/poc/poc3.mjs   (BASE_URL defaults to http://localhost:3000)
//
// Before the fix (commit 71faf94): sign-up set cookies only for new addresses (R-02), and a confirmation link worked
// without the account's session, so a pre-registered account became verified while the attacker kept access (R-01).
// After the fix every check below prints PASS.
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const pg = createRequire(process.cwd() + "/package.json")("pg");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sha256 = (v) => createHash("sha256").update(v).digest();
const uniq = () => `poc3-${randomBytes(4).toString("hex")}@sectest.invalid`;
const verdict = (ok, text) => console.log(`${ok ? "PASS" : "FAIL"}  ${text}`);

async function post(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: { Origin: BASE, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  return {
    status: res.status,
    body: await res.text(),
    cookies: raw.map((c) => c.split(";")[0].split("=")[0]),
    session: raw.map((c) => c.split(";")[0]).find((c) => /^(__Host-)?session=.+/.test(c)),
  };
}

const created = [];
try {
  await db.query("DELETE FROM rate_limits WHERE key LIKE 'register%' OR key LIKE 'verify%'");

  console.log("== R-02: sign-up step 1 for a new and a taken address ==");
  const taken = uniq();
  created.push(taken);
  const link = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO signup_requests (token_hash, email, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [sha256(link), taken]);
  const owner = await post("/api/auth/register/complete", { token: link, password: "owner chosen passphrase", consent: true });
  const fresh = uniq();
  created.push(fresh);
  const a = await post("/api/auth/register", { email: fresh, role: "parent", consent: true, lang: "ru" });
  const b = await post("/api/auth/register", { email: taken, role: "parent", consent: true, lang: "ru" });
  console.log("new  :", a.status, a.body, "Set-Cookie:", a.cookies.join(",") || "(none)");
  console.log("taken:", b.status, b.body, "Set-Cookie:", b.cookies.join(",") || "(none)");
  verdict(a.status === b.status && a.body === b.body && a.cookies.join() === b.cookies.join(), "responses are identical");
  verdict((await db.query("SELECT 1 FROM users WHERE email = $1", [fresh])).rowCount === 0, "step 1 creates no account");

  console.log("\n== R-01: confirmation link opened without the account's session ==");
  // Accounts can no longer be pre-registered; simulate one left over from before the fix.
  const victim = uniq();
  created.push(victim);
  const t2 = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO signup_requests (token_hash, email, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [sha256(t2), victim]);
  const attacker = await post("/api/auth/register/complete", { token: t2, password: "attacker chosen pass 1", role: "organization", consent: true });
  const { rows } = await db.query("UPDATE users SET email_verified_at = NULL WHERE email = $1 RETURNING id", [victim]);
  const token = randomBytes(32).toString("base64url"); // stands in for the link mailed to the address owner
  await db.query("INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'verify_email', $2, now() + interval '1 hour')", [rows[0].id, sha256(token)]);
  const anonymous = await post("/api/auth/verify/confirm", { token });
  console.log("address owner clicks confirm (no cookie):", anonymous.status, anonymous.body);
  const state = (await db.query("SELECT email_verified_at FROM users WHERE id = $1", [rows[0].id])).rows[0];
  verdict(anonymous.status === 401 && state.email_verified_at === null, "the account stays unverified");
  const unused = (await db.query("SELECT used_at FROM email_tokens WHERE token_hash = $1", [sha256(token)])).rows[0];
  verdict(unused.used_at === null, "the refused token is not used up");
  verdict(Boolean(owner.session && attacker.session), "(setup) step 2 signs the address owner in");
} finally {
  const del = await db.query("DELETE FROM users WHERE email = ANY($1)", [created]);
  await db.query("DELETE FROM signup_requests WHERE email = ANY($1)", [created]);
  await db.query("DELETE FROM rate_limits WHERE key LIKE 'register%' OR key LIKE 'verify%' OR key LIKE 'login:%'");
  console.log("\ncleanup: deleted users =", del.rowCount);
  await db.end();
}
