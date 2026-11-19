import { after } from "next/server";

/**
 * Runs a slow side effect (issuing a token, sending e-mail) after the response has been sent. Besides keeping the
 * request fast, it removes a timing signal: answers that must look the same for existing and unknown accounts
 * (password reset, sign-up with a taken address) no longer wait for work that only happens for one of them.
 * Errors are logged without personal data and never reach the client.
 */
export function afterResponse(label: string, task: () => Promise<unknown>): void {
  after(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`${label} failed:`, err instanceof Error ? err.message : "unknown error");
    }
  });
}
