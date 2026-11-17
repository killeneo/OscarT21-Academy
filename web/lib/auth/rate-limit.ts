import { createHash } from "node:crypto";
import { db } from "./db";

/** Fixed-window counter in Postgres (works across instances). Returns true while under the limit. */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { rows } = await db().query<{ count: number }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, now() + make_interval(secs => $2))
     ON CONFLICT (key) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + make_interval(secs => $2) ELSE rate_limits.reset_at END
     RETURNING count`,
    [key, windowSeconds],
  );
  return rows[0].count <= limit;
}

/** Stable, non-reversible key part so raw emails are never stored in rate_limits. */
export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** Marks a one-time key as used. Returns false if it was already claimed (replay). */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  await db().query("DELETE FROM auth_replay WHERE expires_at < now()");
  const { rowCount } = await db().query(
    "INSERT INTO auth_replay (key, expires_at) VALUES ($1, now() + make_interval(secs => $2)) ON CONFLICT DO NOTHING",
    [key, ttlSeconds],
  );
  return rowCount === 1;
}
