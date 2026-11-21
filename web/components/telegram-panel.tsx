"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Messages } from "@/lib/i18n";
import type { Role } from "./auth-form";
import styles from "./auth.module.css";
import { TelegramLogin } from "./telegram-login";

type Props = {
  mode: "login" | "register";
  lang: string;
  role: Role;
  next?: string;
  botUsername: string;
  m: Messages["auth"];
  consent: Messages["consent"];
};

/**
 * Telegram sign-in on its own page. The widget is a third-party script with full access to the page, so it is
 * kept away from the login and sign-up forms (no password field here), and the CSP allows telegram.org only on
 * this route. Consent for a new account is given here.
 */
export function TelegramPanel({ mode, lang, role, next, botUsername, m, consent }: Props) {
  const router = useRouter();
  const uid = useId();
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.server_error) : null;

  async function onAuth(user: Record<string, unknown>) {
    if (isRegister && !consentChecked) return setError("consent_required");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth: user, role: isRegister ? role : "parent", consent: isRegister && consentChecked }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: { code?: string } } | null;
      if (res.ok && data?.ok) {
        router.replace(isRegister ? `/${lang}/onboarding` : (next ?? `/${lang}`));
        router.refresh();
        return;
      }
      setError(data?.error?.code ?? "server_error");
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  }

  const other = isRegister
    ? { text: m.haveAccount, link: m.signIn, href: `/${lang}/login` }
    : { text: m.noAccount, link: m.createAccount, href: `/${lang}/register` };

  return (
    <>
      <div aria-live="polite">
        {errorText ? (
          <p role="alert" className={styles.alert}>
            {errorText}
          </p>
        ) : null}
      </div>

      {isRegister ? (
        <div className={styles.consent}>
          <input id={`${uid}-consent`} type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} />
          <label htmlFor={`${uid}-consent`}>
            {consent.before}
            <a href={`/${lang}/privacy`} target="_blank" rel="noopener">
              {consent.link}
            </a>
            {consent.after}
          </label>
        </div>
      ) : null}

      <div className={styles.telegramBox} aria-busy={pending}>
        <TelegramLogin botUsername={botUsername} lang={lang} onAuth={(user) => void onAuth(user)} />
      </div>

      <p className={styles.switch}>
        {other.text} <a href={other.href}>{other.link}</a>
      </p>
    </>
  );
}
