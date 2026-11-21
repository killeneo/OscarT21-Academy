// Pure, dependency-free helpers (unit-tested with node --test). The URL is the single source of truth for search state.

export const PAGE_SIZE = 12;
export const SORTS = ["popular", "rating", "priceAsc", "priceDesc"] as const;
export type Sort = (typeof SORTS)[number];
export const FORMATS = ["online", "offline"] as const;
export type Format = (typeof FORMATS)[number];
export const RATING_STEPS = [3, 4, 4.5] as const;

export type SearchFilters = {
  q: string;
  category: string | null;
  city: string | null;
  format: Format | null;
  /** Child's age in years. */
  age: number | null;
  priceMin: number | null;
  priceMax: number | null;
  minRating: number | null;
  /** Default true: only profiles with confirmed qualifications. */
  verifiedOnly: boolean;
  sort: Sort;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;

const SLUG_RE = /^[a-z_]{1,40}$/;
const MAX_PRICE = 100_000_000;

/** A checkbox is sent as hidden "0" + checkbox "1"; the last value wins. */
function last(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[value.length - 1] : value;
}

function int(value: string | string[] | undefined, min: number, max: number): number | null {
  const v = last(value);
  if (v === undefined || !/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

export function parseSearchParams(raw: Raw): SearchFilters {
  // Control characters are dropped: NUL in particular makes PostgreSQL reject the whole query.
  const q = (last(raw.q) ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const category = last(raw.category);
  const city = last(raw.city);
  const format = last(raw.format);
  const rating = Number(last(raw.rating));
  const sort = last(raw.sort);
  let priceMin = int(raw.priceMin, 0, MAX_PRICE);
  let priceMax = int(raw.priceMax, 0, MAX_PRICE);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];

  return {
    q,
    category: category && SLUG_RE.test(category) ? category : null,
    city: city && SLUG_RE.test(city) ? city : null,
    format: (FORMATS as readonly string[]).includes(format ?? "") ? (format as Format) : null,
    age: int(raw.age, 0, 18),
    priceMin,
    priceMax,
    minRating: (RATING_STEPS as readonly number[]).includes(rating) ? rating : null,
    verifiedOnly: last(raw.verified) !== "0",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "popular",
    page: int(raw.page, 1, 1000) ?? 1,
  };
}

/** Builds a query string for links, omitting defaults. `overrides` lets chips/pagination change one field. */
export function buildQuery(filters: SearchFilters, overrides: Partial<SearchFilters> = {}): string {
  const f = { ...filters, ...overrides };
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.city) p.set("city", f.city);
  if (f.format) p.set("format", f.format);
  if (f.age !== null) p.set("age", String(f.age));
  if (f.priceMin !== null) p.set("priceMin", String(f.priceMin));
  if (f.priceMax !== null) p.set("priceMax", String(f.priceMax));
  if (f.minRating !== null) p.set("rating", String(f.minRating));
  if (!f.verifiedOnly) p.set("verified", "0");
  if (f.sort !== "popular") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
