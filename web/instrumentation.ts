/**
 * Runs once when the server starts. Reports a production configuration that would make auth routes refuse
 * requests, so it shows up at deploy time and not on the first sign-in attempt.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ipSource } = await import("./lib/auth/client-ip");
  try {
    ipSource();
  } catch (err) {
    console.error(`[config] ${err instanceof Error ? err.message : String(err)}. Auth routes will answer 500 until it is set.`);
  }
}
