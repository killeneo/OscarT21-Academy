import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages, hasLocale } from "@/lib/i18n";
import styles from "@/components/auth.module.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const m = getMessages(lang);
  return { title: `${m["privacy"]["title"]} — ${m.common.brand}`, robots: { index: false, follow: false } };
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const m = getMessages(lang);
  const p = m.privacy;
  return (
    <>
      <a className="skip-link" href="#main">
        {m.common.skipToContent}
      </a>
    <main id="main" className={styles.accountWrap}>
      <article className={styles.accountCard} style={{ width: "min(720px, 100%)" }}>
        <h1>{p.title}</h1>
        <p className={styles.notice} style={{ margin: "16px 0 24px" }}>
          {p.draft}
        </p>
        {p.sections.map((s) => (
          <section key={s.h} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: "1.15rem", marginBottom: 6 }}>{s.h}</h2>
            <p style={{ color: "var(--ink-muted)" }}>{s.p}</p>
          </section>
        ))}
        <a className={styles.social} href={`/${lang}`}>
          {m.auth.account.home}
        </a>
      </article>
    </main>
    </>
  );
}
