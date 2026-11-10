import { locales, localeNames, type Locale } from "@/lib/i18n";
import styles from "./lang-switcher.module.css";

type Props = {
  current: Locale;
  label: string;
  className?: string;
};

/**
 * Plain links to the other language pages (no JS) so crawlers can follow them.
 * Each link carries hrefLang/lang; the current page is marked with aria-current.
 */
export function LangSwitcher({ current, label, className }: Props) {
  return (
    <nav aria-label={label} className={`${styles.switcher} ${className ?? ""}`}>
      <ul>
        {locales.map((l) => {
          const isCurrent = l === current;
          return (
            <li key={l}>
              <a
                href={`/${l}`}
                hrefLang={l}
                lang={l}
                title={localeNames[l].name}
                aria-current={isCurrent ? "page" : undefined}
                className={isCurrent ? styles.current : undefined}
              >
                <span aria-hidden="true">{localeNames[l].short}</span>
                <span className="sr-only">{localeNames[l].name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
