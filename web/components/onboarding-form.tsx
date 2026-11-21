"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import type { Messages } from "@/lib/i18n";
import { ResendVerification } from "./resend-verification";
import styles from "./auth.module.css";

export type OnboardingInitial = {
  city: string;
  displayName: string;
  orgName: string;
  orgType: string;
  category: string;
  formats: string[];
  priceFrom: string;
  priceTo: string;
  experienceYears: string;
  ageMin: string;
  ageMax: string;
  headline: string;
  bio: string;
};

/**
 * none: everything editable (draft). partial: in review or confirmed, so name, specialization and experience stay as
 * reviewed (the server ignores changes to them). full: rejected or blocked, nothing can be changed here.
 */
export type ProfileLock = "none" | "partial" | "full";

type Props = {
  role: "parent" | "specialist" | "organization";
  lang: string;
  m: Messages["onboarding"];
  auth: Messages["auth"];
  cities: Record<string, string>;
  categories: { slug: string; name: string }[];
  initial: OnboardingInitial;
  lock: ProfileLock;
  /** onboarding: first fill-in, then continue to the next page. settings: save in place and stay. */
  mode: "onboarding" | "settings";
  /** E-mail not confirmed yet: sending for review / saving an organization is refused by the server. */
  needsVerification: boolean;
};

const intOrEmpty = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : Number(s);
};

