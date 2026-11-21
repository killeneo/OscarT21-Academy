"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import type { Messages } from "@/lib/i18n";
import type { Role } from "./auth-form";
import { ErrorBox, postJson, useStripTokenFromUrl } from "./recovery-forms";
import styles from "./auth.module.css";

const ROLES: Role[] = ["parent", "specialist", "organization"];

type Props = {
  lang: string;
  m: Messages["auth"];
  s: Messages["signup"];
  consent: Messages["consent"];
  token: string;
  email: string;
  initialRole: Role;
};

/**
 * Sign-up, step 2 (opened from the mailed link): the address owner chooses the role, name and password and gives
 * their own consent. The role from the link is only a preselection.
 */
export function SignupCompleteForm({ lang, m, s, consent, token, email, initialRole }: Props) {
  const router = useRouter();
  const uid = useId();
  const [role, setRole] = useState<Role>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useStripTokenFromUrl();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consentChecked) {
      setError("consent_required");
      return;
    }
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const res = await postJson("/api/auth/register/complete", {
      token,
      password: String(form.get("password") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      role,
      consent: true,
    });
    if (res.ok) {
      router.replace(`/${lang}/onboarding`);
      router.refresh();
      return;
    }
    setPending(false);
    setError(res.code);
  }

  return (
    <>
      <ErrorBox m={m} code={error} />
      <p className={styles.notice}>{s.forEmail.replace("{email}", email)}</p>
      <p className={styles.hint}>{s.notYou}</p>

      <form className={styles.form} onSubmit={onSubmit}>
        <fieldset className={styles.roles}>
          <legend className={styles.legend}>{m.roleLegend}</legend>
          {ROLES.map((r) => (
            <label key={r} className={styles.roleOption}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
              <span>{m.roles[r]}</span>
            </label>
          ))}
        </fieldset>

        <div className={styles.field}>
          <label htmlFor={`${uid}-name`}>
            {m.name} <span className={styles.optional}>({m.nameOptional})</span>
          </label>
          <input id={`${uid}-name`} name="displayName" className={styles.input} autoComplete="name" maxLength={80} />
        </div>

        {/* Lets password managers save the new password under the right account. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />

        <div className={styles.field}>
          <label htmlFor={`${uid}-password`}>{m.password}</label>
          <div className={styles.passwordWrap}>
            <input
              id={`${uid}-password`}
              name="password"
              type={showPassword ? "text" : "password"}
              className={styles.input}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              aria-describedby={`${uid}-hint`}
              required
            />
            <button type="button" className={styles.toggle} onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
              {showPassword ? m.hidePassword : m.showPassword}
            </button>
          </div>
          <p id={`${uid}-hint`} className={styles.hint}>
            {m.passwordHint}
          </p>
        </div>

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

        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? m.submitting : s.submit}
        </button>
      </form>

      <p className={styles.switch}>
        {m.haveAccount} <a href={`/${lang}/login`}>{m.signIn}</a>
      </p>
    </>
  );
}
