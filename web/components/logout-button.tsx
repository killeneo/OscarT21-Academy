"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./auth.module.css";

export function LogoutButton({
  lang,
  label,
  busyLabel,
  className,
}: {
  lang: string;
  label: string;
  busyLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      router.replace(`/${lang}`);
      router.refresh();
    }
  }

  return (
    <button type="button" className={className ?? styles.submit} onClick={() => void logout()} disabled={pending}>
      {pending ? busyLabel : label}
    </button>
  );
}
