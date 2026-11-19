"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import type { Messages } from "@/lib/i18n";
import styles from "./auth.module.css";
import { TelegramLogin } from "./telegram-login";

export type Role = "parent" | "specialist" | "organization";
const ROLES: Role[] = ["parent", "specialist", "organization"];

type Props = {
  mode: "login" | "register";
  lang: string;
  m: Messages["auth"];
  consent: Messages["consent"];
  telegramBot: string | null;
  /** Destination after sign-in; validated again on the server. */
  next?: string;
  /** Error code coming from a redirect (e.g. Google callback). */
  initialError?: string;
  /** Role preselected from the link that opened the sign-up page. */
  initialRole?: Role;
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.900 4.800 12 4.800Z" />
    </svg>
  );
}

function TelegramLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path fill="#fff" d="M5.4 11.8 17.600 7c.6-.2 1 .1.9.9l-2.100 9.800c-.1.700-.6.900-1.200.5l-3.200-2.400-1.500 1.500c-.2.200-.3.300-.7.300l.2-3.300 6-5.400c.3-.2-.1-.4-.4-.2l-7.400 4.700-3.200-1c-.7-.2-.7-.7.200-1Z" />
    </svg>
  );
}

export function AuthForm({ mode, lang, m, consent, telegramBot, next, initialError, initialRole }: Props) {
  const router = useRouter();
  const uid = useId();
  const [role, setRole] = useState<Role>(initialRole ?? "parent");
  const [showPassword, setShowPassword] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const isRegister = mode === "register";
  const errorText = error ? (m.errors[error as keyof typeof m.errors] ?? m.errors.server_error) : null;

  async function post(url: string, payload: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: { code?: string } } | null;
      if (res.ok && data?.ok) {
        // Registration answers identically for taken addresses (no account enumeration), so check for a session.
        if (isRegister && !(await fetch("/api/auth/me", { cache: "no-store" })).ok) {
          setError("check_email");
          return;
        }
        // New accounts continue to the role-specific profile step; returning users go where they were headed.
        router.replace(
          isRegister
            ? `/${lang}/onboarding`
            : next && next.startsWith("/") && !next.startsWith("//")
              ? next
              : `/${lang}`,
        );
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (isRegister) {
      payload.displayName = String(form.get("displayName") ?? "");
      payload.role = role;
      payload.consent = consentChecked;
      payload.lang = lang;
    }
    void post(isRegister ? "/api/auth/register" : "/api/auth/login", payload);
  }

  const googleParams = new URLSearchParams({ lang });
  if (isRegister) {
    googleParams.set("role", role);
    googleParams.set("next", `/${lang}/onboarding`);
    if (consentChecked) googleParams.set("consent", "1");
  } else if (next) {
    googleParams.set("next", next);
  }

  const other = isRegister
    ? { text: m.haveAccount, link: m.signIn, href: `/${lang}/login` }
    : { text: m.noAccount, link: m.createAccount, href: `/${lang}/register` };

  return (
    <>
      <div aria-live="polite" id={`${uid}-error`}>
        {errorText ? (
          <p role="alert" className={styles.alert}>
            {errorText}
          </p>
        ) : null}
      </div>

      <form className={styles.form} onSubmit={onSubmit} aria-describedby={`${uid}-error`}>
        {isRegister ? (
          <fieldset className={styles.roles}>
            <legend className={styles.legend}>{m.roleLegend}</legend>
            {ROLES.map((r) => (
              <label key={r} className={styles.roleOption}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <span>{m.roles[r]}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {isRegister ? (
          <div className={styles.field}>
            <label htmlFor={`${uid}-name`}>
              {m.name} <span className={styles.optional}>({m.nameOptional})</span>
            </label>
            <input id={`${uid}-name`} name="displayName" className={styles.input} autoComplete="name" maxLength={80} />
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor={`${uid}-email`}>{m.email}</label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            className={styles.input}
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${uid}-password`}>{m.password}</label>
          <div className={styles.passwordWrap}>
            <input
              id={`${uid}-password`}
              name="password"
              type={showPassword ? "text" : "password"}
              className={styles.input}
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 10 : undefined}
              maxLength={128}
              aria-describedby={isRegister ? `${uid}-hint` : undefined}
              required
            />
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? m.hidePassword : m.showPassword}
            </button>
          </div>
          {isRegister ? (
            <p id={`${uid}-hint`} className={styles.hint}>
              {m.passwordHint}
            </p>
          ) : null}
        </div>

        {isRegister ? (
          <div className={styles.consent}>
            <input
              id={`${uid}-consent`}
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              required
            />
            <label htmlFor={`${uid}-consent`}>
              {consent.before}
              <a href={`/${lang}/privacy`} target="_blank" rel="noopener">
                {consent.link}
              </a>
              {consent.after}
            </label>
          </div>
        ) : (
          <a href={`/${lang}/forgot-password`} className={styles.forgot}>
            {m.forgotLink}
          </a>
        )}

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? m.submitting : isRegister ? m.submitRegister : m.submitLogin}
        </button>
      </form>

      <p className={styles.divider} aria-hidden="true">
        {m.or}
      </p>

      <div className={styles.socials}>
        {/* Plain link: the OAuth flow is a full-page redirect handled by the server. */}
        <a
          className={styles.social}
          href={`/api/auth/google?${googleParams.toString()}`}
          onClick={(event) => {
            if (isRegister && !consentChecked) {
              event.preventDefault();
              setError("consent_required");
            }
          }}
        >
          <GoogleLogo />
          {m.google}
        </a>

        {telegramBot ? (
          <div className={styles.telegramBox}>
            <TelegramLogin
              botUsername={telegramBot}
              lang={lang}
              onAuth={(user) => {
                if (isRegister && !consentChecked) return setError("consent_required");
                void post("/api/auth/telegram", { auth: user, role: isRegister ? role : "parent", consent: isRegister && consentChecked });
              }}
            />
          </div>
        ) : (
          <button type="button" className={`${styles.social} ${styles.disabledSocial}`} aria-disabled="true" onClick={() => setError("not_configured")}>
            <TelegramLogo />
            {m.telegram}
          </button>
        )}
      </div>

      <p className={styles.switch}>
        {other.text} <a href={other.href}>{other.link}</a>
      </p>
    </>
  );
}
