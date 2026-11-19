import { Suspense } from "react";
import { isSelfRole } from "@/lib/auth/config";
import { peekSignup } from "@/lib/auth/signup";
import { getMessages, type Locale } from "@/lib/i18n";
import { AuthShell } from "./auth-shell";
import { SignupCompleteForm } from "./signup-complete-form";
import styles from "./auth.module.css";

type Query = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Request-time part: the link is checked on the server before any form is shown. */
async function Body({ lang, searchParams }: { lang: Locale; searchParams: Query }) {
  const query = await searchParams;
  const token = first(query.token) ?? "";
  const role = first(query.role);
  const m = getMessages(lang);
  const found = token && token.length <= 200 ? await peekSignup(token).catch(() => null) : null;
  if (!found) {
    return (
      <>
        <p className={styles.alert} role="alert">
          {m.recovery.invalidText}
        </p>
        <p className={styles.switch}>
          <a href={`/${lang}/register`}>{m.signup.restart}</a>
        </p>
      </>
    );
  }
  return (
    <SignupCompleteForm
      lang={lang}
      m={m.auth}
      s={m.signup}
      consent={m.consent}
      token={token}
      email={found.email}
      initialRole={isSelfRole(role) ? role : "parent"}
    />
  );
}

export function SignupCompletePage({ lang, searchParams }: { lang: Locale; searchParams: Query }) {
  const m = getMessages(lang);
  return (
    <AuthShell
      lang={lang}
      brand={m.common.brand}
      skipLabel={m.common.skipToContent}
      m={m.auth}
      title={m.signup.title}
      subtitle={m.signup.subtitle}
    >
      <Suspense fallback={null}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
