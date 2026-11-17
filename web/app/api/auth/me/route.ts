import { connection } from "next/server";
import { fail, ok } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  await connection(); // always request-time: reads the session cookie
  try {
    const user = await getSessionUser();
    if (!user) return fail("unauthorized", 401);
    return ok({ user: { email: user.email, displayName: user.displayName, role: user.role } });
  } catch (err) {
    console.error("me failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
