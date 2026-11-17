import type { Locale, Messages } from "@/lib/i18n";
import { LogoMark } from "./icons";
import { LogoutButton } from "./logout-button";
import styles from "./search.module.css";

type Props = {
  lang: Locale;
  brand: string;
  displayName: string;
  m: Messages;
  current: "search" | "account";
};

/** Header for the signed-in area: brand, section links, user name and log out. */
export function AppHeader({ lang, brand, displayName, m, current }: Props) {
  return (
    <header className={styles.appHeader}>
      <div className={styles.appBar}>
        <a href={`/${lang}`} className={styles.logo}>
          <LogoMark style={{ width: 32, height: 32 }} />
          {brand}
        </a>
        <nav aria-label={m.search.navLabel} className={styles.appNav}>
          <a href={`/${lang}/specialists`} aria-current={current === "search" ? "page" : undefined}>
            {m.search.navSearch}
          </a>
          <a href={`/${lang}/account`} aria-current={current === "account" ? "page" : undefined}>
            {m.search.navAccount}
          </a>
        </nav>
        <div className={styles.appUser}>
          {displayName ? <span className={styles.userName}>{displayName}</span> : null}
          <LogoutButton
            lang={lang}
            label={m.auth.account.logout}
            busyLabel={m.auth.account.loggingOut}
            className={styles.logoutBtn}
          />
        </div>
      </div>
    </header>
  );
}
