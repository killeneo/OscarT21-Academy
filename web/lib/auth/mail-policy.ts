const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Printing mails to the console writes verification and reset links (i.e. account access) into the server logs.
 * Allowed in development, and in a production build (next start) only when it is explicitly a local check:
 * MAIL_TRANSPORT=console AND NEXT_PUBLIC_SITE_URL pointing at localhost. On a real host it is refused.
 *
 * Kept free of framework imports so it can be unit-tested with plain Node.
 */
export function consoleMailAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (env.MAIL_TRANSPORT !== "console" || !env.NEXT_PUBLIC_SITE_URL) return false;
  try {
    return LOCAL_HOSTS.has(new URL(env.NEXT_PUBLIC_SITE_URL).hostname);
  } catch {
    return false;
  }
}
