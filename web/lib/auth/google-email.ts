/**
 * Addresses Google itself owns and never hands to a new person. Any other address (own domain, Workspace, or
 * another mail provider registered as a Google account) can change hands, e.g. when a company domain expires
 * and someone re-registers it: Google then vouches for the same e-mail under a different account (`sub`).
 *
 * Kept free of framework imports so it can be unit-tested with plain Node.
 */
const GOOGLE_OWNED_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function isGoogleOwnedEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  return at > 0 && GOOGLE_OWNED_DOMAINS.has(email.slice(at + 1).trim().toLowerCase());
}
