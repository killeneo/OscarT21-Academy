import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/auth/db";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, type Locale } from "@/lib/i18n";
import { listCategories } from "@/lib/search/specialists";
import { AuthShell } from "./auth-shell";
import { OnboardingForm, type OnboardingInitial } from "./onboarding-form";

const EMPTY: OnboardingInitial = {
  city: "", displayName: "", orgName: "", orgType: "", category: "", formats: [],
  priceFrom: "", priceTo: "", experienceYears: "", ageMin: "", ageMax: "", headline: "",
};

async function Body({ lang }: { lang: Locale }) {
  const m = getMessages(lang);
  const user = await getSessionUser().catch(() => null);
  // Server-side gate: only a signed-in user sees (and can save) a profile, and only for their own role.
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/onboarding`)}`);
  if (user.role !== "parent" && user.role !== "specialist" && user.role !== "organization") redirect(`/${lang}/account`);

  const initial: OnboardingInitial = { ...EMPTY, displayName: user.displayName };
  let locked = false;
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
      `SELECT display_name, category, city, formats, price_from, price_to, experience_years, age_min, age_max, headline, verification_status
         FROM specialist_profiles WHERE user_id = $1`,
      [user.id],
    );
    const row = s.rows[0];
    if (row) {
      Object.assign(initial, {
        displayName: row.display_name, category: row.category, city: row.city, formats: row.formats,
        priceFrom: String(row.price_from), priceTo: String(row.price_to), experienceYears: String(row.experience_years),
        ageMin: String(row.age_min), ageMax: String(row.age_max), headline: row.headline,
      });
      locked = !["draft", "needs_documents"].includes(row.verification_status);
    }
  }

  const titles = {
    parent: [m.onboarding.parentTitle, m.onboarding.parentText],
    organization: [m.onboarding.orgTitle, m.onboarding.orgText],
    specialist: [m.onboarding.specTitle, m.onboarding.specText],
  } as const;
  const [title, subtitle] = titles[user.role];

  return (
    <AuthShell lang={lang} brand={m.common.brand} skipLabel={m.common.skipToContent} m={m.auth} title={title} subtitle={subtitle}>
      <OnboardingForm
        role={user.role}
        lang={lang}
        m={m.onboarding}
        auth={m.auth}
        cities={m.search.cities}
        categories={categories}
        initial={initial}
        locked={locked}
      />
    </AuthShell>
  );
}

export function OnboardingPage({ lang }: { lang: Locale }) {
  return (
    <Suspense fallback={null}>
      <Body lang={lang} />
    </Suspense>
  );
}
