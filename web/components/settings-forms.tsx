"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import type { Messages } from "@/lib/i18n";
import { ErrorBox, postJson } from "./recovery-forms";
import styles from "./auth.module.css";

type Common = { m: Messages["auth"]; s: Messages["settings"] };

/** Name shown in the header and the account (any role). */
export function AccountForm({ m, s, displayName }: Common & { displayName: string }) {
  const router = useRouter();
  const uid = useId();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("displayName") ?? "");
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await postJson("/api/profile/account", { displayName: name });
    setPending(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else setError(res.code);
  }

  return (
    <>
      <ErrorBox m={m} code={error} />
      <div aria-live="polite">
        {saved ? (
          <p className={styles.notice} role="status">
            {s.saved}
          </p>
        ) : null}
      </div>
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label htmlFor={`${uid}-name`}>
            {m.name} <span className={styles.optional}>({m.nameOptional})</span>
          </label>
          <input id={`${uid}-name`} name="displayName" className={styles.input} autoComplete="name" maxLength={80} defaultValue={displayName} />
        </div>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? m.submitting : s.save}
        </button>
      </form>
    </>
  );
}

/** Password change: the current password is always required; other devices are signed out afterwards. */
export function PasswordForm({ m, s, email }: Common & { email: string | null }) {
  const uid = useId();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setPending(true);
    setError(null);
    setDone(false);
    const res = await postJson("/api/auth/password/change", {
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
    });
    setPending(false);
    if (res.ok) {
      setDone(true);
      formEl.reset();
    } else setError(res.code === "invalid_credentials" ? "wrong_current_password" : res.code);
  }

  return (
    <>
      <ErrorBox m={m} code={error} />
      <div aria-live="polite">
        {done ? (
          <p className={styles.notice} role="status">
            {s.passwordChanged}
          </p>
        ) : null}
      </div>
      <form className={styles.form} onSubmit={onSubmit}>
        {/* Lets password managers update the entry of the right account. */}
        {email ? <input type="email" name="username" value={email} autoComplete="username" readOnly hidden /> : null}
        <div className={styles.field}>
          <label htmlFor={`${uid}-cur`}>{s.currentPassword}</label>
          <input id={`${uid}-cur`} name="currentPassword" type={show ? "text" : "password"} className={styles.input} autoComplete="current-password" maxLength={128} required />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${uid}-new`}>{s.newPassword}</label>
          <div className={styles.passwordWrap}>
            <input
              id={`${uid}-new`}
              name="newPassword"
              type={show ? "text" : "password"}
              className={styles.input}
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              aria-describedby={`${uid}-hint`}
              required
            />
            <button type="button" className={styles.toggle} onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? m.hidePassword : m.showPassword}
            </button>
          </div>
          <p id={`${uid}-hint`} className={styles.hint}>
            {m.passwordHint}
          </p>
        </div>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? m.submitting : s.changePassword}
        </button>
      </form>
    </>
  );
}
