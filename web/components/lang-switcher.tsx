"use client";

import { useEffect, useId, useRef, useState } from "react";
import { locales, localeNames, type Locale } from "@/lib/i18n";
import { GlobeIcon } from "./icons";
import styles from "./lang-switcher.module.css";

type Props = {
  current: Locale;
  label: string;
  /** Where the list opens relative to the button (the footer opens it upwards). */
  placement?: "down" | "up";
  className?: string;
};

/**
 * Language dropdown (disclosure pattern). Every option is a real link to the same page in another language,
 * so the list stays in the HTML for crawlers; it closes on Escape, outside click and when focus leaves it.
 */
export function LangSwitcher({ current, label, placement = "down", className }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav
      ref={root}
      aria-label={label}
      className={`${styles.switcher} ${className ?? ""}`}
      data-placement={placement}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${localeNames[current].name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <GlobeIcon className={styles.globe} />
        <span aria-hidden="true">{localeNames[current].short}</span>
        <svg className={styles.chevron} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ul id={listId} className={styles.menu} hidden={!open}>
        {locales.map((l) => {
          const isCurrent = l === current;
          return (
            <li key={l}>
              <a
                href={`/${l}`}
                hrefLang={localeNames[l].html}
                lang={localeNames[l].html}
                aria-current={isCurrent ? "true" : undefined}
                className={isCurrent ? styles.current : undefined}
                onClick={() => setOpen(false)}
              >
                <span>{localeNames[l].name}</span>
                {isCurrent ? (
                  <svg className={styles.check} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path d="m4.5 10.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
