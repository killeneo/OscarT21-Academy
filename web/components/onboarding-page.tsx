import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, type Locale } from "@/lib/i18n";
import { AuthShell } from "./auth-shell";
import { OnboardingForm } from "./onboarding-form";
import { loadRoleProfile } from "./role-profile-data";

async function Body({ lang }: { lang: Locale }) {
  const m = getMessages(lang);
  const user = await getSessionUser().catch(() => null);
  // Server-side gate: only a signed-in user sees (and can save) a profile, and only for their own role.
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/onboarding`)}`);
  if (user.role !== "parent" && user.role !== "specialist" && user.role !== "organization") redirect(`/${lang}/account`);

  const { initial, lock, categories } = await loadRoleProfile(user, lang);

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
        lock={lock}
        mode="onboarding"
        needsVerification={user.role !== "parent" && user.email !== null && !user.emailVerified}
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
