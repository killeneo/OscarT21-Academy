import Image from "next/image";
import heroImage from "@/public/images/hero-tutor.webp";
import type { Messages } from "@/lib/i18n";
import {
  ArrowIcon,
  AvatarFace,
  AwardIcon,
  BookIcon,
  CheckIcon,
  ChatIcon,
  ChildIcon,
  GlobeIcon,
  HandsIcon,
  ShieldIcon,
  SlidersIcon,
  Sparkle,
} from "./icons";
import styles from "./home-sections.module.css";

/*
 * Landing sections. Decorative art (sparkles, arches, floating cards) is aria-hidden or duplicated in
 * real text, and all animation is removed under prefers-reduced-motion (see globals.css).
 * Sample specialists/courses are PLACEHOLDERS and are labelled as examples; no real people or numbers.
 */

export function Hero({ m, lang }: { m: Messages["hero"]; lang: string }) {
  const badges = [
    { ...m.badges.verify, icon: <ShieldIcon />, cls: styles.badgeOne },
    { ...m.badges.certs, icon: <AwardIcon />, cls: styles.badgeTwo },
    { ...m.badges.format, icon: <GlobeIcon />, cls: styles.badgeThree },
  ];
  return (
    <section className={`${styles.hero} ${styles.wrap}`} aria-labelledby="hero-title">
      <div className={styles.heroText}>
        <h1 id="hero-title" className={styles.h1}>
          {m.titleBefore} <span className={styles.highlight}>{m.titleHighlight}</span>
          {m.titleAfter ? ` ${m.titleAfter}` : ""}
        </h1>
        <p className={styles.lead}>{m.subtitle}</p>

        {/* Main-page search (ТЗ module 1). Plain GET form: works without JS, lands on the catalog. */}
        <form method="get" action={`/${lang}/specialists`} role="search" className={styles.heroSearch}>
          <label htmlFor="hero-q" className="sr-only">
            {m.searchLabel}
          </label>
          <input
            id="hero-q"
            name="q"
            type="search"
            placeholder={m.searchPlaceholder}
            maxLength={80}
            autoComplete="off"
            className={styles.heroSearchInput}
          />
          <button type="submit" className={styles.btnPrimary}>
            {m.searchButton}
          </button>
        </form>

        <nav aria-label={m.popularLabel} className={styles.popular}>
          <span aria-hidden="true">{m.popularLabel}</span>
          {(Object.entries(m.popular) as [string, string][]).map(([slug, label]) => (
            <a key={slug} href={`/${lang}/specialists?category=${slug}`}>
              {label}
            </a>
          ))}
        </nav>

        <p className={styles.heroLinks}>
          <a href={`/${lang}/register`}>
            {m.becomeSpecialist} <ArrowIcon className={styles.arrow} />
          </a>
          <a href="#courses">
            {m.chooseLearning} <ArrowIcon className={styles.arrow} />
          </a>
        </p>
      </div>

      <div className={styles.heroVisual}>
        {/* Above the fold: preload it (LCP) and let Next serve a resized copy per screen. */}
        <Image
          src={heroImage}
          alt={m.imageLabel}
          className={styles.heroScene}
          priority
          sizes="(max-width: 900px) 92vw, 50vw"
        />
        {/* Floating cards: real text, so screen readers get the same facts as sighted users. */}
        <ul className={styles.badges}>
          {badges.map((b) => (
            <li key={b.title} className={`${styles.floatCard} ${b.cls}`}>
              <span className={styles.floatIcon}>{b.icon}</span>
              <span>
                <strong>{b.title}</strong>
                <span className={styles.floatText}>{b.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AudienceBar({ m }: { m: Messages["audience"] }) {
  return (
    <section className={styles.wrap} aria-label={m.label}>
      <p className={styles.audienceLabel}>{m.label}</p>
      <ul className={styles.audience}>
        {m.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** Programs as a numbered list next to a sticky intro (different rhythm from the card grids around it). */
export function Categories({ m, lang }: { m: Messages["categories"]; lang: string }) {
  const icons = [<BookIcon key="b" />, <HandsIcon key="h" />, <ChildIcon key="c" />, <ChatIcon key="t" />];
  const tints = [styles.tintGold, styles.tintTeal, styles.tintEmerald, styles.tintSand];
  return (
    <section id="courses" className={`${styles.section} ${styles.wrap} ${styles.programsSection}`} aria-labelledby="cat-title">
      <div className={styles.programs}>
        <div className={styles.programsIntro}>
          <p className={styles.kicker}>{m.kicker}</p>
          <h2 id="cat-title" className={styles.h2}>
            {m.title}
          </h2>
          <p className={styles.sectionText}>{m.subtitle}</p>
          <a href={`/${lang}/register`} className={styles.btnPrimary}>
            {m.cta} <ArrowIcon className={styles.arrow} />
          </a>
        </div>

        <ol className={styles.programList}>
          {m.items.map((item, i) => (
            <li key={item.title}>
              <div className={styles.programRow}>
                <span className={styles.programNum} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`${styles.programIcon} ${tints[i]}`}>{icons[i]}</span>
                <span className={styles.programBody}>
                  <span className={styles.programTitle}>{item.title}</span>
                  <span className={styles.programText}>{item.text}</span>
                </span>
                <span className={styles.programFormat}>{item.format}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Verification process (ТЗ section 6) next to the result: a sample card of a verified specialist. */
export function ValueProp({ m }: { m: Messages["value"] }) {
  const c = m.card;
  return (
    <section id="about" className={`${styles.section} ${styles.altBg} ${styles.trustSection}`} aria-labelledby="value-title">
      <div className={`${styles.trust} ${styles.wrap}`}>
        <div>
          <p className={styles.kicker}>{m.kicker}</p>
          <h2 id="value-title" className={`${styles.h2} ${styles.compactH2}`}>
            {m.title}
          </h2>
          <p className={styles.sectionText}>{m.text}</p>

          <ol className={styles.steps}>
            {m.steps.map((s, i) => (
              <li key={s.title}>
                <span className={styles.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong className={styles.stepTitle}>{s.title}</strong>
                  <span className={styles.stepText}>{s.text}</span>
                </span>
              </li>
            ))}
          </ol>

          <a href="#roles" className={`${styles.btnPrimary} ${styles.btnCompact}`}>
            {m.cta} <ArrowIcon className={styles.arrow} />
          </a>
        </div>

        {/* Illustrative mock of the outcome; not interactive, exposed as one labelled figure. */}
        <figure className={styles.trustVisual} aria-label={m.visualLabel}>
          <Sparkle className={`${styles.sparkle} ${styles.sparkTrust}`} />
          <div className={styles.profileCard}>
            <p className={styles.profileSample}>{c.sample}</p>
            <div className={styles.profileHead}>
              <AvatarFace tone="gold" className={styles.profileAvatar} />
              <div>
                <p className={styles.profileName}>{c.name}</p>
                <p className={styles.profileRole}>{c.role}</p>
              </div>
            </div>
            <p className={styles.profileVerified}>
              <ShieldIcon /> {c.verified}
            </p>
            <p className={styles.profileRating}>
              <span aria-hidden="true">★</span>
              <span className="sr-only">{c.ratingLabel}: </span>
              {c.rating}
              <span className={styles.profileReviews}> · {c.reviews}</span>
            </p>
            <ul className={styles.profileChips}>
              <li>{c.online}</li>
              <li>{c.offline}</li>
            </ul>
            <span className={styles.profileButton}>{c.request}</span>
          </div>
          <p className={styles.approvedChip}>
            <CheckIcon className={styles.approvedIcon} /> {c.approved}
          </p>
        </figure>
      </div>
    </section>
  );
}

export function SpecialistCatalog({ m }: { m: Messages["catalog"] }) {
  const tints = [styles.tintEmerald, styles.tintTeal, styles.tintGold];
  return (
    <section id="specialists" className={`${styles.section} ${styles.wrap}`} aria-labelledby="spec-title">
      <SectionHead id="spec-title" kicker={m.kicker} title={m.title} subtitle={m.subtitle} />
      <ul className={styles.filters} aria-label={m.filtersLabel}>
        {m.filters.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <ul className={styles.cardGrid}>
        {m.items.map((item, i) => (
          <li key={item.role} className={styles.specCard}>
            <div className={`${styles.specTop} ${tints[i]}`}>
              <AvatarFace tone={(["emerald", "teal", "gold"] as const)[i]} className={styles.specAvatar} />
              <span className={styles.sample}>{m.sampleNote}</span>
            </div>
            <h3>{item.role}</h3>
            <p className={styles.verified}>
              <ShieldIcon /> {m.verified}
            </p>
            <p className={styles.meta}>{item.format}</p>
            <ul className={styles.tags}>
              {item.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className={styles.centerAction}>
        <a href="#roles" className={styles.btnOutline}>
          {m.cta} <ArrowIcon className={styles.arrow} />
        </a>
      </p>
    </section>
  );
}

/** Key numbers on a dark brand panel: intro on the left, three figures with icons on the right. */
/**
 * "What's inside": three light cards that show the actual contents behind each number
 * (account types as people, learning topics as tags, catalog filters as a mini filter bar).
 */
/**
 * "What's inside": three airy cards. Each shows its number, then a small preview of the real contents
 * (account types as people, learning topics as tags, catalog filters as a mini filter panel).
 */
export function Stats({ m }: { m: Messages["stats"] }) {
  const icons = [<ChildIcon key="a" />, <BookIcon key="b" />, <SlidersIcon key="c" />];
  const iconTints = [styles.tintGold, styles.tintTeal, styles.tintEmerald];
  const tones = ["gold", "teal", "emerald", "sand"] as const;
  const [accounts, topics] = m.items;
  return (
    <section className={`${styles.section} ${styles.wrap} ${styles.insideSection}`} aria-labelledby="stats-title">
      <div className={styles.insideHead}>
        <div>
          <p className={styles.kicker}>{m.kicker}</p>
          <h2 id="stats-title" className={styles.insideTitle}>
            {m.title}
          </h2>
        </div>
        <p className={styles.insideLead}>{m.lead}</p>
      </div>

      <ul className={styles.inside}>
        {m.items.map((s, i) => (
          <li key={s.label} className={styles.insideCard}>
            <span className={`${styles.insideIcon} ${iconTints[i]}`}>{icons[i]}</span>
            <p className={styles.insideFigure}>
              <span className={styles.insideValue}>{s.value}</span>
              <span className={styles.insideLabel}>{s.label}</span>
            </p>
            <p className={styles.insideText}>{s.text}</p>

            <div className={styles.insidePreview}>
              {s === accounts ? (
                <ul className={styles.people}>
                  {s.chips.map((c, j) => (
                    <li key={c}>
                      <AvatarFace tone={tones[j % tones.length]} className={styles.personFace} />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : s === topics ? (
                <ul className={styles.topicTags}>
                  {s.chips.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <ul className={styles.filterMock}>
                  {s.chips.map((c, j) => (
                    <li key={c} className={j % 3 === 0 ? styles.filterOn : undefined}>
                      <span className={styles.filterBox} aria-hidden="true" />
                      <span className={styles.filterName}>{c}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Sign-up by role. Deliberately quiet, editorial layout: heading on the left, roles as rows separated
 * by hairlines on the right. Each CTA opens registration with that role preselected.
 */
/** Frequently asked questions: same two-column grid as the programs/trust blocks, native <details> accordion. */
export function Faq({ m }: { m: Messages["faq"] }) {
  return (
    <section id="faq" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="faq-title">
      <div className={`${styles.wrap} ${styles.faqLayout}`}>
        <div className={styles.faqIntro}>
          <p className={styles.eyebrow}>{m.eyebrow}</p>
          <h2 id="faq-title" className={styles.rolesTitle}>
            {m.title}
          </h2>
          <p className={styles.rolesLead}>{m.lead}</p>
        </div>

        <div className={styles.faqList}>
          {m.items.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary className={styles.faqQ}>
                <span>{item.q}</span>
                <span className={styles.faqIcon} aria-hidden="true" />
              </summary>
              <p className={styles.faqA}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Roles({ m, lang }: { m: Messages["roles"]; lang: string }) {
  const roles = ["specialist", "parent", "organization"] as const;
  return (
    <section id="roles" className={`${styles.section} ${styles.altBg} ${styles.rolesSection}`} aria-labelledby="roles-title">
      <div className={`${styles.wrap} ${styles.rolesLayout}`}>
        <div className={styles.rolesIntro}>
          <p className={styles.eyebrow}>{m.kicker}</p>
          <h2 id="roles-title" className={styles.rolesTitle}>
            {m.title}
          </h2>
          <p className={styles.rolesLead}>{m.subtitle}</p>
          <p className={styles.rolesNote}>{m.note}</p>
        </div>

        <ul className={styles.roleList}>
          {m.items.map((r, i) => (
            <li key={r.title} className={styles.roleRow}>
              <div>
                <p className={styles.roleAudience}>{r.audience}</p>
                <h3 className={styles.roleName}>{r.title}</h3>
                <p className={styles.roleDesc}>{r.text}</p>
                <p className={styles.roleBenefits}>{r.points.join(" · ")}</p>
              </div>
              <a href={`/${lang}/register?role=${roles[i]}`} className={styles.roleLink}>
                {r.cta}
                <ArrowIcon className={styles.roleLinkArrow} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Closing call to action: a full-width dark band that flows into the dark footer.
 * Headline and actions on the left, three plain facts about the platform on the right.
 */
export function CtaBand({ m, lang }: { m: Messages["cta"]; lang: string }) {
  return (
    <section className={styles.ctaSection} aria-labelledby="cta-title">
      <div className={`${styles.wrap} ${styles.ctaGrid}`}>
        <div>
          <p className={styles.ctaEyebrow}>{m.eyebrow}</p>
          <h2 id="cta-title" className={styles.ctaTitle}>
            {m.title}
          </h2>
          <p className={styles.ctaText}>{m.subtitle}</p>
          <div className={styles.ctaActions}>
            <a href={`/${lang}/register`} className={styles.ctaPrimary}>
              {m.button} <ArrowIcon className={styles.roleLinkArrow} />
            </a>
            <a href={`/${lang}/specialists`} className={styles.ctaSecondary}>
              {m.secondary}
            </a>
          </div>
        </div>

        <ol className={styles.ctaFacts}>
          {m.facts.map((f, i) => (
            <li key={f}>
              <span className={styles.ctaFactNum} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              {f}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SectionHead({ id, kicker, title, subtitle }: { id: string; kicker: string; title: string; subtitle?: string }) {
  return (
    <div className={styles.head}>
      <p className={styles.kicker}>{kicker}</p>
      <h2 id={id} className={styles.h2}>
        {title}
      </h2>
      {subtitle ? <p className={styles.sectionText}>{subtitle}</p> : null}
    </div>
  );
}
