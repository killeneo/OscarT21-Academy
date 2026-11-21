import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Payload sent by the Telegram Login Widget. All values arrive as strings or numbers. */
export type TelegramAuthData = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
};

export const TELEGRAM_MAX_AGE_SECONDS = 300;

const ALLOWED_KEYS = new Set(["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]);

export type TelegramVerdict =
  | { ok: true; id: string; authDate: number; displayName: string }
  | { ok: false; reason: "malformed" | "bad_hash" | "expired" };

/**
 * Verifies a Telegram Login Widget payload: https://core.telegram.org/widgets/login#checking-authorization
 * secret = SHA256(bot_token); hash = HMAC_SHA256(secret, data_check_string) as hex.
 */
export function verifyTelegramAuth(raw: unknown, botToken: string, nowSeconds = Math.floor(Date.now() / 1000)): TelegramVerdict {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "malformed" };
  const data = raw as Record<string, unknown>;
  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) return { ok: false, reason: "malformed" };
  }
  if (typeof data.hash !== "string" || !/^[0-9a-f]{64}$/.test(data.hash)) return { ok: false, reason: "malformed" };
  const id = String(data.id ?? "");
  const authDate = Number(data.auth_date);
  if (!/^\d{1,20}$/.test(id) || !Number.isInteger(authDate)) return { ok: false, reason: "malformed" };

  const checkString = Object.keys(data)
    .filter((k) => k !== "hash" && data[k] !== undefined && data[k] !== null)
    .sort()
    .map((k) => `${k}=${String(data[k])}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  const given = Buffer.from(data.hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_hash" };

  if (nowSeconds - authDate > TELEGRAM_MAX_AGE_SECONDS || authDate - nowSeconds > 60) {
    return { ok: false, reason: "expired" };
  }

  const name = [data.first_name, data.last_name].filter((v): v is string => typeof v === "string" && v !== "").join(" ");
  const displayName = (name || (typeof data.username === "string" ? data.username : "")).slice(0, 80);
  return { ok: true, id, authDate, displayName };
}
