import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/auth/db";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, type Locale } from "@/lib/i18n";
import { AppHeader } from "./app-header";
import { ArrowIcon } from "./icons";
import { OnboardingForm } from "./onboarding-form";
import { loadRoleProfile } from "./role-profile-data";
import { AccountForm, PasswordForm } from "./settings-forms";
import cabinet from "./cabinet.module.css";
import styles from "./profile.module.css";

/** Settings of the signed-in user, for every role. Everything shown and saved here is the user's own. */
async function Body({ lang }: { lang: Locale }) {
  const m = getMessages(lang);
  const s = m.settings;
  const user = await getSessionUser().catch(() => null);
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/settings`)}`);

  const { rows } = await db().query<{ has_password: boolean }>("SELECT password_hash IS NOT NULL AS has_password FROM users WHERE id = $1", [user.id]);
  const hasPassword = rows[0]?.has_password === true;
  const selfRole = user.role === "parent" || user.role === "specialist" || user.role === "organization" ? user.role : null;
  const profile = selfRole ? await loadRoleProfile(user, lang) : null;
  const profileText = selfRole === "specialist" ? m.onboarding.specText : selfRole === "organization" ? m.onboarding.orgText : s.parentText;

  return (
    <>
      <AppHeader lang={lang} brand={m.common.brand} displayName={user.displayName} m={m} current="settings" />
      <main id="main" className={cabinet.page}>
        <header className={cabinet.top}>
          <div>
            <p className={cabinet.eyebrow}>{m.cabinet.eyebrow}</p>
            <h1 className={cabinet.hello}>{s.title}</h1>
            <p className={cabinet.subtitle}>{s.subtitle}</p>
          </div>
        </header>

        <div className={styles.settingsGrid}>
          <section className={cabinet.card} aria-labelledby="set-account">
            <h2 id="set-account" className={cabinet.cardTitle}>
              {s.accountTitle}
            </h2>
            <dl className={cabinet.facts} style={{ marginTop: 16 }}>
              <div>
                <dt>{m.auth.account.email}</dt>
                <dd>{user.email ?? m.auth.account.noEmail}</dd>
              </div>
            </dl>
            <p className={styles.cardIntro}>{s.emailNote}</p>
            <AccountForm m={m.auth} s={s} displayName={user.displayName} />
          </section>

          <section className={cabinet.card} aria-labelledby="set-password">
            <h2 id="set-password" className={cabinet.cardTitle}>
              {s.passwordTitle}
            </h2>
            {hasPassword ? (
              <>
                <p className={styles.cardIntro}>{s.passwordText}</p>
                <PasswordForm m={m.auth} s={s} email={user.email} />
              </>
            ) : user.email ? (
              <p className={styles.cardIntro}>
                {s.noPassword} <a href={`/${lang}/forgot-password`}>{s.noPasswordLink}</a>
              </p>
            ) : (
              <p className={styles.cardIntro}>{s.noPasswordTelegram}</p>
            )}
          </section>

          {selfRole && profile ? (
            <section className={cabinet.card} aria-labelledby="set-profile">
              <h2 id="set-profile" className={cabinet.cardTitle}>
                {s.profileTitle}
              </h2>
              <p className={styles.cardIntro}>{profileText}</p>
              {profile.specialistProfileId ? (
                <p style={{ marginBottom: 20 }}>
                  <a href={`/${lang}/specialists/${profile.specialistProfileId}?${new URLSearchParams({ back: `/${lang}/account` })}`} className={cabinet.linkAll} style={{ marginTop: 0 }}>
                    {s.viewProfile} <ArrowIcon className={cabinet.arrow} />
                  </a>
                </p>
              ) : null}
              <OnboardingForm
                role={selfRole}
                lang={lang}
                m={m.onboarding}
                auth={m.auth}
                cities={m.search.cities}
                categories={profile.categories}
                initial={profile.initial}
                lock={profile.lock}
                mode="settings"
                needsVerification={selfRole !== "parent" && user.email !== null && !user.emailVerified}
              />
            </section>
          ) : (
            <section className={cabinet.card}>
              <p className={cabinet.muted}>{m.cabinet.staffNote}</p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export function SettingsPage({ lang }: { lang: Locale }) {
  return (
    <>
      <a className="skip-link" href="#main">
        {getMessages(lang).common.skipToContent}
      </a>
      <Suspense fallback={null}>
        <Body lang={lang} />
      </Suspense>
    </>
  );
}
