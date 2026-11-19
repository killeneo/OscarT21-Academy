import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, localeNames, type Locale } from "@/lib/i18n";
import { getSpecialistProfile, type SpecialistProfile } from "@/lib/search/specialists";
import { AppHeader } from "./app-header";
import { ArrowIcon, AvatarFace, ShieldIcon } from "./icons";
import cabinet from "./cabinet.module.css";
import search from "./search.module.css";
import styles from "./profile.module.css";

type Query = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
const TONES = ["gold", "teal", "emerald", "sand"] as const;

function price(p: SpecialistProfile, lang: Locale) {
  const m = getMessages(lang).search;
  const nf = new Intl.NumberFormat(localeNames[lang].numbers, { maximumFractionDigits: 0 });
  const text = p.priceTo > p.priceFrom ? fill(m.priceRange, { from: nf.format(p.priceFrom), to: nf.format(p.priceTo) }) : fill(m.priceFromOnly, { from: nf.format(p.priceFrom) });
  return `${text} ${m.currency}`;
}

async function Body({ lang, id: idPromise, searchParams }: { lang: Locale; id: Promise<string>; searchParams: Query }) {
  const id = await idPromise;
  const m = getMessages(lang);
  const s = m.search;
  const pm = m.profile;
  const query = await searchParams;
  // Only a same-site catalog path (with its filters) is accepted as the way back.
  const backRaw = first(query.back);
  const back = backRaw && /^\/[a-z-]+(\/specialists|\/account)?(\?|$)/.test(backRaw) ? safeNextPath(backRaw, lang) : `/${lang}`;
  const here = `/${lang}/specialists/${encodeURIComponent(id)}`;

  const user = await getSessionUser().catch(() => null);
  // Server-side gate, as for the catalog: profiles are shown to signed-in users only.
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(here)}`);

  const p = await getSpecialistProfile(id, user.id);
  // Unknown, unpublished (draft, in review, rejected, blocked) and malformed ids all look the same.
  if (!p) notFound();

  const tone = TONES[p.displayName.length % TONES.length];
  const cityName = s.cities[p.city as keyof typeof s.cities] ?? p.city;
  const formats = p.formats.map((f) => s.formats[f as keyof typeof s.formats] ?? f).join(", ");

  return (
    <>
      <AppHeader lang={lang} brand={m.common.brand} displayName={user.displayName} m={m} current="search" />
      <main id="main" className={cabinet.page}>
        <a href={back} className={styles.back}>
          <span aria-hidden="true">←</span> {pm.back}
        </a>

        {p.isOwn && !p.isPublished ? (
          <p className={styles.banner} role="status">
            {pm.previewNote}
          </p>
        ) : null}

        <header className={styles.hero}>
          <AvatarFace tone={tone} className={styles.avatar} />
          <div className={styles.heroText}>
            <h1 className={styles.name}>{p.displayName}</h1>
            <p className={styles.category}>{p.categoryName[lang] ?? p.categoryName.ru}</p>
            <div className={styles.badges}>
              <p className={p.verified ? search.badgeOk : search.badgeWait}>
                {p.verified ? <ShieldIcon /> : null}
                {p.verified ? s.verified : s.notVerified}
              </p>
              {p.isDemo ? <p className={search.demo}>{s.demo}</p> : null}
            </div>
          </div>
        </header>

        <div className={cabinet.grid}>
          <div className={styles.sectionGap}>
            <section className={cabinet.card} aria-labelledby="about-title">
              <h2 id="about-title" className={cabinet.cardTitle}>
                {pm.about}
              </h2>
              {p.headline ? <p className={styles.headline}>{p.headline}</p> : null}
              {p.bio ? <p className={styles.bio}>{p.bio}</p> : <p className={`${styles.bio} ${cabinet.muted}`}>{pm.noBio}</p>}
              <p className={cabinet.note}>{p.verified ? pm.verifiedNote : pm.notVerifiedNote}</p>
            </section>

            <section className={cabinet.card} aria-labelledby="reviews-title">
              <h2 id="reviews-title" className={cabinet.cardTitle}>
                {pm.reviews}
              </h2>
              <p className={styles.cardIntro}>
                {p.reviewsCount > 0 ? (
                  <>
                    <span aria-hidden="true">★ </span>
                    <span className="sr-only">{s.rating}: </span>
                    {p.ratingAvg.toLocaleString(localeNames[lang].numbers, { minimumFractionDigits: 1 })} · {fill(s.reviews, { n: p.reviewsCount })}
                  </>
                ) : (
                  s.noReviews
                )}
              </p>
            </section>
          </div>

          <aside className={cabinet.card} aria-labelledby="terms-title">
            <h2 id="terms-title" className={cabinet.cardTitle}>
              {pm.terms}
            </h2>
            <dl className={cabinet.facts} style={{ marginTop: 16 }}>
              <div>
                <dt>{pm.price}</dt>
                <dd>{price(p, lang)}</dd>
              </div>
              <div>
                <dt>{pm.formats}</dt>
                <dd>{formats}</dd>
              </div>
              <div>
                <dt>{pm.city}</dt>
                <dd>{cityName}</dd>
              </div>
              <div>
                <dt>{pm.experience}</dt>
                <dd>{fill(pm.years, { n: p.experienceYears })}</dd>
              </div>
              <div>
                <dt>{pm.ages}</dt>
                <dd>{fill(pm.agesRange, { from: p.ageMin, to: p.ageMax })}</dd>
              </div>
            </dl>
            <p className={cabinet.muted}>{pm.contactSoon}</p>
            {p.isOwn ? (
              <a href={`/${lang}/settings`} className={cabinet.linkAll}>
                {pm.editOwn} <ArrowIcon className={cabinet.arrow} />
              </a>
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}

/** Everything request-specific (id, session, database) is behind Suspense; the shell stays static. */
export function SpecialistProfilePage({ lang, id, searchParams }: { lang: Locale; id: Promise<string>; searchParams: Query }) {
  return (
    <>
      <a className="skip-link" href="#main">
        {getMessages(lang).common.skipToContent}
      </a>
      <Suspense fallback={null}>
        <Body lang={lang} id={id} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
