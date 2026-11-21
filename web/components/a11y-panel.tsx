"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { HandsFreeControls, HandsFreeRuntime } from "./hands-free";
import styles from "./a11y-panel.module.css";

type Settings = { text: "normal" | "large" | "xlarge"; contrast: "normal" | "high" | "dark"; motion: boolean; links: boolean };
const DEFAULTS: Settings = { text: "normal", contrast: "normal", motion: false, links: false };
const KEY = "a11y";
const HINT_KEY = "a11yHintSeen";
const HINT_MS = 5000;

function markHintSeen() {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Without storage the callout simply shows again next visit.
  }
}

/** Mirrors the pre-paint script in the root layout: settings live as data-* attributes on <html>. */
function apply(s: Settings) {
  const d = document.documentElement;
  const set = (name: string, value: string | null) => (value ? d.setAttribute(name, value) : d.removeAttribute(name));
  set("data-text", s.text === "normal" ? null : s.text);
  set("data-contrast", s.contrast === "normal" ? null : s.contrast);
  set("data-motion", s.motion ? "reduce" : null);
  set("data-links", s.links ? "underline" : null);
}

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>;
    return {
      text: raw.text === "large" || raw.text === "xlarge" ? raw.text : "normal",
      contrast: raw.contrast === "high" || raw.contrast === "dark" ? raw.contrast : "normal",
      motion: raw.motion === true,
      links: raw.links === true,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Display settings for low-vision users: text size, high-contrast themes, no animation, underlined links.
 * It complements (does not replace) the browser's own zoom and the operating system's accessibility settings.
 */
export function A11yPanel({ m, speechLang }: { m: Messages["a11y"]; speechLang: string }) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [hintHeld, setHintHeld] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const pathname = usePathname();

  // ---- read aloud (Web Speech API). User-initiated only: never starts by itself. ----
  const [voiceOk, setVoiceOk] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [stopped, setStopped] = useState(false);
  const [rate, setRate] = useState(1);
  const run = useRef(0);

  const pickVoice = () => {
    const base = speechLang.toLowerCase().split("-")[0];
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang.toLowerCase() === speechLang.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base)) ?? null;
  };

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVoiceOk(false);
      return;
    }
    const check = () => setVoiceOk(pickVoice() !== null);
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechLang]);

  // Leaving a page stops the reading (the panel lives in the layout and survives navigation).
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- run is a plain counter, not a DOM ref
      run.current++;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("idle");
  }, [pathname]);

  function pageLines(): string[] {
    const main = document.querySelector("main");
    if (!main) return [];
    // innerText already skips hidden elements; decorative bits without any letter (numbers, stars) are dropped.
    return main.innerText.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 1 && /\p{L}/u.test(s));
  }

  function play() {
    const lines = pageLines();
    const voice = pickVoice();
    if (!lines.length || !voice) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const token = ++run.current;
    let i = 0;
    setStopped(false);
    setStatus("playing");
    const next = () => {
      if (token !== run.current) return;
      if (i >= lines.length) {
        setStatus("idle");
        return;
      }
      const u = new SpeechSynthesisUtterance(lines[i++]);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      u.onend = next;
      u.onerror = next;
      synth.speak(u);
    };
    next();
  }

  function stop() {
    run.current++;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setStopped(true);
  }

  useEffect(() => {
    // Read the saved settings once after hydration (the pre-paint script has already applied them to <html>).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setS(load());
  }, []);

  // First visit only: a short callout that points at the settings button.
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      return;
    }
    const id = window.setTimeout(() => setHint(true), 700);
    return () => window.clearTimeout(id);
  }, []);

  // It hides itself after 5 seconds, but never while the visitor is pointing at it or has keyboard focus inside it.
  useEffect(() => {
    if (!hint || hintHeld) return;
    const id = window.setTimeout(() => {
      setHint(false);
      markHintSeen();
    }, HINT_MS);
    return () => window.clearTimeout(id);
  }, [hint, hintHeld]);

  function dismissHint() {
    setHint(false);
    markHintSeen();
  }

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
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function update(next: Settings) {
    setS(next);
    apply(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage may be blocked: the settings still apply for this visit.
    }
  }

  const sizes = [
    ["normal", m.sizes.normal],
    ["large", m.sizes.large],
    ["xlarge", m.sizes.xlarge],
  ] as const;
  const modes = [
    ["normal", m.contrastModes.normal],
    ["high", m.contrastModes.high],
    ["dark", m.contrastModes.dark],
  ] as const;

  return (
    <div ref={root} className={styles.root}>
      <HandsFreeRuntime m={m.hands} lang={speechLang} />
      {hint && !open ? (
        <div
          role="status"
          className={styles.hint}
          onMouseEnter={() => setHintHeld(true)}
          onMouseLeave={() => setHintHeld(false)}
          onFocus={() => setHintHeld(true)}
          onBlur={() => setHintHeld(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") dismissHint();
          }}
        >
          <p>{m.hint.text}</p>
          <div className={styles.hintActions}>
            <button
              type="button"
              className={styles.hintPrimary}
              onClick={() => {
                dismissHint();
                setOpen(true);
              }}
            >
              {m.hint.open}
            </button>
            <button type="button" className={styles.hintSecondary} onClick={dismissHint}>
              {m.hint.dismiss}
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div role="dialog" aria-label={m.title} className={styles.panel} id={`${uid}-panel`}>
          <div className={styles.head}>
            <h2 className={styles.title}>{m.title}</h2>
            <button type="button" className={styles.close} onClick={() => { setOpen(false); button.current?.focus(); }}>
              {m.close}
            </button>
          </div>

          <fieldset className={styles.group}>
            <legend>{m.text}</legend>
            <div className={styles.options}>
              {sizes.map(([v, label], i) => (
                <label key={v} className={styles.option}>
                  <input type="radio" name={`${uid}-text`} checked={s.text === v} onChange={() => update({ ...s, text: v })} />
                  <span style={{ fontSize: `${0.9 + i * 0.15}rem` }}>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{m.contrast}</legend>
            <div className={styles.optionsCol}>
              {modes.map(([v, label]) => (
                <label key={v} className={styles.option}>
                  <input type="radio" name={`${uid}-contrast`} checked={s.contrast === v} onChange={() => update({ ...s, contrast: v })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{m.speech.title}</legend>
            {voiceOk === false ? (
              <p className={styles.speechNote}>{m.speech.unsupported}</p>
            ) : (
              <>
                <div className={styles.speechRow}>
                  {status === "idle" ? (
                    <button type="button" className={styles.speechBtn} onClick={play} disabled={voiceOk !== true}>
                      {m.speech.play}
                    </button>
                  ) : status === "playing" ? (
                    <button type="button" className={styles.speechBtn} onClick={() => { window.speechSynthesis.pause(); setStatus("paused"); }}>
                      {m.speech.pause}
                    </button>
                  ) : (
                    <button type="button" className={styles.speechBtn} onClick={() => { window.speechSynthesis.resume(); setStatus("playing"); }}>
                      {m.speech.resume}
                    </button>
                  )}
                  <button type="button" className={styles.speechBtn} onClick={stop} disabled={status === "idle"}>
                    {m.speech.stop}
                  </button>
                </div>
                <p className={styles.speechLabel}>{m.speech.speed}</p>
                <div className={styles.options}>
                  {([[0.8, m.speech.speeds.slow], [1, m.speech.speeds.normal], [1.3, m.speech.speeds.fast]] as const).map(([v, label]) => (
                    <label key={v} className={styles.option}>
                      <input type="radio" name={`${uid}-rate`} checked={rate === v} onChange={() => setRate(v)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <p className={styles.speechStatus} role="status" aria-live="polite">
                  {status === "playing" ? m.speech.reading : status === "paused" ? m.speech.paused : stopped ? m.speech.stopped : ""}
                </p>
              </>
            )}
          </fieldset>

          <HandsFreeControls m={m.hands} />

          <div className={styles.checks}>
            <label className={styles.check}>
              <input type="checkbox" checked={s.motion} onChange={(e) => update({ ...s, motion: e.target.checked })} />
              <span>{m.motion}</span>
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={s.links} onChange={(e) => update({ ...s, links: e.target.checked })} />
              <span>{m.links}</span>
            </label>
          </div>

          <button type="button" className={styles.reset} onClick={() => update(DEFAULTS)}>
            {m.reset}
          </button>
        </div>
      ) : null}

      <button
        ref={button}
        type="button"
        className={`${styles.trigger} ${hint && !open ? styles.triggerHint : ""}`}
        aria-expanded={open}
        aria-controls={open ? `${uid}-panel` : undefined}
        aria-label={m.button}
        title={m.button}
        onClick={() => {
          if (hint) dismissHint();
          setOpen((v) => !v);
        }}
      >
        {/* Universal access symbol */}
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="26" height="26">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="7.2" r="1.7" fill="currentColor" />
          <path d="M6.5 9.6c3.6 1 7.4 1 11 0M12 10v4m0 0-2.6 5M12 14l2.6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
