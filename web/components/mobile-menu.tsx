"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./site-chrome.module.css";

type Link = { href: string; label: string };
type Props = {
  label: string;
  navLabel: string;
  links: Link[];
  login: Link;
  signup: Link;
};

/**
 * Menu for small screens (disclosure pattern): one clear button with a visible word, a full-width panel with large
 * links, and the two account actions at the bottom. Closes on Escape, outside click and after choosing a link.
 */
export function MobileMenu({ label, navLabel, links, login, signup }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    // Rotating a phone or widening the window past the breakpoint must not leave an invisible open state behind.
    const mq = window.matchMedia("(min-width: 901px)");
    const onWide = () => mq.matches && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <div ref={root} className={styles.menu}>
      <button
        ref={button}
        type="button"
        className={styles.menuBtn}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          )}
        </svg>
        <span>{label}</span>
      </button>
      <nav id={panelId} aria-label={navLabel} className={styles.menuPanel} hidden={!open}>
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className={styles.menuActions}>
          <a href={login.href} className={styles.menuLogin}>
            {login.label}
          </a>
          <a href={signup.href} className={styles.menuSignup}>
            {signup.label}
          </a>
        </div>
      </nav>
    </div>
  );
}
