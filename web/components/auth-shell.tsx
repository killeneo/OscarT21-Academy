import type { ReactNode } from "react";
import type { Locale, Messages } from "@/lib/i18n";
import { AvatarFace, LogoMark, Sparkle } from "./icons";
import styles from "./auth.module.css";

type Props = {
  lang: Locale;
  brand: string;
  skipLabel: string;
  m: Messages["auth"];
  title: string;
  subtitle: string;
  children: ReactNode;
};

/** Two-column auth layout: brand panel (hidden on small screens) + form card. */
export function AuthShell({ lang, brand, skipLabel, m, title, subtitle, children }: Props) {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">
        {skipLabel}
      </a>
      <aside className={styles.side}>
        <Sparkle className={styles.sparkle} />
        <a href={`/${lang}`} className={styles.brand}>
          <LogoMark style={{ width: 34, height: 34 }} />
          {brand}
        </a>
        <div className={styles.sideBody}>
          <h2>{m.sideTitle}</h2>
          <p>{m.sideText}</p>
          <div className={styles.faces} aria-hidden="true">
            <AvatarFace tone="gold" />
            <AvatarFace tone="teal" />
            <AvatarFace tone="emerald" />
          </div>
        </div>
      </aside>
      <main id="main" className={styles.main}>
        <div className={styles.card}>
          <a href={`/${lang}`} className={styles.mobileBrand}>
            <LogoMark style={{ width: 32, height: 32 }} />
            {brand}
          </a>
          <h1>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
