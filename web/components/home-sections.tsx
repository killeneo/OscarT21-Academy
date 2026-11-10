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
  HeroScene,
  PlayIcon,
  ShieldIcon,
  Sparkle,
  StudyScene,
} from "./icons";
import styles from "./home-sections.module.css";

/*
 * Landing sections. Decorative art (sparkles, arches, floating cards) is aria-hidden or duplicated in
 * real text, and all animation is removed under prefers-reduced-motion (see globals.css).
 * Sample specialists/courses are PLACEHOLDERS and are labelled as examples; no real people or numbers.
 */

export function Hero({ m }: { m: Messages["hero"] }) {
  const badges = [
    { ...m.badges.verify, icon: <ShieldIcon />, cls: styles.badgeOne },
    { ...m.badges.certs, icon: <AwardIcon />, cls: styles.badgeTwo },
    { ...m.badges.format, icon: <GlobeIcon />, cls: styles.badgeThree },
  ];
  return (
    <section className={`${styles.hero} ${styles.wrap}`} aria-labelledby="hero-title">
      <Sparkle className={`${styles.sparkle} ${styles.sparkHeroA}`} />
      <div className={styles.heroText}>
        <h1 id="hero-title" className={styles.h1}>
          {m.titleA} <AvatarFace tone="peach" className={styles.inlineAvatar} /> {m.titleB}{" "}
          <AvatarFace tone="lavender" className={styles.inlineAvatar} /> {m.titleC}
        </h1>
        <p className={styles.lead}>{m.subtitle}</p>
        <div className={styles.heroActions}>
          <a href="#specialists" className={styles.btnPrimary}>
            {m.primary}
          </a>
          <a href="#courses" className={styles.btnPlay}>
            <PlayIcon className={styles.playIcon} />
            {m.secondary}
          </a>
        </div>
      </div>

      <div className={styles.heroVisual}>
        <HeroScene className={styles.heroScene} role="img" aria-label={m.imageLabel} aria-hidden={undefined} />
        <Sparkle className={`${styles.sparkle} ${styles.sparkHeroB}`} />
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

export function Categories({ m }: { m: Messages["categories"] }) {
  const icons = [<BookIcon key="b" />, <HandsIcon key="h" />, <ChildIcon key="c" />, <ChatIcon key="t" />];
  const tints = [styles.peach, styles.butter, styles.mint, styles.lavender];
  return (
    <section className={`${styles.section} ${styles.wrap}`} aria-labelledby="cat-title">
      <SectionHead id="cat-title" kicker={m.kicker} title={m.title} subtitle={m.subtitle} />
      <ul className={styles.catGrid}>
        {m.items.map((item, i) => (
          <li key={item.title} className={`${styles.catCard} ${tints[i]}`}>
            <span className={styles.catIcon}>{icons[i]}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ValueProp({ m }: { m: Messages["value"] }) {
  return (
    <section id="about" className={`${styles.section} ${styles.cream}`} aria-labelledby="value-title">
      <div className={`${styles.split} ${styles.wrap}`}>
        <div className={styles.splitVisual}>
          <StudyScene className={styles.studyScene} role="img" aria-label={m.imageLabel} aria-hidden={undefined} />
          <p className={`${styles.floatCard} ${styles.valueBadgeA}`}>
            <span className={styles.floatIcon}>
              <ShieldIcon />
            </span>
            <strong>{m.badgeA}</strong>
          </p>
          <p className={`${styles.floatCard} ${styles.valueBadgeB}`}>
            <span className={styles.floatIcon}>
              <AwardIcon />
            </span>
            <strong>{m.badgeB}</strong>
          </p>
        </div>
        <div>
          <p className={styles.kicker}>{m.kicker}</p>
          <h2 id="value-title" className={styles.h2}>
            {m.title}
          </h2>
          <p className={styles.sectionText}>{m.text}</p>
          <ul className={styles.checklist}>
            {m.points.map((p) => (
              <li key={p}>
                <CheckIcon className={styles.checkIcon} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <a href="#roles" className={styles.btnPrimary}>
            {m.cta}
          </a>
        </div>
      </div>
    </section>
  );
}

export function SpecialistCatalog({ m }: { m: Messages["catalog"] }) {
  const tints = [styles.mint, styles.lavender, styles.peach];
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
              <AvatarFace tone={(["mint", "lavender", "peach"] as const)[i]} className={styles.specAvatar} />
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

export function Courses({ m }: { m: Messages["courses"] }) {
  const tints = [styles.butter, styles.peach, styles.lavender];
  return (
    <section id="courses" className={`${styles.section} ${styles.cream}`} aria-labelledby="courses-title">
      <div className={styles.wrap}>
        <SectionHead id="courses-title" kicker={m.kicker} title={m.title} subtitle={m.subtitle} />
        <ul className={styles.cardGrid}>
          {m.items.map((c, i) => (
            <li key={c.title} className={styles.courseCard}>
              <div className={`${styles.cover} ${tints[i]}`}>
                <span className={styles.pill}>{c.type}</span>
                <span className={styles.pillSoon}>{m.badgeSoon}</span>
                <BookIcon className={styles.coverIcon} />
              </div>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <p className={styles.meta}>{c.meta}</p>
              <span className={styles.btnOutline} aria-disabled="true">
                {m.cta}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Stats({ m }: { m: Messages["stats"] }) {
  const tints = [styles.mint, styles.butter, styles.lavender];
  return (
    <section className={`${styles.section} ${styles.wrap}`} aria-labelledby="stats-title">
      <SectionHead id="stats-title" kicker={m.kicker} title={m.title} />
      <ul className={styles.statGrid}>
        {m.items.map((s, i) => (
          <li key={s.label} className={`${styles.statCard} ${tints[i]}`}>
            <p className={styles.statValue}>{s.value}</p>
            <h3>{s.label}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Roles({ m }: { m: Messages["roles"] }) {
  const tints = [styles.mint, styles.peach, styles.lavender];
  return (
    <section id="roles" className={`${styles.section} ${styles.cream}`} aria-labelledby="roles-title">
      <div className={styles.wrap}>
        <SectionHead id="roles-title" kicker={m.kicker} title={m.title} subtitle={m.subtitle} />
        <ul className={styles.cardGrid}>
          {m.items.map((r, i) => (
            <li key={r.title} className={`${styles.roleCard} ${tints[i]}`}>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
              {/* Registration is not built yet: the link is a placeholder for the sign-up route. */}
              <a href="#" className={styles.btnPrimary}>
                {r.cta}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CtaBand({ m }: { m: Messages["cta"] }) {
  return (
    <section className={`${styles.wrap} ${styles.ctaWrap}`} aria-labelledby="cta-title">
      <div className={styles.ctaBand}>
        <Sparkle className={`${styles.sparkle} ${styles.sparkCta}`} />
        <h2 id="cta-title" className={styles.h2}>
          {m.title}
        </h2>
        <p className={styles.sectionText}>{m.subtitle}</p>
        <a href="#roles" className={styles.btnPrimary}>
          {m.button}
        </a>
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
