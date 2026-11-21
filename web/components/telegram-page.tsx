import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isSelfRole, providerAvailability } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, type Locale } from "@/lib/i18n";
import { AuthShell } from "./auth-shell";
import styles from "./auth.module.css";
import { TelegramPanel } from "./telegram-panel";

type Query = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Query }) {
  const query = await searchParams;
  const mode = first(query.mode) === "register" ? "register" : "login";
  const role = first(query.role);
  const next = first(query.next);
  const messages = getMessages(lang);

  let signedIn = false;
  try {
    signedIn = (await getSessionUser()) !== null;
  } catch {
    // Database unavailable: show the page; signing in will report a server error.
  }
  if (signedIn) redirect(safeNextPath(next, lang));

  const { telegramBot } = providerAvailability();
  if (!telegramBot) {
    return (
      <p className={styles.alert} role="alert">
        {messages.auth.telegramNotConfigured}
      </p>
    );
  }
  return (
    <TelegramPanel
      mode={mode}
      lang={lang}
      role={isSelfRole(role) ? role : "parent"}
      next={next ? safeNextPath(next, lang) : undefined}
      botUsername={telegramBot}
      m={messages.auth}
      consent={messages.consent}
    />
  );
}

export function TelegramPage({ lang, searchParams }: { lang: Locale; searchParams: Query }) {
  const messages = getMessages(lang);
  return (
    <AuthShell
      lang={lang}
      brand={messages.common.brand}
      skipLabel={messages.common.skipToContent}
      m={messages.auth}
      title={messages.auth.telegramTitle}
      subtitle={messages.auth.telegramText}
    >
      <Suspense fallback={null}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
