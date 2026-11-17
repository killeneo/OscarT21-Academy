// Unit tests for search query parsing. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuery, escapeLike, parseSearchParams } from "../lib/search/params.ts";

test("defaults: popular sort, verified only, first page", () => {
  const f = parseSearchParams({});
  assert.deepEqual(f, {
    q: "", category: null, city: null, format: null, age: null, priceMin: null, priceMax: null,
    minRating: null, verifiedOnly: true, sort: "popular", page: 1,
  });
});

test("valid values are parsed; hidden+checkbox uses the last value", () => {
  const f = parseSearchParams({
    q: "  логопед   Алия ", category: "speech_therapist", city: "tashkent", format: "online", age: "7",
    priceMin: "300000", priceMax: "100000", rating: "4.5", verified: ["0", "1"], sort: "rating", page: "3",
  });
  assert.equal(f.q, "логопед Алия");
  assert.equal(f.age, 7);
  assert.deepEqual([f.priceMin, f.priceMax], [100000, 300000]); // swapped when reversed
  assert.equal(f.minRating, 4.5);
  assert.equal(f.verifiedOnly, true);
  assert.equal(parseSearchParams({ verified: ["1", "0"] }).verifiedOnly, false);
  assert.equal(f.sort, "rating");
  assert.equal(f.page, 3);
});

test("hostile or out-of-range input falls back to safe defaults", () => {
  const f = parseSearchParams({
    category: "x'; DROP TABLE users;--", city: "../etc", format: "hybrid", age: "99", priceMin: "-5",
    priceMax: "1e9", rating: "9", sort: "popular; DELETE", page: "0", q: "a".repeat(500),
  });
  assert.equal(f.category, null);
  assert.equal(f.city, null);
  assert.equal(f.format, null);
  assert.equal(f.age, null);
  assert.equal(f.priceMin, null);
  assert.equal(f.priceMax, null);
  assert.equal(f.minRating, null);
  assert.equal(f.sort, "popular");
  assert.equal(f.page, 1);
  assert.equal(f.q.length, 80);
});

test("buildQuery omits defaults and round-trips", () => {
  const f = parseSearchParams({});
  assert.equal(buildQuery(f), "");
  const q = buildQuery(f, { category: "tutor", verifiedOnly: false, page: 2, sort: "priceAsc" });
  assert.equal(q, "?category=tutor&verified=0&sort=priceAsc&page=2");
  assert.equal(parseSearchParams(Object.fromEntries(new URLSearchParams(q))).page, 2);
});

test("escapeLike neutralises wildcards", () => {
  const bs = String.fromCharCode(92);
  assert.equal(escapeLike(`50%_off${bs}`), `50${bs}%${bs}_off${bs}${bs}`);
});
