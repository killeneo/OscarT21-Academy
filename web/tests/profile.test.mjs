// Unit tests for onboarding profile validation. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { BIO_MAX, multilineText, parseOnboarding } from "../lib/profile/validate.ts";

test("bio: keeps line breaks (one empty line at most), collapses spaces, refuses control characters", () => {
  assert.equal(multilineText(undefined, BIO_MAX), "");
  assert.equal(multilineText("  Hello   world \r\n\r\n\r\n\r\nSecond\tline  ", BIO_MAX), "Hello world\n\nSecond line");
  assert.equal(multilineText("a\u0000b", BIO_MAX), null);
  assert.equal(multilineText("a\u001bb", BIO_MAX), null);
  assert.equal(multilineText(42, BIO_MAX), null);
  assert.equal(multilineText("я".repeat(BIO_MAX), BIO_MAX)?.length, BIO_MAX);
  assert.equal(multilineText("я".repeat(BIO_MAX + 1), BIO_MAX), null);
});

const isCity = (v) => v === "tashkent" || v === "samarkand";

const specialist = {
  displayName: "  Demo   Specialist ", category: "tutor", city: "tashkent", formats: ["online", "offline", "online"],
  priceFrom: 100000, priceTo: "150000", experienceYears: 5, ageMin: 3, ageMax: 12, headline: "Hello", submit: true,
};

test("parent needs only a known city", () => {
  assert.deepEqual(parseOnboarding("parent", { city: "tashkent" }, isCity), { ok: true, role: "parent", data: { city: "tashkent" } });
  assert.equal(parseOnboarding("parent", { city: "atlantis" }, isCity).ok, false);
  assert.equal(parseOnboarding("parent", {}, isCity).ok, false);
});

test("organization requires name and a valid type", () => {
  const ok = parseOnboarding("organization", { city: "samarkand", name: " School 5 ", orgType: "school" }, isCity);
  assert.deepEqual(ok, { ok: true, role: "organization", data: { name: "School 5", orgType: "school", city: "samarkand" } });
  assert.equal(parseOnboarding("organization", { city: "samarkand", name: "", orgType: "school" }, isCity).ok, false);
  assert.equal(parseOnboarding("organization", { city: "samarkand", name: "X", orgType: "bank" }, isCity).ok, false);
});

test("specialist: normalises input and de-duplicates formats", () => {
  const r = parseOnboarding("specialist", specialist, isCity);
  assert.equal(r.ok, true);
  assert.equal(r.data.displayName, "Demo Specialist");
  assert.deepEqual(r.data.formats, ["online", "offline"]);
  assert.equal(r.data.priceTo, 150000);
  assert.equal(r.data.submit, true);
});

test("specialist: rejects inconsistent or hostile values", () => {
  const bad = [
    { priceTo: 50000 }, // below priceFrom
    { ageMin: 15, ageMax: 5 },
    { ageMax: 19 },
    { experienceYears: 80 },
    { formats: [] },
    { formats: ["hybrid"] },
    { category: "x'; DROP TABLE users;--" },
    { displayName: "" },
    { headline: "a".repeat(201) },
    { priceFrom: -1 },
  ];
  for (const patch of bad) assert.equal(parseOnboarding("specialist", { ...specialist, ...patch }, isCity).ok, false, JSON.stringify(patch));
});

test("moderators and administrators have no self-service profile", () => {
  assert.equal(parseOnboarding("admin", { city: "tashkent" }, isCity).ok, false);
  assert.equal(parseOnboarding("moderator", { city: "tashkent" }, isCity).ok, false);
});

test("a client cannot smuggle a verification status", () => {
  const r = parseOnboarding("specialist", { ...specialist, verificationStatus: "confirmed", isPublished: true }, isCity);
  assert.equal(r.ok, true);
  assert.equal("verificationStatus" in r.data, false);
  assert.equal("isPublished" in r.data, false);
});
