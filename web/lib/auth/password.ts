import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { COMMON_PASSWORDS } from "./common-passwords.ts";

// scrypt parameters from the OWASP Password Storage Cheat Sheet (N=2^15, r=8, p=3).
const N = 32768;
const R = 8;
const P = 3;
const KEY_LEN = 64;
const OPTIONS: ScryptOptions = { N, r: R, p: P, maxmem: 256 * 1024 * 1024 };

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Thrown when too many password hashes are already waiting; routes answer 503 instead of queueing forever. */
export class PasswordHashBusyError extends Error {}

/**
 * Concurrency gate: at most `maxActive` tasks run at once and at most `maxQueued` wait; beyond that it throws
 * PasswordHashBusyError. A freed slot is handed straight to the next waiter.
 */
export function createLimiter(maxActive: number, maxQueued: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active < maxActive) {
      active++;
    } else {
      if (waiting.length >= maxQueued) throw new PasswordHashBusyError("password hashing queue is full");
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

// Each derivation holds ~32 MiB and one libuv thread (4 by default, shared with fs/dns/zlib). Unbounded, a burst
// of login/sign-up requests exhausts memory and stalls the whole process, so only a few run at a time.
const hashSlot = createLimiter(2, 64);

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return hashSlot(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(password.normalize("NFKC"), salt, KEY_LEN, { ...OPTIONS, N: n, r, p }, (err, key) =>
          err ? reject(err) : resolve(key),
        );
      }),
  );
}

/** Format: scrypt$N$r$p$salt(base64)$hash(base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![n, r, p].every(Number.isInteger)) return false;
  const expected = Buffer.from(parts[5], "base64");
  const actual = await derive(password, Buffer.from(parts[4], "base64"), n, r, p);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let dummyHash: Promise<string> | undefined;

/** Run a real verification for unknown users so response time does not reveal whether an email exists. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-only");
  await verifyPassword(password, await dummyHash);
}

let common: Set<string> | undefined;

/** Built once on first use from the bundled list (~9k entries, all >= 10 characters). */
function isCommonPassword(password: string): boolean {
  common ??= new Set(COMMON_PASSWORDS.split("\n").filter(Boolean));
  return common.has(password.normalize("NFKC").toLowerCase());
}

/**
 * NIST 800-63B policy: length limits, no composition rules, and a blocklist of commonly used / breached passwords
 * (case-insensitive) plus the account's own e-mail. Returns an error code or null.
 */
export function checkPasswordPolicy(password: string, email: string): "weak_password" | "common_password" | null {
  const len = [...password].length;
  if (len < PASSWORD_MIN || len > PASSWORD_MAX) return "weak_password";
  const lower = password.normalize("NFKC").toLowerCase();
  const mail = email.toLowerCase();
  if (lower === mail || (mail.includes("@") && lower === mail.slice(0, mail.indexOf("@")))) return "common_password";
  if (isCommonPassword(password)) return "common_password";
  return null;
}
