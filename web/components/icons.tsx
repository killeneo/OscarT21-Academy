import type { SVGProps } from "react";

/** All icons are decorative by default (aria-hidden); meaning is always carried by adjacent text. */
type IconProps = SVGProps<SVGSVGElement>;

const base = { "aria-hidden": true, focusable: false } as const;

/** 4-point vector sparkle used in empty margins. */
export function Sparkle(props: IconProps) {
  return (
    <svg viewBox="0 0 40 40" {...base} {...props}>
      <path d="M20 0c1.6 10.4 9.6 18.4 20 20-10.4 1.6-18.4 9.6-20 20C18.4 29.6 10.4 21.6 0 20 10.4 18.4 18.4 10.4 20 0Z" fill="currentColor" />
    </svg>
  );
}

export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" {...base} {...props}>
      <rect width="32" height="32" rx="10" fill="#0f2c23" />
      <path d="M16 6c.9 5.4 4.6 9.1 10 10-5.4.9-9.1 4.6-10 10-.9-5.4-4.6-9.1-10-10 5.4-.9 9.1-4.6 10-10Z" fill="#7fd1a0" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...base} {...props}>
      <circle cx="12" cy="12" r="12" fill="#d1e9d2" />
      <path d="m7 12.5 3.2 3.2L17 8.8" stroke="#0f2c23" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 40 40" {...base} {...props}>
      <circle cx="20" cy="20" r="20" fill="#e6f4ea" />
      <path d="M16 12.5v15l12-7.5-12-7.5Z" fill="#0f2c23" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...base} {...props}>
      <path d="M12 2.5 4.5 5.5v5.7c0 4.6 3.1 8.2 7.5 10.3 4.4-2.1 7.5-5.7 7.5-10.3V5.5L12 2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m8.8 12 2.3 2.3 4.2-4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AwardIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...base} {...props}>
      <circle cx="12" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.8 13.6-1.6 7 4.8-2.6 4.8 2.6-1.6-7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...base} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...base} {...props}>
      <path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---- Category icons (line style) ---- */

export function BookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...base} {...props}>
      <path d="M8 10h13a5 5 0 0 1 3 1v27a5 5 0 0 0-3-1H8V10Zm32 0H27a5 5 0 0 0-3 1v27a5 5 0 0 1 3-1h13V10Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

export function HandsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...base} {...props}>
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2.4" />
      <path d="M24 6v6m0 24v6M6 24h6m24 0h6M11.3 11.3l4.2 4.2m17 17 4.2 4.2m0-25.4-4.2 4.2m-17 17-4.2 4.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChildIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...base} {...props}>
      <circle cx="17" cy="15" r="5" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="33" cy="22" r="4" stroke="currentColor" strokeWidth="2.4" />
      <path d="M8 38v-4a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8v4M28 38v-3a6 6 0 0 1 6-6h1a6 6 0 0 1 6 6v3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...base} {...props}>
      <path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H22l-8 7v-7h-2a4 4 0 0 1-4-4V12Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M16 17h16M16 23h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/* ---- Illustrated avatars / scenes (no real photos: synthetic placeholders) ---- */

type Tone = "peach" | "lavender" | "butter" | "mint";
const toneFill: Record<Tone, string> = { peach: "#fde6d5", lavender: "#e0e7ff", butter: "#fef3c7", mint: "#d1fae5" };

/** Small round illustrated face, used inline in the hero headline. */
export function AvatarFace({ tone = "peach", ...props }: IconProps & { tone?: Tone }) {
  return (
    <svg viewBox="0 0 48 48" {...base} {...props}>
      <circle cx="24" cy="24" r="24" fill={toneFill[tone]} />
      <circle cx="24" cy="19" r="8" fill="#f2c9a5" />
      <path d="M15 18c0-6 4-9 9-9s9 3 9 9c-2-3-5-4-9-4s-7 1-9 4Z" fill="#0f2c23" />
      <path d="M8 44c1-9 7-14 16-14s15 5 16 14a24 24 0 0 1-32 0Z" fill="#0f2c23" />
    </svg>
  );
}

/** Hero portrait: specialist and child on a mint arch (illustration placeholder). */
export function HeroScene(props: IconProps) {
  return (
    <svg viewBox="0 0 440 520" {...base} {...props}>
      <path d="M20 520V220C20 100 110 10 220 10s200 90 200 210v300H20Z" fill="#d1e9d2" />
      <path d="M20 520V260C20 150 100 70 220 70s200 80 200 190v260H20Z" fill="#e6f4ea" />
      {/* specialist */}
      <circle cx="190" cy="215" r="48" fill="#f2c9a5" />
      <path d="M140 205c0-40 24-62 52-62s52 22 52 62c-12-18-30-26-52-26s-40 8-52 26Z" fill="#0f2c23" />
      <path d="M95 520c4-90 40-140 95-140s91 50 95 140H95Z" fill="#0f2c23" />
      <path d="M170 380l20 34 20-34" stroke="#fdfbf7" strokeWidth="6" fill="none" strokeLinejoin="round" />
      {/* child */}
      <circle cx="318" cy="318" r="34" fill="#f2c9a5" />
      <path d="M284 312c2-26 18-40 36-40s32 12 34 36c-8-10-18-14-34-14s-26 4-36 18Z" fill="#b45309" />
      <path d="M262 520c2-62 26-96 58-96s56 34 58 96H262Z" fill="#fef3c7" />
      <circle cx="306" cy="322" r="3.5" fill="#0f2c23" />
      <circle cx="330" cy="322" r="3.5" fill="#0f2c23" />
      <path d="M308 336q8 7 16 0" stroke="#0f2c23" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Value-prop scene: person studying at a laptop (illustration placeholder). */
export function StudyScene(props: IconProps) {
  return (
    <svg viewBox="0 0 480 400" {...base} {...props}>
      <rect width="480" height="400" rx="32" fill="#e0e7ff" />
      <circle cx="380" cy="80" r="46" fill="#fef3c7" />
      <rect x="110" y="250" width="260" height="14" rx="7" fill="#0f2c23" />
      <path d="M150 250V160a12 12 0 0 1 12-12h156a12 12 0 0 1 12 12v90H150Z" fill="#fdfbf7" stroke="#0f2c23" strokeWidth="6" />
      <path d="M180 190h96M180 214h60" stroke="#7fd1a0" strokeWidth="10" strokeLinecap="round" />
      <circle cx="320" cy="200" r="16" fill="#d1fae5" />
      <path d="m313 200 5 5 9-10" stroke="#0f2c23" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="90" cy="206" r="28" fill="#f2c9a5" />
      <path d="M62 200c0-20 12-32 28-32s28 12 28 32c-6-8-16-12-28-12s-22 4-28 12Z" fill="#0f2c23" />
      <path d="M40 330c2-50 20-80 50-80s48 30 50 80H40Z" fill="#fde6d5" />
    </svg>
  );
}
