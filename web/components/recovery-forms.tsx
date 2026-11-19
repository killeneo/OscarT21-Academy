"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { Messages } from "@/lib/i18n";
import styles from "./auth.module.css";

type Props = { lang: string; m: Messages["auth"]; r: Messages["recovery"] };

async function postJson(url: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: { code?: string } } | null;
    return res.ok && data?.ok ? { ok: true as const } : { ok: false as const, code: data?.error?.code ?? "server_error" };
  } catch {
    return { ok: false as const, code: "network" };
  }
}

/**
 * The single-use token arrives in the e-mailed link (?token=…). Once the page has it, drop it from the address bar
 * so it does not stay in browser history, synced history or screenshots. The form keeps it in memory.
 */
function useStripTokenFromUrl() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
}

function ErrorBox({ m, code }: { m: Messages["auth"]; code: string | null }) {
  const text = code ? (m.errors[code as keyof typeof m.errors] ?? m.errors.server_error) : null;
  return (
    <div aria-live="polite">
      {text ? (
        <p role="alert" className={styles.alert}>
          {text}
        </p>
      ) : null}
    </div>
  );
}

/** Step 1 of password recovery: always shows the same neutral confirmation. */
export function ForgotForm({ lang, m, r }: Props) {
  const uid = useId();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setError(null);
    const res = await postJson("/api/auth/password/forgot", { email, lang });
    setPending(false);
    if (res.ok) setSent(true);
    else setError(res.code);
  }

  if (sent) {
    return (
      <>
        <p className={styles.notice} role="status">
          {r.forgotSent}
        </p>
        <p className={styles.switch}>
          <a href={`/${lang}/login`}>{r.backToLogin}</a>
        </p>
      </>
    );
  }

  return (
    <>
      <ErrorBox m={m} code={error} />
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label htmlFor={`${uid}-email`}>{m.email}</label>
          <input id={`${uid}-email`} name="email" type="email" className={styles.input} autoComplete="email" maxLength={254} required />
        </div>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? m.submitting : r.forgotSubmit}
        </button>
      </form>
      <p className={styles.switch}>
        <a href={`/${lang}/login`}>{r.backToLogin}</a>
      </p>
    </>
  );
}

/** Step 2: set the new password using the token from the e-mailed link. */
export function ResetForm({ lang, m, r, token }: Props & { token: string }) {
  const uid = useId();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useStripTokenFromUrl();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setError(null);
    const res = await postJson("/api/auth/password/reset", { token, password });
    setPending(false);
    if (res.ok) setDone(true);
    else setError(res.code);
  }

  if (done) {
    return (
      <>
        <p className={styles.notice} role="status">
          {r.resetDone}
        </p>
        <p className={styles.actionsRow} style={{ marginTop: 20 }}>
          <a href={`/${lang}/login`} className={styles.submit}>
            {r.goLogin}
          </a>
        </p>
      </>
    );
  }

  return (
    <>
      <ErrorBox m={m} code={error} />
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label htmlFor={`${uid}-pw`}>{r.newPassword}</label>
          <div className={styles.passwordWrap}>
            <input
              id={`${uid}-pw`}
              name="password"
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
          {pending ? m.submitting : r.resetSubmit}
        </button>
      </form>
    </>
  );
}

/** E-mail confirmation needs a click on a button (POST), so mail scanners cannot use the link up. */
export function VerifyConfirm({ lang, m, r, token }: Props & { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useStripTokenFromUrl();

  async function confirm() {
    setPending(true);
    setError(null);
    const res = await postJson("/api/auth/verify/confirm", { token });
    setPending(false);
    if (res.ok) setDone(true);
    else setError(res.code);
  }

  if (done) {
    return (
      <>
        <p className={styles.notice} role="status">
          {r.verifyDone}
        </p>
        <p className={styles.actionsRow} style={{ marginTop: 20 }}>
          <a href={`/${lang}/specialists`} className={styles.submit}>
            {r.continue}
          </a>
        </p>
      </>
    );
  }

  return (
    <>
      <ErrorBox m={m} code={error} />
      <button type="button" className={styles.submit} onClick={() => void confirm()} disabled={pending}>
        {pending ? m.submitting : r.verifySubmit}
      </button>
    </>
  );
}
