import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { ArrowIcon, AvatarFace, CheckIcon } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";
import { ResendVerification } from "@/components/resend-verification";
import { db } from "@/lib/auth/db";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, hasLocale, localeNames, type Locale } from "@/lib/i18n";
import styles from "@/components/cabinet.module.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["cabinet"]["eyebrow"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** Position of a verification status on the 4-node review track (-1 = off the track: rejected / blocked). */
const TRACK: Record<string, number> = { draft: 0, submitted: 1, auto_check: 1, awaiting_moderation: 2, needs_documents: 2, confirmed: 3 };

type Near = { id: string; display_name: string; category_name: Record<string, string>; rating_avg: number; reviews_count: number; price_from: number; price_to: number };

async function AccountBody({ lang }: { lang: Locale }) {
  const m = getMessages(lang);
  const c = m.cabinet;
  const o = m.onboarding;
  const user = await getSessionUser().catch(() => null);
  // Server-side gate: the page content is never rendered without a valid session.
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/account`)}`);

  const city = (await db().query<{ city: string | null }>("SELECT city FROM users WHERE id = $1", [user.id])).rows[0]?.city ?? null;
  const cityName = city ? (m.search.cities[city as keyof typeof m.search.cities] ?? city) : null;
  const isSelf = user.role === "parent" || user.role === "specialist" || user.role === "organization";

  let status: string | null = null;
  if (user.role === "specialist") {
    status = (await db().query<{ verification_status: string }>("SELECT verification_status FROM specialist_profiles WHERE user_id = $1", [user.id])).rows[0]?.verification_status ?? null;
  }

  let org: { name: string; org_type: string } | null = null;
  if (user.role === "organization") {
    org = (await db().query<{ name: string; org_type: string }>("SELECT name, org_type FROM organizations WHERE owner_user_id = $1", [user.id])).rows[0] ?? null;
  }

  // Only confirmed, published profiles in the parent's own city (the same rule as the public catalog).
  let near: Near[] = [];
  if (user.role === "parent" && city) {
    near = (
      await db().query<Near>(
        `SELECT p.id, p.display_name, c.name AS category_name, p.rating_avg::float8 AS rating_avg, p.reviews_count, p.price_from, p.price_to
           FROM specialist_profiles p JOIN specialist_categories c ON c.slug = p.category
          WHERE p.is_published AND p.verification_status = 'confirmed' AND p.city = $1
          ORDER BY p.rating_avg DESC, p.popularity DESC, p.id LIMIT 3`,
        [city],
      )
    ).rows;
  }

  // ---- steps ----
  const reviewed = status !== null && !["draft", "needs_documents"].includes(status);
  const steps: { key: "account" | "email" | "profile" | "review"; done: boolean }[] = [{ key: "account", done: true }];
  if (user.email) steps.push({ key: "email", done: user.emailVerified });
  if (isSelf) steps.push({ key: "profile", done: user.onboardingCompleted });
  if (user.role === "specialist") steps.push({ key: "review", done: reviewed });
  const doneCount = steps.filter((s) => s.done).length;

  const subtitle = isSelf ? c.subtitles[user.role as "parent" | "specialist" | "organization"] : c.subtitles.staff;
  const nf = new Intl.NumberFormat(localeNames[lang].numbers, { maximumFractionDigits: 0 });
  const priceText = (r: Near) =>
    `${r.price_to > r.price_from ? fill(m.search.priceRange, { from: nf.format(r.price_from), to: nf.format(r.price_to) }) : fill(m.search.priceFromOnly, { from: nf.format(r.price_from) })} ${m.search.currency}`;
  const trackIndex = status ? (TRACK[status] ?? -1) : -1;
  const roleLabel = user.role in m.auth.roles ? m.auth.roles[user.role as keyof typeof m.auth.roles] : user.role;
  const primary =
    user.role === "specialist" && !user.onboardingCompleted
      ? { href: `/${lang}/onboarding`, label: c.actions.profile }
      : { href: `/${lang}`, label: c.catalogCta };

  return (
    <>
      <AppHeader lang={lang} brand={m.common.brand} displayName={user.displayName} m={m} current="account" />
      <main id="main" className={styles.page}>
        <header className={styles.top}>
          <div>
            <p className={styles.eyebrow}>{c.eyebrow}</p>
            <h1 className={styles.hello}>
              {m.auth.account.hello}
              {user.displayName ? `, ${user.displayName}` : ""}
            </h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <a href={primary.href} className={styles.primary}>
            {primary.label} <ArrowIcon className={styles.arrow} />
          </a>
        </header>

        <div className={styles.grid}>
          <div className={styles.col}>
            {steps.length > 1 ? (
              <section className={styles.card} aria-labelledby="steps-title">
                <div className={styles.cardHead}>
                  <h2 id="steps-title" className={styles.cardTitle}>
                    {c.stepsTitle}
                  </h2>
                  <p className={styles.muted}>{fill(c.progress, { done: doneCount, total: steps.length })}</p>
                </div>
                <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label={c.stepsTitle}>
                  <div className={styles.barFill} style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                </div>
                <ol className={styles.steps}>
                  {steps.map((s, i) => (
                    <li key={s.key} className={`${styles.step} ${s.done ? styles.stepDone : ""}`}>
                      <span className={styles.stepMark} aria-hidden="true">
                        {s.done ? <CheckIcon /> : i + 1}
                      </span>
                      <div>
                        <p className={styles.stepTitle}>{c.steps[s.key]}</p>
                        <p className={styles.stepHint}>{c.stepHints[s.key]}</p>
                      </div>
                      {s.done ? (
                        <span className={styles.stepDoneLabel}>{c.done}</span>
                      ) : s.key === "email" ? (
                        <ResendVerification lang={lang} label={o.resend} doneLabel={o.resent} errorLabel={m.auth.errors.rate_limited} compact />
                      ) : (
                        <a className={styles.stepAction} href={`/${lang}/onboarding`}>
                          {s.key === "review" ? c.actions.review : c.actions.profile}
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {user.role === "specialist" ? (
              <section className={styles.card} aria-labelledby="status-title">
                <div className={styles.cardHead}>
                  <h2 id="status-title" className={styles.cardTitle}>
                    {c.statusTitle}
                  </h2>
                  <p className={styles.muted}>{status ? (o.statuses[status as keyof typeof o.statuses] ?? status) : o.notFilled}</p>
                </div>
                <ol className={styles.track}>
                  {(["draft", "submitted", "moderation", "confirmed"] as const).map((k, i) => (
                    <li
                      key={k}
                      className={`${styles.node} ${trackIndex >= i ? styles.reached : ""} ${trackIndex === i ? styles.current : ""}`}
                      aria-current={trackIndex === i ? "step" : undefined}
                    >
                      <span className={styles.dot} aria-hidden="true">
                        {trackIndex > i ? "✓" : i + 1}
                      </span>
                      {c.statusSteps[k]}
                    </li>
                  ))}
                </ol>
                <p className={`${styles.note} ${status === "rejected" || status === "blocked" || status === "needs_documents" ? styles.noteWarn : ""}`}>
                  {c.statusNote[(status ?? "none") as keyof typeof c.statusNote]}
                </p>
              </section>
            ) : null}

            {user.role === "organization" ? (
              <section className={styles.card} aria-labelledby="org-title">
                <div className={styles.cardHead}>
                  <h2 id="org-title" className={styles.cardTitle}>
                    {c.orgTitle}
                  </h2>
                </div>
                {org ? (
                  <div className={styles.orgLine}>
                    <p className={styles.orgName}>{org.name}</p>
                    <p className={styles.muted}>
                      {o.orgTypes[org.org_type as keyof typeof o.orgTypes] ?? org.org_type}
                      {cityName ? ` · ${cityName}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className={styles.muted}>{c.orgNone}</p>
                )}
              </section>
            ) : null}

            {user.role === "parent" ? (
              <section className={styles.card} aria-labelledby="near-title">
                <div className={styles.cardHead}>
                  <h2 id="near-title" className={styles.cardTitle}>
                    {c.nearTitle}
                  </h2>
                  {cityName ? <p className={styles.muted}>{cityName}</p> : null}
                </div>
                {!city ? (
                  <p className={styles.muted}>{c.nearNoCity}</p>
                ) : near.length === 0 ? (
                  <p className={styles.muted}>{c.nearEmpty}</p>
                ) : (
                  <ul className={styles.near}>
                    {near.map((r, i) => (
                      <li key={r.id} className={styles.nearCard}>
                        <div className={styles.nearTop}>
                          <AvatarFace tone={(["gold", "teal", "emerald"] as const)[i % 3]} className={styles.nearAvatar} />
                          <div>
                            <p className={styles.nearName}>{r.display_name}</p>
                            <p className={styles.nearMeta}>{r.category_name[lang] ?? r.category_name.ru}</p>
                          </div>
                        </div>
                        <p className={styles.nearRow}>
                          <span>{priceText(r)}</span>
                          <span>
                            <span aria-hidden="true">★</span>
                            <span className="sr-only">{m.search.rating}: </span>
                            {r.rating_avg.toLocaleString(localeNames[lang].numbers, { minimumFractionDigits: 1 })}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <a className={styles.linkAll} href={`/${lang}${city ? `?city=${city}` : ""}`}>
                  {c.nearAll} <ArrowIcon className={styles.arrow} />
                </a>
              </section>
            ) : null}

            {!isSelf ? (
              <section className={styles.card}>
                <p className={styles.muted}>{c.staffNote}</p>
              </section>
            ) : null}
          </div>

          <aside className={`${styles.card} ${styles.aside}`} aria-labelledby="acc-title">
            <h2 id="acc-title" className="sr-only">
              {c.accountTitle}
            </h2>
            <div className={styles.who}>
              <span className={styles.initial} aria-hidden="true">
                {(user.displayName || user.email || "?").trim().charAt(0).toUpperCase()}
              </span>
              <div>
                <p className={styles.whoName}>{user.displayName || user.email || m.auth.account.noEmail}</p>
                <span className={styles.role}>{roleLabel}</span>
              </div>
            </div>
            <dl className={styles.facts}>
              <div>
                <dt>{m.auth.account.email}</dt>
                <dd>
                  {user.email ?? m.auth.account.noEmail}
                  {user.email ? (
                    <small style={{ display: "block", fontWeight: 600 }} className={user.emailVerified ? styles.verified : styles.unverified}>
                      {user.emailVerified ? o.verifiedYes : o.verifiedNo}
                    </small>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>{c.city}</dt>
                <dd>{cityName ?? c.cityNone}</dd>
              </div>
            </dl>
            <div className={styles.asideActions}>
              {isSelf ? (
                <a className={styles.outlineBtn} href={`/${lang}/onboarding`}>
                  {user.onboardingCompleted ? o.editProfile : o.fillProfile}
                </a>
              ) : null}
              <LogoutButton lang={lang} label={m.auth.account.logout} busyLabel={m.auth.account.loggingOut} className={styles.logout} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <>
      <a className="skip-link" href="#main">
        {getMessages(lang).common.skipToContent}
      </a>
      <Suspense fallback={null}>
        <AccountBody lang={lang} />
      </Suspense>
    </>
  );
}
