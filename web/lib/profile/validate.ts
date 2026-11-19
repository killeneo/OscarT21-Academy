// Pure validation of the post-registration profile (no imports, unit-tested with node --test).

export type Role = "parent" | "specialist" | "organization" | "moderator" | "admin";

export type SpecialistInput = {
  displayName: string;
  category: string;
  city: string;
  formats: ("online" | "offline")[];
  priceFrom: number;
  priceTo: number;
  experienceYears: number;
  ageMin: number;
  ageMax: number;
  headline: string;
  submit: boolean;
};
export type ParentInput = { city: string };
export type OrganizationInput = { name: string; orgType: "school" | "center" | "ngo" | "other"; city: string };

export type Parsed =
  | { ok: true; role: "specialist"; data: SpecialistInput }
  | { ok: true; role: "parent"; data: ParentInput }
  | { ok: true; role: "organization"; data: OrganizationInput }
  | { ok: false };

const SLUG_RE = /^[a-z_]{1,40}$/;
const ORG_TYPES = ["school", "center", "ngo", "other"] as const;

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  // Control characters (NUL makes PostgreSQL reject the query) are invalid input, not a server error.
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  return v.length >= min && v.length <= max ? v : null;
}

function int(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d{1,9}$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function parseOnboarding(role: Role, body: Record<string, unknown>, isCity: (v: unknown) => boolean): Parsed {
  if (!isCity(body.city)) return { ok: false };
  const city = body.city as string;

  if (role === "parent") return { ok: true, role, data: { city } };

  if (role === "organization") {
    const name = text(body.name, 1, 160);
    const orgType = (ORG_TYPES as readonly unknown[]).includes(body.orgType) ? (body.orgType as OrganizationInput["orgType"]) : null;
    if (!name || !orgType) return { ok: false };
    return { ok: true, role, data: { name, orgType, city } };
  }

  if (role === "specialist") {
    const displayName = text(body.displayName, 1, 120);
    const category = typeof body.category === "string" && SLUG_RE.test(body.category) ? body.category : null;
    const formats = Array.isArray(body.formats) ? [...new Set(body.formats)] : [];
    const priceFrom = int(body.priceFrom, 0, 100_000_000);
    const priceTo = int(body.priceTo, 0, 100_000_000);
    const experienceYears = int(body.experienceYears, 0, 70);
    const ageMin = int(body.ageMin, 0, 18);
    const ageMax = int(body.ageMax, 0, 18);
    const headline = body.headline === undefined || body.headline === "" ? "" : text(body.headline, 1, 200);
    if (
      !displayName || !category || headline === null ||
      formats.length === 0 || !formats.every((f) => f === "online" || f === "offline") ||
      priceFrom === null || priceTo === null || priceTo < priceFrom ||
      experienceYears === null || ageMin === null || ageMax === null || ageMax < ageMin
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      role,
      data: {
        displayName, category, city, formats: formats as SpecialistInput["formats"],
        priceFrom, priceTo, experienceYears, ageMin, ageMax, headline, submit: body.submit === true,
      },
    };
  }

  return { ok: false }; // moderators / administrators have no self-service profile
}
