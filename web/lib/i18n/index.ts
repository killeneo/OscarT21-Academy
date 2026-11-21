import { en } from "./en";
import { ru, type Messages } from "./ru";
import { kaa } from "./kaa";
import { uz } from "./uz";
import { uzCyrl } from "./uz-cyrl";

/**
 * Each locale is a separate statically generated page (/ru, /uz, /uz-cyrl, /kaa, /en) for SEO.
 * Dictionaries are plain typed objects — no i18n runtime library.
 */
export const locales = ["ru", "uz", "uz-cyrl", "kaa", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

/** Language names are written in their own language (endonyms) on every page. */
export const localeNames: Record<Locale, { short: string; name: string; og: string; html: string; numbers: string }> = {
  ru: { short: "RU", name: "Русский", og: "ru_RU", html: "ru", numbers: "ru-RU" },
  uz: { short: "UZ", name: "Ózbekça", og: "uz_UZ", html: "uz", numbers: "uz-UZ" },
  "uz-cyrl": { short: "ЎЗ", name: "Ўзбекча", og: "uz_UZ", html: "uz-Cyrl", numbers: "uz-Cyrl-UZ" },
  kaa: { short: "QQ", name: "Qaraqalpaqsha", og: "kaa_UZ", html: "kaa", numbers: "uz-UZ" },
  en: { short: "EN", name: "English", og: "en_US", html: "en", numbers: "en-US" },
};

const dictionaries: Record<Locale, Messages> = { ru, uz, "uz-cyrl": uzCyrl, kaa, en };

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}

export type { Messages };
