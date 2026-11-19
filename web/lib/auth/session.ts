import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, isProduction } from "./config";
import { db } from "./db";

export type SessionUser = {
  id: string;
  email: string | null;
  displayName: string;
  role: "parent" | "specialist" | "organization" | "moderator" | "admin";
  emailVerified: boolean;
  onboardingCompleted: boolean;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Always issues a brand-new token (no session fixation) and stores only its hash. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db().query("DELETE FROM sessions WHERE expires_at < now()");
  await db().query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))",
    [userId, sha256(token), SESSION_TTL_SECONDS],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Returns the signed-in, active user or null. Safe to call from server components and route handlers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const { rows } = await db().query(
    `SELECT u.id, u.email, u.display_name, u.role, u.email_verified_at, u.onboarding_completed_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [sha256(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    emailVerified: row.email_verified_at !== null,
    onboardingCompleted: row.onboarding_completed_at !== null,
  };
}

async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function destroySession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && token.length <= 200) {
    await db().query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  }
  await clearSessionCookie();
}

/** "Log out everywhere": revokes every session of the user, including ones on lost or stolen devices. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db().query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  await clearSessionCookie();
}
