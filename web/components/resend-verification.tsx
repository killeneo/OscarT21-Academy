"use client";

import { useState } from "react";
import styles from "./auth.module.css";

export function ResendVerification({ lang, label, doneLabel, errorLabel }: { lang: string; label: string; doneLabel: string; errorLabel: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");

  async function resend() {
    setState("pending");
    try {
      const res = await fetch("/api/auth/verify/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div aria-live="polite">
      {state === "done" ? (
        <p className={styles.notice} role="status">
          {doneLabel}
        </p>
      ) : (
        <>
          <button type="button" className={styles.secondaryBtn} style={{ width: "100%" }} onClick={() => void resend()} disabled={state === "pending"}>
            {label}
          </button>
          {state === "error" ? (
            <p className={styles.alert} role="alert" style={{ marginTop: 10 }}>
              {errorLabel}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
