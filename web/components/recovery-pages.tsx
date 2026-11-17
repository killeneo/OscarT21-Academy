import { Suspense } from "react";
import { getMessages, type Locale } from "@/lib/i18n";
import { AuthShell } from "./auth-shell";
import { ForgotForm, ResetForm, VerifyConfirm } from "./recovery-forms";
import styles from "./auth.module.css";

type Query = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function shell(lang: Locale, title: string, subtitle: string, children: React.ReactNode) {
  const m = getMessages(lang);
  return (
    <AuthShell lang={lang} brand={m.common.brand} skipLabel={m.common.skipToContent} m={m.auth} title={title} subtitle={subtitle}>
      {children}
    </AuthShell>
  );
}

export function ForgotPasswordPage({ lang }: { lang: Locale }) {
  const m = getMessages(lang);
  return shell(lang, m.recovery.forgotTitle, m.recovery.forgotSubtitle, <ForgotForm lang={lang} m={m.auth} r={m.recovery} />);
}

async function TokenBody({ lang, searchParams, kind }: { lang: Locale; searchParams: Query; kind: "reset" | "verify" }) {
  const m = getMessages(lang);
  const token = first((await searchParams).token) ?? "";
  if (!token || token.length > 200) {
    return (
      <>
        <p className={styles.alert} role="alert">
          {m.recovery.invalidText}
        </p>
        <p className={styles.switch}>
          <a href={`/${lang}/${kind === "reset" ? "forgot-password" : "login"}`}>{m.recovery.backToLogin}</a>
        </p>
      </>
    );
  }
  return kind === "reset" ? (
    <ResetForm lang={lang} m={m.auth} r={m.recovery} token={token} />
  ) : (
    <VerifyConfirm lang={lang} m={m.auth} r={m.recovery} token={token} />
  );
}

export function TokenPage({ lang, searchParams, kind }: { lang: Locale; searchParams: Query; kind: "reset" | "verify" }) {
  const m = getMessages(lang);
  const title = kind === "reset" ? m.recovery.resetTitle : m.recovery.verifyTitle;
  const subtitle = kind === "reset" ? m.recovery.resetSubtitle : m.recovery.verifyText;
  return shell(
    lang,
    title,
    subtitle,
    <Suspense fallback={null}>
      <TokenBody lang={lang} searchParams={searchParams} kind={kind} />
    </Suspense>,
  );
}
