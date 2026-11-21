// Server-only module (database access); imported from server components only.
import { db } from "@/lib/auth/db";
import type { SessionUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n";
import { listCategories } from "@/lib/search/specialists";
import type { OnboardingInitial, ProfileLock } from "./onboarding-form";

const EMPTY: OnboardingInitial = {
  city: "", displayName: "", orgName: "", orgType: "", category: "", formats: [],
  priceFrom: "", priceTo: "", experienceYears: "", ageMin: "", ageMax: "", headline: "", bio: "",
};

export type RoleProfileData = {
  initial: OnboardingInitial;
  lock: ProfileLock;
  categories: { slug: string; name: string }[];
  /** Id of the own specialist profile, for the "view as others see it" link. */
  specialistProfileId: string | null;
};

/** The signed-in user's own role profile, as the onboarding and settings forms edit it. Only the own rows are read. */
export async function loadRoleProfile(user: SessionUser, lang: Locale): Promise<RoleProfileData> {
  const initial: OnboardingInitial = { ...EMPTY, displayName: user.displayName };
  let lock: ProfileLock = "none";
  let specialistProfileId: string | null = null;
  const u = await db().query<{ city: string | null }>("SELECT city FROM users WHERE id = $1", [user.id]);
  initial.city = u.rows[0]?.city ?? "";

  if (user.role === "organization") {
    const o = await db().query<{ name: string; org_type: string; city: string }>(
      "SELECT name, org_type, city FROM organizations WHERE owner_user_id = $1",
      [user.id],
    );
    if (o.rows[0]) Object.assign(initial, { orgName: o.rows[0].name, orgType: o.rows[0].org_type, city: o.rows[0].city });
  }

  let categories: { slug: string; name: string }[] = [];
  if (user.role === "specialist") {
    categories = (await listCategories()).map((c) => ({ slug: c.slug, name: c.name[lang] ?? c.name.ru }));
    const s = await db().query(
      `SELECT id, display_name, category, city, formats, price_from, price_to, experience_years, age_min, age_max,
              headline, bio, verification_status
         FROM specialist_profiles WHERE user_id = $1`,
      [user.id],
    );
    const row = s.rows[0];
    if (row) {
      specialistProfileId = row.id;
      Object.assign(initial, {
        displayName: row.display_name, category: row.category, city: row.city, formats: row.formats,
        priceFrom: String(row.price_from), priceTo: String(row.price_to), experienceYears: String(row.experience_years),
        ageMin: String(row.age_min), ageMax: String(row.age_max), headline: row.headline, bio: row.bio,
      });
      const status: string = row.verification_status;
      lock = status === "rejected" || status === "blocked" ? "full" : status === "draft" || status === "needs_documents" ? "none" : "partial";
    }
  }
  return { initial, lock, categories, specialistProfileId };
}
