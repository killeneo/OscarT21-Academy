import type { Locale, Messages } from "@/lib/i18n";
import { LangSwitcher } from "./lang-switcher";
import { LogoMark } from "./icons";
import styles from "./site-chrome.module.css";

type Props = { m: Messages["nav"]; brand: string; lang: Locale };

/** Logo left, centered links, login + pill CTA on the right. Hrefs are in-page anchors until real routes exist. */
export function SiteHeader({ m, brand, lang }: Props) {
  const links = [
    { href: "#about", label: m.about },
    { href: "#courses", label: m.courses },
    { href: "#specialists", label: m.specialists },
    { href: "#roles", label: m.roles },
  ];
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <a href={`/${lang}`} className={styles.logo}>
          <LogoMark className={styles.logoIcon} />
          <span>{brand}</span>
        </a>
        <nav aria-label={m.label} className={styles.nav}>
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.actions}>
          <LangSwitcher current={lang} label={m.langLabel} />
          <a href="#roles" className={styles.login}>
            {m.login}
          </a>
          <a href="#roles" className={styles.signup}>
            {m.signup}
          </a>
        </div>
      </div>
    </header>
  );
}
