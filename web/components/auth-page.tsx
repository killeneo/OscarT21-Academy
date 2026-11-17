import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isSelfRole, providerAvailability } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { getMessages, type Locale } from "@/lib/i18n";
import { AuthForm } from "./auth-form";
import { AuthShell } from "./auth-shell";

type Props = {
  mode: "login" | "register";
  lang: Locale;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Request-time content (query string, session) lives behind Suspense so the shell can stay static. */
async function Body({ mode, lang, searchParams }: Props) {
  const query = await searchParams;
  const next = first(query.next);
  const error = first(query.error);
  const roleParam = first(query.role);
  const m = getMessages(lang).auth;

  let signedIn = false;
  try {
    signedIn = (await getSessionUser()) !== null;
  } catch {
    // Database unavailable: show the form; submitting will report a server error.
  }
  if (signedIn) redirect(safeNextPath(next, lang));

  const { telegramBot } = providerAvailability();
  return (
    <AuthForm
      mode={mode}
      lang={lang}
      m={m}
      consent={getMessages(lang).consent}
      telegramBot={telegramBot}
      next={next ? safeNextPath(next, lang) : undefined}
      initialError={error && error in m.errors ? error : undefined}
      initialRole={isSelfRole(roleParam) ? roleParam : undefined}
    />
  );
}

export function AuthPage(props: Props) {
  const messages = getMessages(props.lang);
  const m = messages.auth;
  const isRegister = props.mode === "register";
  return (
    <AuthShell
      lang={props.lang}
      brand={messages.common.brand}
      skipLabel={messages.common.skipToContent}
      m={m}
      title={isRegister ? m.registerTitle : m.loginTitle}
      subtitle={isRegister ? m.registerSubtitle : m.loginSubtitle}
    >
      <Suspense fallback={null}>
        <Body {...props} />
      </Suspense>
    </AuthShell>
  );
}
