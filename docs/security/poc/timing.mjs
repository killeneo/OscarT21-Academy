// F-04 retest: response time of /password/forgot for an existing vs an unknown address. Local targets only.
// Usage: node --env-file=web/.env.local docs/security/poc/timing.mjs <BASE_URL> <web dir> [samples] [pauseMs]
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const [BASE, WEB, samples = "31", pause = "250"] = process.argv.slice(2);
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("local targets only");
const pg = createRequire(path.join(WEB, "package.json"))("pg");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const uniq = () => `poc-${randomBytes(5).toString("hex")}@sectest.invalid`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, body) =>
  fetch(BASE + p, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" }, body: JSON.stringify(body) });

try {
  await db.query("DELETE FROM rate_limits");
  const known = uniq();
  await post("/api/auth/register", { email: known, password: "violet tram over the river 42", consent: true });
  const t = { known: [], unknown: [] };
  for (let i = 0; i < Number(samples); i++) {
    for (const kind of i % 2 ? ["known", "unknown"] : ["unknown", "known"]) {
      await db.query("DELETE FROM rate_limits");
      await sleep(Number(pause)); // let background work of the previous request finish
      const s = performance.now();
      await (await post("/api/auth/password/forgot", { email: kind === "known" ? known : uniq() })).text();
      t[kind].push(performance.now() - s);
    }
  }
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(JSON.stringify({ samples: Number(samples), knownMs: +med(t.known).toFixed(2), unknownMs: +med(t.unknown).toFixed(2), diffMs: +(med(t.known) - med(t.unknown)).toFixed(2) }));
} finally {
  await db.query("DELETE FROM users WHERE email LIKE '%@sectest.invalid'");
  await db.query("DELETE FROM rate_limits");
  await db.end();
}
