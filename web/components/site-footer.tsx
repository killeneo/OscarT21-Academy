import type { Locale, Messages } from "@/lib/i18n";
import { LangSwitcher } from "./lang-switcher";
import { LogoMark } from "./icons";
import styles from "./site-chrome.module.css";

type Props = {
  m: Messages["footer"];
  brand: string;
  lang: Locale;
  langLabel: string;
};

/** Links that point to pages which do not exist yet use "#" placeholders and must be replaced when those pages ship. */
export function SiteFooter({ m, brand, lang, langLabel }: Props) {
  const columns = [m.columns.platform, m.columns.help, m.columns.legal];

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <a href={`/${lang}`} className={styles.brand}>
            <LogoMark style={{ height: 34 }} />
            {brand}
          </a>
          <p className={styles.about}>{m.about}</p>
        </div>

        <nav className={styles.columns} aria-label={m.navLabel}>
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className={styles.colTitle}>{col.title}</h2>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href === "#privacy" ? `/${lang}/privacy` : link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className={styles.bottom}>
        <p>
          © {brand}. {m.rights}
        </p>
        <LangSwitcher current={lang} label={langLabel} placement="up" />
      </div>

      {/* Decorative oversized wordmark that closes the page. */}
      <p className={styles.wordmark} aria-hidden="true">
        {brand}
      </p>
    </footer>
  );
}
