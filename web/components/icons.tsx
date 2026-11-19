import Image from "next/image";
import type { CSSProperties, SVGProps } from "react";

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

/** Brand logo: raster with transparent background (public/logo.png). Size it by height; width follows the aspect ratio. */
export function LogoMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return <Image src="/logo.png" width={640} height={459} alt="" aria-hidden="true" priority className={className} style={{ width: "auto", ...style }} />;
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...base} {...props}>
      <circle cx="12" cy="12" r="12" fill="#c3d3ed" />
      <path d="m7 12.5 3.2 3.2L17 8.8" stroke="#0f2a5c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 40 40" {...base} {...props}>
      <circle cx="20" cy="20" r="20" fill="#dce6f5" />
      <path d="M16 12.5v15l12-7.5-12-7.5Z" fill="#0f2a5c" />
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

export function SlidersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...base} {...props}>
      <path d="M8 14h20m8 0h4M8 34h6m8 0h18M8 24h12m8 0h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="14" r="4" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="18" cy="34" r="4" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

/* ---- Illustrated avatars / scenes (no real photos: synthetic placeholders) ---- */

type Tone = "gold" | "teal" | "sand" | "emerald";
const toneFill: Record<Tone, string> = { gold: "#e9edf2", teal: "#d6e4f7", sand: "#e8ecf1", emerald: "#dce6f5" };

/** Small round illustrated face, used inline in the hero headline. */
export function AvatarFace({ tone = "gold", ...props }: IconProps & { tone?: Tone }) {
  return (
    <svg viewBox="0 0 48 48" {...base} {...props}>
      <circle cx="24" cy="24" r="24" fill={toneFill[tone]} />
      <circle cx="24" cy="19" r="8" fill="#f2c9a5" />
      <path d="M15 18c0-6 4-9 9-9s9 3 9 9c-2-3-5-4-9-4s-7 1-9 4Z" fill="#0f2a5c" />
      <path d="M8 44c1-9 7-14 16-14s15 5 16 14a24 24 0 0 1-32 0Z" fill="#0f2a5c" />
    </svg>
  );
}
