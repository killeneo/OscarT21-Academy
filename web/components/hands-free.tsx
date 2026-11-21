"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import type { Messages } from "@/lib/i18n";
import { matchAction, norm, pickTarget, stripClickVerb } from "@/lib/voice-commands";
import styles from "./a11y-panel.module.css";

/**
 * Hands-free use: hover-to-click (head / eye trackers and mouth sticks act as a mouse), larger click areas
 * and voice control (click by name, scroll, go back, dictate into text fields).
 * Nothing here is on by default; every mode is switched on by the visitor and remembered on this device.
 */
type Delay = 1000 | 1500 | 2500;
type Hands = { dwell: boolean; delay: Delay; large: boolean; voice: boolean; ctrl: boolean };
const DEFAULTS: Hands = { dwell: false, delay: 1500, large: false, voice: false, ctrl: false };
const KEY = "a11yHands";

type Msgs = Messages["a11y"]["hands"];

// ---- tiny external store, shared by the always-mounted runtime and the controls inside the panel ----
let state: Hands = DEFAULTS;
let live = "";
let scan = "";
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

function applyAttr(h: Hands) {
  const d = document.documentElement;
  if (h.large) d.setAttribute("data-targets", "large");
  else d.removeAttribute("data-targets");
}

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Hands>;
    state = {
      dwell: raw.dwell === true,
      delay: raw.delay === 1000 || raw.delay === 2500 ? raw.delay : 1500,
      large: raw.large === true,
      voice: raw.voice === true,
      ctrl: raw.ctrl === true,
    };
  } catch {
    state = DEFAULTS;
  }
  applyAttr(state);
  emit();
}

function setHands(patch: Partial<Hands>) {
  state = { ...state, ...patch };
  applyAttr(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage may be blocked: the modes still work for this visit.
  }
  emit();
}

function setLive(text: string) {
  live = text;
  emit();
}

function setScan(text: string) {
  scan = text;
  emit();
}

const useScan = () =>
  useSyncExternalStore(
    subscribe,
    () => scan,
    () => "",
  );
const useHands = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => DEFAULTS,
  );
const useLive = () =>
  useSyncExternalStore(
    subscribe,
    () => live,
    () => "",
  );

// ---- helpers ----
const POINTABLE =
  'a[href],button,summary,[role="button"],[role="link"],[role="tab"],input:not([type="hidden"]),select,textarea,label';
const TEXT_INPUT =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="hidden"]),textarea,select';

/** Controls the single-key Ctrl mode can step through, in page order. */
const STEPPABLE =
  'a[href],button,summary,[role="button"],[role="tab"],input:not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])';