export function OnboardingForm({ role, lang, m, auth, cities, categories, initial, lock, mode, needsVerification }: Props) {
  const router = useRouter();
  const uid = useId();
  const [formats, setFormats] = useState<string[]>(initial.formats.length ? initial.formats : ["online"]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partial = lock === "partial";

  async function save(formEl: HTMLFormElement, submit: boolean) {
    const form = new FormData(formEl);
    const payload: Record<string, unknown> = { city: String(form.get("city") ?? "") };
    if (role === "organization") {
      payload.name = String(form.get("name") ?? "");
      payload.orgType = String(form.get("orgType") ?? "");
    }
    if (role === "specialist") {
      Object.assign(payload, {
        // Reviewed fields are shown read-only while in review / confirmed; the stored values are sent back.
        displayName: partial ? initial.displayName : String(form.get("displayName") ?? ""),
        category: partial ? initial.category : String(form.get("category") ?? ""),
        experienceYears: partial ? Number(initial.experienceYears) : intOrEmpty(form.get("experienceYears")),
        formats,
        priceFrom: intOrEmpty(form.get("priceFrom")),
        priceTo: intOrEmpty(form.get("priceTo")),
        ageMin: intOrEmpty(form.get("ageMin")),
        ageMax: intOrEmpty(form.get("ageMax")),
        headline: String(form.get("headline") ?? ""),
        bio: String(form.get("bio") ?? ""),
        submit,
      });
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: { code?: string } } | null;
      if (res.ok && data?.ok) {
        if (mode === "settings") {
          setSaved(true);
        } else {
          router.replace(role === "parent" ? `/${lang}` : `/${lang}/account`);
        }
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

  // Own keys only: "constructor" or "toString" must not count as known error codes.
  const errorText = error ? (Object.hasOwn(auth.errors, error) ? auth.errors[error as keyof typeof auth.errors] : auth.errors.server_error) : null;
  const toggleFormat = (f: string) => setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <>
      <div aria-live="polite">
        {errorText ? (
          <p role="alert" className={styles.alert}>
            {errorText}
          </p>
        ) : null}
        {saved ? (
          <p className={styles.notice} role="status">
            {m.saved}
          </p>
        ) : null}
        {lock === "full" ? <p className={styles.notice}>{m.locked}</p> : null}
        {partial ? <p className={styles.notice}>{m.lockedPartial}</p> : null}
      </div>
      {needsVerification && lock === "none" ? (
        <div className={styles.notice} id={`${uid}-verify`}>
          <p style={{ margin: "0 0 8px" }}>{role === "organization" ? m.verifyFirstOrg : m.verifyFirstSpec}</p>
          <ResendVerification lang={lang} label={m.resend} doneLabel={m.resent} errorLabel={auth.errors.rate_limited} compact />
        </div>
      ) : null}

      <form
        className={styles.form}
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          void save(e.currentTarget, false);
        }}
      >
        <fieldset disabled={lock === "full" || pending} style={{ display: "grid", gap: 18, border: 0, padding: 0, margin: 0 }}>
          {role === "organization" ? (
            <>
              <div className={styles.field}>
                <label htmlFor={`${uid}-name`}>{m.orgName}</label>
                <input id={`${uid}-name`} name="name" className={styles.input} defaultValue={initial.orgName} maxLength={160} required />
              </div>
              <div className={styles.field}>
                <label htmlFor={`${uid}-type`}>{m.orgType}</label>
                <select id={`${uid}-type`} name="orgType" className={styles.input} defaultValue={initial.orgType || "school"} required>
                  {Object.entries(m.orgTypes).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          {role === "specialist" ? (
            <>
              <div className={styles.field}>
                <label htmlFor={`${uid}-dn`}>{m.displayName}</label>
                <input id={`${uid}-dn`} name="displayName" className={styles.input} defaultValue={initial.displayName} maxLength={120} disabled={partial} required />
              </div>
              <div className={styles.field}>
                <label htmlFor={`${uid}-cat`}>{m.category}</label>
                <select id={`${uid}-cat`} name="category" className={styles.input} defaultValue={initial.category} disabled={partial} required>
                  <option value="" disabled>
                    {m.selectCategory}
                  </option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          <div className={styles.field}>
            <label htmlFor={`${uid}-city`}>{m.city}</label>
            <select id={`${uid}-city`} name="city" className={styles.input} defaultValue={initial.city} required>
              <option value="" disabled>
                {m.selectCity}
              </option>
              {Object.entries(cities).map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {role === "specialist" ? (
            <>
              <fieldset className={styles.formats}>
                <legend className={styles.legend}>{m.formats}</legend>
                {(["online", "offline"] as const).map((f) => (
                  <label key={f} className={styles.formatOption}>
                    <input type="checkbox" checked={formats.includes(f)} onChange={() => toggleFormat(f)} />
                    <span>{m[f]}</span>
                  </label>
                ))}
              </fieldset>

              <div className={styles.twoCols}>
                <div className={styles.field}>
                  <label htmlFor={`${uid}-pf`}>{m.priceFrom}</label>
                  <input id={`${uid}-pf`} name="priceFrom" type="number" inputMode="numeric" min={0} step={10000} className={styles.input} defaultValue={initial.priceFrom} required />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${uid}-pt`}>{m.priceTo}</label>
                  <input id={`${uid}-pt`} name="priceTo" type="number" inputMode="numeric" min={0} step={10000} className={styles.input} defaultValue={initial.priceTo} required />
                </div>
              </div>

              <div className={styles.twoCols}>
                <div className={styles.field}>
                  <label htmlFor={`${uid}-am`}>{m.ageMin}</label>
                  <input id={`${uid}-am`} name="ageMin" type="number" inputMode="numeric" min={0} max={18} className={styles.input} defaultValue={initial.ageMin || "0"} required />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${uid}-aM`}>{m.ageMax}</label>
                  <input id={`${uid}-aM`} name="ageMax" type="number" inputMode="numeric" min={0} max={18} className={styles.input} defaultValue={initial.ageMax || "18"} required />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor={`${uid}-exp`}>{m.experience}</label>
                <input id={`${uid}-exp`} name="experienceYears" type="number" inputMode="numeric" min={0} max={70} className={styles.input} defaultValue={initial.experienceYears || "0"} disabled={partial} required />
              </div>

              <div className={styles.field}>
                <label htmlFor={`${uid}-hl`}>{m.headline}</label>
                <textarea id={`${uid}-hl`} name="headline" className={styles.input} style={{ minHeight: 96, padding: 14, resize: "vertical" }} defaultValue={initial.headline} maxLength={200} aria-describedby={`${uid}-hlh`} />
                <p id={`${uid}-hlh`} className={styles.hint}>
                  {m.headlineHint}
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor={`${uid}-bio`}>
                  {m.bio} <span className={styles.optional}>({auth.nameOptional})</span>
                </label>
                <textarea id={`${uid}-bio`} name="bio" className={styles.input} style={{ minHeight: 160, padding: 14, resize: "vertical" }} defaultValue={initial.bio} maxLength={2000} aria-describedby={`${uid}-bioh`} />
                <p id={`${uid}-bioh`} className={styles.hint}>
                  {m.bioHint}
                </p>
              </div>
            </>
          ) : null}

          <div className={styles.actionsRow}>
            {role === "specialist" && partial ? (
              <button type="submit" className={styles.submit}>
                {pending ? m.saving : m.save}
              </button>
            ) : role === "specialist" ? (
              <>
                <button
                  type="button"
                  className={styles.submit}
                  disabled={needsVerification}
                  aria-describedby={needsVerification ? `${uid}-verify` : undefined}
                  onClick={(e) => {
                    const f = e.currentTarget.form!;
                    if (!f.reportValidity() || formats.length === 0) return;
                    void save(f, true);
                  }}
                >
                  {pending ? m.saving : m.submitReview}
                </button>
                <button type="submit" className={styles.secondaryBtn}>
                  {m.saveDraft}
                </button>
              </>
            ) : (
              <button
                type="submit"
                className={styles.submit}
                disabled={role === "organization" && needsVerification}
                aria-describedby={role === "organization" && needsVerification ? `${uid}-verify` : undefined}
              >
                {pending ? m.saving : m.save}
              </button>
            )}
            {mode === "onboarding" ? (
              <a className={styles.forgot} style={{ justifySelf: "center" }} href={role === "parent" ? `/${lang}` : `/${lang}/account`}>
                {m.later}
              </a>
            ) : null}
          </div>
        </fieldset>
      </form>
    </>
  );
}
