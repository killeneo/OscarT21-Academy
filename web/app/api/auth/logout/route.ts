import { fail, hasSameOrigin, ok } from "@/lib/auth/http";
import { destroySession } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    await destroySession();
    return ok();
  } catch (err) {
    console.error("logout failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
