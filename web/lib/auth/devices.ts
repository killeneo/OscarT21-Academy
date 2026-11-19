import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, DEVICE_TTL_SECONDS, isProduction } from "./config";
import { db } from "./db";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * Remembers this browser for the user after a successful password sign-in or sign-up. Always a fresh random value
 * (a value planted in the browser beforehand is never adopted); the previous cookie of this browser is dropped.
 */
export async function trustDevice(userId: string): Promise<void> {
  const jar = await cookies();
  const previous = jar.get(DEVICE_COOKIE)?.value;
  const token = randomBytes(32).toString("base64url");
  await db().query("DELETE FROM trusted_devices WHERE expires_at < now()");
  if (previous && previous.length <= 200) {
    await db().query("DELETE FROM trusted_devices WHERE token_hash = $1", [sha256(previous)]);
  }
  await db().query(
    "INSERT INTO trusted_devices (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))",
    [sha256(token), userId, DEVICE_TTL_SECONDS],
  );
  jar.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_TTL_SECONDS,
  });
}

/**
 * The account this browser's device cookie was issued to, plus a stable key for its own rate-limit bucket.
 * Looked up by the cookie alone (before and regardless of the e-mail being tried), so timing does not depend on
 * whether that e-mail has an account.
 */
export async function deviceOwner(): Promise<{ userId: string; key: string } | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const hash = sha256(token);
  const { rows } = await db().query<{ user_id: string }>(
    "SELECT user_id FROM trusted_devices WHERE token_hash = $1 AND expires_at > now()",
    [hash],
  );
  return rows[0] ? { userId: rows[0].user_id, key: hash.toString("hex").slice(0, 32) } : null;
}