function isVisible(el: Element) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest("[aria-hidden='true'],[hidden],[inert]")) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function accessibleName(el: Element): string {
  const h = el as HTMLElement;
  const labelled = h.getAttribute("aria-label");
  if (labelled) return labelled;
  if (h instanceof HTMLInputElement || h instanceof HTMLTextAreaElement || h instanceof HTMLSelectElement) {
    const l = h.labels?.[0]?.innerText;
    return l || (h as HTMLInputElement).placeholder || h.getAttribute("name") || "";
  }
  return h.innerText || h.getAttribute("title") || "";
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function activate(el: HTMLElement) {
  el.scrollIntoView({ block: "center" });
  if (el.matches(TEXT_INPUT)) el.focus();
  else el.click();
}

// Minimal typing for the (still prefixed) Web Speech recognition API.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onresult: ((e: { resultIndex?: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

/** Always mounted (inside the settings widget): runs the hands-free modes even while the panel is closed. */
export function HandsFreeRuntime({ m, lang }: { m: Msgs; lang: string }) {
  const h = useHands();
  const liveText = useLive();
  const scanText = useScan();
  const ring = useRef<HTMLDivElement>(null);
  const msgs = useRef(m);

  useEffect(() => {
    msgs.current = m;
  }, [m]);

  useEffect(() => {
    loadOnce();
  }, []);

  // ---- hover to click ----
  useEffect(() => {
    if (!h.dwell) return;
    let target: Element | null = null;
    let raf = 0;
    const box = ring.current;

    const cancel = () => {
      cancelAnimationFrame(raf);
      if (box) box.hidden = true;
    };

    const begin = (el: Element) => {
      if (!box) return;
      const start = performance.now();
      const tick = (now: number) => {
        const r = el.getBoundingClientRect();
        box.hidden = false;
        box.style.left = `${r.left - 3}px`;
        box.style.top = `${r.top - 3}px`;
        box.style.width = `${r.width + 6}px`;
        box.style.height = `${r.height + 6}px`;
        const p = Math.min(1, (now - start) / h.delay);
        box.style.setProperty("--p", String(p));
        if (p >= 1) {
          box.hidden = true;
          if (el instanceof HTMLElement) activate(el);
          return; // target stays set: no repeat click until the pointer leaves
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as Element).closest(POINTABLE);
      if (el === target) return;
      cancel();
      target = el;
      if (el && isVisible(el)) begin(el);
    };
    const onLeave = () => {
      cancel();
      target = null;
    };

    document.addEventListener("pointerover", onOver);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancel();
      document.removeEventListener("pointerover", onOver);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [h.dwell, h.delay]);

  // ---- single-key control: tap Ctrl = next control, Right Ctrl = previous, hold Ctrl = press it ----
  useEffect(() => {
    if (!h.ctrl) return;
    const HOLD_MS = 900;
    let timer = 0;
    let used = false; // another key or the mouse was used while Ctrl was down: it is a shortcut, not our gesture
    let fired = false;
    let side = "";
    let hideTimer = 0;

    const items = () =>
      Array.from(document.querySelectorAll<HTMLElement>(STEPPABLE)).filter(
        (el) => isVisible(el) && !el.closest("[data-scan-skip]"),
      );
    const label = (el: HTMLElement) => accessibleName(el).replace(/\s+/g, " ").trim().slice(0, 60) || el.tagName.toLowerCase();
    const show = (text: string) => {
      window.clearTimeout(hideTimer);
      setScan(text);
      hideTimer = window.setTimeout(() => setScan(""), 4000);
    };

    const step = (dir: 1 | -1) => {
      const list = items();
      if (!list.length) return;
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = at === -1 ? (dir === 1 ? 0 : list.length - 1) : (at + dir + list.length) % list.length;
      const el = list[next];
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center" });
      show(`${label(el)} (${next + 1} ${msgs.current.ctrlOf} ${list.length})`);
    };
    const press = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || el === document.body || !el.matches(STEPPABLE) || el.matches(TEXT_INPUT)) return;
      show(`${msgs.current.ctrlPressed} ${label(el)}`);
      el.click();
    };

    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        if (e.repeat) return;
        used = false;
        fired = false;
        side = e.code;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (used) return;
          fired = true;
          press();
        }, HOLD_MS);
      } else {
        used = true;
        window.clearTimeout(timer);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== "Control") return;
      window.clearTimeout(timer);
      if (!used && !fired) step(side === "ControlRight" ? -1 : 1);
    };
    const cancel = () => {
      used = true;
      window.clearTimeout(timer);
    };

    document.documentElement.setAttribute("data-scan", "on");
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("pointerdown", cancel, true);
    window.addEventListener("blur", cancel);
    return () => {
      document.documentElement.removeAttribute("data-scan");
      window.clearTimeout(timer);
      window.clearTimeout(hideTimer);
      setScan("");
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("pointerdown", cancel, true);
      window.removeEventListener("blur", cancel);
    };
  }, [h.ctrl]);

  // ---- voice control ----
  useEffect(() => {
    if (!h.voice) return;
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setLive(msgs.current.unsupported);
      setHands({ voice: false });
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    let on = true;

    const handle = (raw: string) => {
      const t = norm(raw);
      if (!t) return;
      const c = msgs.current.commands;
      const action = matchAction(raw, c);

      if (action === "stop") {
        setHands({ voice: false });
        return;
      }
      if (action === "down") return void window.scrollBy({ top: window.innerHeight * 0.8, behavior: "auto" });
      if (action === "up") return void window.scrollBy({ top: -window.innerHeight * 0.8, behavior: "auto" });
      if (action === "top") return void window.scrollTo({ top: 0, behavior: "auto" });
      if (action === "back") return void history.back();
      if (action === "forward") return void history.forward();
      if (action === "bottom") return void window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });

      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches(TEXT_INPUT) && !(active instanceof HTMLSelectElement)) {
        if (action === "done") return void active.blur();
        const field = active as HTMLInputElement | HTMLTextAreaElement;
        // Passwords are never dictated: the audio goes to the speech service of the browser.
        if (field instanceof HTMLInputElement && field.type === "password") return setLive(msgs.current.passwordNote);
        setNativeValue(field, (field.value ? `${field.value} ` : "") + raw.trim());
        return setLive(`${msgs.current.heard} ${raw.trim()}`);
      }

      // "click <name>": drop a leading verb, then match the visible control by its name.
      const q = stripClickVerb(raw, c.click);
      const named = Array.from(document.querySelectorAll(POINTABLE))
        .filter(isVisible)
        .map((el) => ({ item: el as HTMLElement, name: norm(accessibleName(el)) }))
        .filter((x) => x.name);
      const hit = pickTarget(named, q);
      if (hit) {
        setLive(`${msgs.current.heard} ${raw.trim()}`);
        activate(hit);
      } else {
        setLive(`${msgs.current.notFound} ${raw.trim()}`);
      }
    };

    // A single event can carry several finished phrases: handle every new one, in order, not just the last.
    rec.onresult = (e) => {
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r?.isFinal) handle(r[0].transcript);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        on = false;
        setLive(msgs.current.denied);
        setHands({ voice: false });
      } else if (e.error === "language-not-supported") {
        on = false;
        setLive(msgs.current.unsupported);
        setHands({ voice: false });
      }
    };
    const tryStart = () => {
      try {
        rec.start();
      } catch {
        // already started
      }
    };
    // The browser ends a session now and then (silence, network): keep listening while the mode is on.
    rec.onend = () => {
      if (on) window.setTimeout(() => on && tryStart(), 300);
    };

    setLive(msgs.current.listening);
    tryStart();
    return () => {
      on = false;
      rec.onend = null;
      rec.abort();
      setLive("");
    };
  }, [h.voice, lang]);

  return (
    <>
      <div ref={ring} hidden className={styles.dwellRing} aria-hidden="true" />
      <p className="sr-only" role="status" aria-live="polite">
        {liveText}
      </p>
      {h.voice ? (
        <p className={styles.voiceBadge} aria-hidden="true">
          <span className={styles.voiceDot} />
          {liveText || m.listening}
        </p>
      ) : null}
      {h.ctrl ? (
        <p className={styles.voiceBadge} style={h.voice ? { bottom: 68 } : undefined} aria-hidden="true">
          <kbd>Ctrl</kbd> {scanText || m.ctrlReady}
        </p>
      ) : null}
    </>
  );
}

