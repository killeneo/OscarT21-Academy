import { fail, hasSameOrigin, ok } from "@/lib/auth/http";
import { destroyAllSessions, getSessionUser } from "@/lib/auth/session";

/** Signs the current user out on every device (all server-side sessions are deleted). */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    const user = await getSessionUser();
    if (!user) return fail("unauthorized", 401);
    await destroyAllSessions(user.id);
    return ok();
  } catch (err) {
    console.error("logout-all failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
