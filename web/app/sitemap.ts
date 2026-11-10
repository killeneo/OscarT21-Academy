import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

// One entry per language page; each lists all language alternates (hreflang) incl. x-default.
// lastModified is omitted on purpose: a build-time date would be misleading without real content dates.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = {
    ...Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}`])),
    "x-default": `${siteUrl}/${defaultLocale}`,
  };

  return locales.map((lang) => ({
    url: `${siteUrl}/${lang}`,
    changeFrequency: "weekly",
    priority: lang === defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
