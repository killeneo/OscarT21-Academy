/** Supported cities (slugs). Display names live in the i18n dictionaries (search.cities). */
export const CITY_SLUGS = ["tashkent", "samarkand", "bukhara", "andijan", "namangan", "fergana", "nukus", "navoi"] as const;
export type CitySlug = (typeof CITY_SLUGS)[number];

export function isCity(value: unknown): value is CitySlug {
  return typeof value === "string" && (CITY_SLUGS as readonly string[]).includes(value);
}
