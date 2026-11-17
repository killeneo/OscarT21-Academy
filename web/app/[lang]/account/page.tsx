import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "@/components/logout-button";
import { ResendVerification } from "@/components/resend-verification";
import { db } from "@/lib/auth/db";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, hasLocale, type Locale } from "@/lib/i18n";
import styles from "@/components/auth.module.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function AccountBody({ lang }: { lang: Locale }) {
  const m = getMessages(lang);
  const user = await getSessionUser().catch(() => null);
  // Server-side gate: the page content is never rendered without a valid session.
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/account`)}`);

  const o = m.onboarding;
  const editable = user.role === "parent" || user.role === "specialist" || user.role === "organization";
  let specialistStatus: string | null = null;
  if (user.role === "specialist") {
    const r = await db().query<{ verification_status: string }>("SELECT verification_status FROM specialist_profiles WHERE user_id = $1", [user.id]);
    specialistStatus = r.rows[0]?.verification_status ?? null;
  }

  return (
    <div className={styles.accountCard}>
      <h1>
        {m.auth.account.hello}
        {user.displayName ? `, ${user.displayName}` : ""}
      </h1>
      <dl className={styles.facts}>
        <div>
          <dt>{m.auth.account.email}</dt>
          <dd>
            {user.email ?? m.auth.account.noEmail}
            {user.email ? (
              <small style={{ display: "block", fontWeight: 600, color: "var(--ink-muted)" }}>
                {user.emailVerified ? o.verifiedYes : o.verifiedNo}
              </small>
            ) : null}
          </dd>
        </div>

        <div>
          <dt>{m.auth.account.role}</dt>
          <dd>{user.role in m.auth.roles ? m.auth.roles[user.role as keyof typeof m.auth.roles] : user.role}</dd>
        </div>
        {user.role === "specialist" ? (
          <div>
            <dt>{o.status}</dt>
            <dd>{specialistStatus ? (o.statuses[specialistStatus as keyof typeof o.statuses] ?? specialistStatus) : o.notFilled}</dd>
          </div>
        ) : null}
      </dl>
      {user.email && !user.emailVerified ? (
        <div style={{ marginBottom: 16 }}>
          <ResendVerification lang={lang} label={o.resend} doneLabel={o.resent} errorLabel={m.auth.errors.rate_limited} />
        </div>
      ) : null}
      {editable ? (
        <p style={{ marginBottom: 16 }}>
          <a className={styles.secondaryBtn} href={`/${lang}/onboarding`}>
            {user.onboardingCompleted ? o.editProfile : o.fillProfile}
          </a>
        </p>
      ) : null}
      <div className={styles.actions}>
        <a className={styles.submit} href={`/${lang}/specialists`}>
          {m.search.navSearch}
        </a>
        <a className={styles.social} href={`/${lang}`}>
          {m.auth.account.home}
        </a>
        <LogoutButton lang={lang} label={m.auth.account.logout} busyLabel={m.auth.account.loggingOut} />
      </div>
    </div>
  );
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <main className={styles.accountWrap}>
      <Suspense fallback={null}>
        <AccountBody lang={lang} />
      </Suspense>
    </main>
  );
}
