import { db } from "@/lib/auth/db";
import { fail, hasSameOrigin, ok, parseDisplayName, readJson } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Account settings of the signed-in user (any role): the name shown in the header and the account.
 * Only the own account, taken from the session; nothing else in the body is read.
 */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    const user = await getSessionUser();
    if (!user) return fail("unauthorized", 401);
    const body = await readJson(req);
    const displayName = parseDisplayName(body?.displayName);
    if (displayName === null) return fail("invalid_input", 400);
    await db().query("UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1", [user.id, displayName]);
    return ok({ user: { displayName } });
  } catch (err) {
    console.error("account settings failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
