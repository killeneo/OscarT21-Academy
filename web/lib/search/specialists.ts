import { db } from "@/lib/auth/db";
import { PAGE_SIZE, escapeLike, type SearchFilters } from "./params";

export type SpecialistCard = {
  id: string;
  displayName: string;
  category: string;
  categoryName: Record<string, string>;
  headline: string;
  city: string;
  formats: string[];
  priceFrom: number;
  priceTo: number;
  experienceYears: number;
  ageMin: number;
  ageMax: number;
  ratingAvg: number;
  reviewsCount: number;
  verified: boolean;
  isDemo: boolean;
};

export type Category = { slug: string; name: Record<string, string> };

export type SearchResult = { items: SpecialistCard[]; total: number; page: number; pageCount: number };

export async function listCategories(): Promise<Category[]> {
  const { rows } = await db().query<Category>("SELECT slug, name FROM specialist_categories ORDER BY sort_order, slug");
  return rows;
}

// Whitelisted ORDER BY fragments: user input never reaches the SQL text.
// Verified profiles are never ranked above others by anything except the explicit sort (no paid placement).
const ORDER: Record<SearchFilters["sort"], string> = {
  popular: "p.popularity DESC, p.rating_avg DESC, p.id",
  rating: "p.rating_avg DESC, p.reviews_count DESC, p.id",
  priceAsc: "p.price_from ASC, p.rating_avg DESC, p.id",
  priceDesc: "p.price_to DESC, p.rating_avg DESC, p.id",
};

/** Only published profiles are ever returned. All user input is bound as parameters. */
export async function searchSpecialists(f: SearchFilters): Promise<SearchResult> {
  const where: string[] = ["p.is_published"];
  const args: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    args.push(value);
    where.push(sql.replace("?", `$${args.length}`));
  };

  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    args.push(like);
    const n = `$${args.length}`;
    where.push(
      `(p.display_name ILIKE ${n} OR p.headline ILIKE ${n} OR c.name->>'ru' ILIKE ${n} OR c.name->>'uz' ILIKE ${n} OR c.name->>'en' ILIKE ${n}
          OR c.name->>'uz-cyrl' ILIKE ${n} OR c.name->>'kaa' ILIKE ${n})`,
    );
  }
  if (f.category) add("p.category = ?", f.category);
  if (f.city) add("p.city = ?", f.city);
  if (f.format) add("? = ANY(p.formats)", f.format);
  if (f.age !== null) {
    args.push(f.age);
    where.push(`p.age_min <= $${args.length} AND p.age_max >= $${args.length}`);
  }
  // Price ranges overlap: the specialist's [price_from, price_to] intersects the requested [min, max].
  if (f.priceMin !== null) add("p.price_to >= ?", f.priceMin);
  if (f.priceMax !== null) add("p.price_from <= ?", f.priceMax);
  if (f.minRating !== null) add("p.rating_avg >= ?", f.minRating);
  if (f.verifiedOnly) where.push("p.verification_status = 'confirmed'");

  const offset = (f.page - 1) * PAGE_SIZE;
  args.push(PAGE_SIZE, offset);
  const limitArg = `$${args.length - 1}`;
  const offsetArg = `$${args.length}`;

  const { rows } = await db().query(
    `SELECT p.id, p.display_name, p.category, c.name AS category_name, p.headline, p.city, p.formats,
            p.price_from, p.price_to, p.experience_years, p.age_min, p.age_max,
            p.rating_avg::float8 AS rating_avg, p.reviews_count, p.verification_status, p.is_demo,
            count(*) OVER() AS total
       FROM specialist_profiles p
       JOIN specialist_categories c ON c.slug = p.category
      WHERE ${where.join(" AND ")}
      ORDER BY ${ORDER[f.sort]}
      LIMIT ${limitArg} OFFSET ${offsetArg}`,
    args,
  );

  const total = rows[0] ? Number(rows[0].total) : 0;
  return {
    total,
    page: f.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: rows.map(toCard),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a pg row with the columns selected above
function toCard(r: any): SpecialistCard {
  return {
    id: r.id,
    displayName: r.display_name,
    category: r.category,
    categoryName: r.category_name,
    headline: r.headline,
    city: r.city,
    formats: r.formats,
    priceFrom: r.price_from,
    priceTo: r.price_to,
    experienceYears: r.experience_years,
    ageMin: r.age_min,
    ageMax: r.age_max,
    ratingAvg: r.rating_avg,
    reviewsCount: r.reviews_count,
    verified: r.verification_status === "confirmed",
    isDemo: r.is_demo,
  };
}

export type SpecialistProfile = SpecialistCard & {
  bio: string;
  /** Visible in the catalog. An owner may look at their own profile before that (preview). */
  isPublished: boolean;
  isOwn: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One specialist profile for the profile page. Only published profiles are returned, except the viewer's own
 * (preview). Never selects contact data, the owner's user id or anything from the users table.
 */
export async function getSpecialistProfile(id: string, viewerId: string): Promise<SpecialistProfile | null> {
  if (!UUID_RE.test(id)) return null;
  const { rows } = await db().query(
    `SELECT p.id, p.display_name, p.category, c.name AS category_name, p.headline, p.bio, p.city, p.formats,
            p.price_from, p.price_to, p.experience_years, p.age_min, p.age_max,
            p.rating_avg::float8 AS rating_avg, p.reviews_count, p.verification_status, p.is_demo, p.is_published,
            (p.user_id IS NOT NULL AND p.user_id = $2::uuid) AS is_own
       FROM specialist_profiles p
       JOIN specialist_categories c ON c.slug = p.category
      WHERE p.id = $1::uuid AND (p.is_published OR p.user_id = $2::uuid)`,
    [id, viewerId],
  );
  const r = rows[0];
  return r ? { ...toCard(r), bio: r.bio, isPublished: r.is_published, isOwn: r.is_own } : null;
}

/** Id of the viewer's own specialist profile (for "view my profile" links), or null. */
export async function ownSpecialistProfileId(userId: string): Promise<string | null> {
  const { rows } = await db().query<{ id: string }>("SELECT id FROM specialist_profiles WHERE user_id = $1", [userId]);
  return rows[0]?.id ?? null;
}
