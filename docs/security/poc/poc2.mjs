// Follow-up PoCs: streamed redirects (meta refresh / RSC) and soft 404s. Local targets only.
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

const [BASE = "http://localhost:3100", WEB] = process.argv.slice(2);
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("local targets only");
const pg = createRequire(path.join(WEB, "package.json"))("pg");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const email = `poc-${randomBytes(5).toString("hex")}@sectest.invalid`;
const out = {};
try {
  await db.query("DELETE FROM rate_limits");
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { Origin: BASE, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "violet tram over the river 42", consent: true }),
  });
  const session = reg.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => /session=/.test(c));
  const redirectTarget = (body) => {
    const meta = body.match(/http-equiv="refresh" content="\d+;\s*url=([^"]+)"/i)?.[1];
    const rsc = body.match(/NEXT_REDIRECT;(?:replace|push);([^;"\\]+)/)?.[1];
    return meta ?? rsc ?? null;
  };
  out.openRedirect = {};
  for (const p of ["//evil.example/x", "/\\evil.example", "/%5Cevil.example", "https://evil.example", "/\t/evil.example", "/%09/evil.example", "/\u3000/evil.example", "javascript:alert(1)", "/ru/specialists?x=1"]) {
    const res = await fetch(`${BASE}/ru/login?next=${encodeURIComponent(p)}`, { redirect: "manual", headers: { Cookie: session } });
    const body = await res.text();
    const t = redirectTarget(body);
    const resolved = t ? new URL(t.replace(/&amp;/g, "&"), BASE) : null;
    out.openRedirect[JSON.stringify(p)] = `${res.status} → ${t ?? "(no redirect found)"}${resolved ? ` [host ${resolved.host}]` : ""}${body.includes("evil.example") ? " (evil.example appears in HTML)" : ""}`;
  }
  out.anonAccount = await (async () => {
    const res = await fetch(`${BASE}/ru/account`, { redirect: "manual" });
    const body = await res.text();
    return { status: res.status, redirect: redirectTarget(body), containsCabinetData: /Ваши шаги|Статус проверки/.test(body) };
  })();
  out.softNotFound = {};
  for (const p of ["/RU/account", "/xx/account", "/ru/does-not-exist"]) {
    const res = await fetch(BASE + p, { redirect: "manual" });
    const body = await res.text();
    out.softNotFound[p] = { status: res.status, notFoundUi: /404|not.found|не найден/i.test(body), robotsNoindex: /noindex/.test(body) };
  }
} finally {
  await db.query("DELETE FROM users WHERE email LIKE '%@sectest.invalid'");
  await db.query("DELETE FROM rate_limits");
  await db.end();
}
console.log(JSON.stringify(out, null, 2));
