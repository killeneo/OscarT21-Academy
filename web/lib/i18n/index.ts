import { en } from "./en";
import { ru, type Messages } from "./ru";
import { uz } from "./uz";

/**
 * Each locale is a separate statically generated page (/ru, /uz, /en) for SEO.
 * Dictionaries are plain typed objects — no i18n runtime library.
 */
export const locales = ["ru", "uz", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

/** Language names are written in their own language (endonyms) on every page. */
export const localeNames: Record<Locale, { short: string; name: string; og: string }> = {
  ru: { short: "RU", name: "Русский", og: "ru_RU" },
  uz: { short: "UZ", name: "O‘zbekcha", og: "uz_UZ" },
  en: { short: "EN", name: "English", og: "en_US" },
};

const dictionaries: Record<Locale, Messages> = { ru, uz, en };

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}

export type { Messages };