/** Controls shown inside the settings panel. */
export function HandsFreeControls({ m }: { m: Msgs }) {
  const h = useHands();
  const uid = useId();
  const delays = [
    [1000, m.delays.short],
    [1500, m.delays.normal],
    [2500, m.delays.long],
  ] as const;

  return (
    <fieldset className={styles.group}>
      <legend>{m.title}</legend>
      <div className={styles.checks}>
        <label className={styles.check}>
          <input type="checkbox" checked={h.dwell} onChange={(e) => setHands({ dwell: e.target.checked })} />
          <span>{m.dwell}</span>
        </label>
      </div>
      <p className={styles.speechNote}>{m.dwellHelp}</p>
      {h.dwell ? (
        <>
          <p className={styles.speechLabel}>{m.delay}</p>
          <div className={styles.options}>
            {delays.map(([v, label]) => (
              <label key={v} className={styles.option}>
                <input type="radio" name={`${uid}-delay`} checked={h.delay === v} onChange={() => setHands({ delay: v })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}

      <div className={styles.checks} style={{ marginTop: 12 }}>
        <label className={styles.check}>
          <input type="checkbox" checked={h.large} onChange={(e) => setHands({ large: e.target.checked })} />
          <span>{m.large}</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={h.voice} onChange={(e) => setHands({ voice: e.target.checked })} />
          <span>{m.voice}</span>
        </label>
      </div>
      <p className={styles.speechNote}>{m.voiceHelp}</p>

      <div className={styles.checks} style={{ marginTop: 12 }}>
        <label className={styles.check}>
          <input type="checkbox" checked={h.ctrl} onChange={(e) => setHands({ ctrl: e.target.checked })} />
          <span>{m.ctrl}</span>
        </label>
      </div>
      <p className={styles.speechNote}>{m.ctrlHelp}</p>
    </fieldset>
  );
}
