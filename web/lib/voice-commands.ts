// Pure helpers for voice control (no DOM), so the matching rules can be unit-tested. Run: npm test

export type VoiceCommands = {
  down: readonly string[];
  up: readonly string[];
  top: readonly string[];
  bottom: readonly string[];
  back: readonly string[];
  forward: readonly string[];
  stop: readonly string[];
  done: readonly string[];
  click: readonly string[];
};

export type VoiceAction = "stop" | "down" | "up" | "top" | "bottom" | "back" | "forward" | "done";

/** Lower-case, ё→е, punctuation removed, single spaces: speech engines add commas, capitals and full stops. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Whole-phrase match against the command lists ("вниз" scrolls, "вниз страницы" goes to the bottom). */
export function matchAction(raw: string, c: VoiceCommands): VoiceAction | null {
  const t = norm(raw);
  if (!t) return null;
  const is = (list: readonly string[]) => list.some((p) => norm(p) === t);
  const order: VoiceAction[] = ["stop", "down", "up", "top", "back", "forward", "bottom", "done"];
  return order.find((a) => is(c[a])) ?? null;
}

/** "нажми Войти" → "войти": drops a leading click verb from the command list. */
export function stripClickVerb(raw: string, verbs: readonly string[]): string {
  let q = norm(raw);
  for (const verb of verbs) {
    const v = norm(verb);
    if (v && q.startsWith(`${v} `)) q = q.slice(v.length + 1);
  }
  return q;
}

export type Candidate<T> = { item: T; name: string };

/**
 * Chooses the control to click. An exact name always wins. A partial match needs at least 3 letters and must be
 * unambiguous in its best form (shortest name wins, a tie is refused) so a short word never clicks the wrong
 * button, e.g. "вход" must not pick one of two different "вход …" buttons at random.
 */
export function pickTarget<T>(named: readonly Candidate<T>[], query: string): T | null {
  if (!query) return null;
  const exact = named.find((x) => x.name === query);
  if (exact) return exact.item;
  if (query.length < 3) return null;
  const partial = named.filter((x) => x.name.includes(query)).sort((a, b) => a.name.length - b.name.length);
  if (partial.length === 0) return null;
  if (partial.length > 1 && partial[0].name.length === partial[1].name.length) return null;
  return partial[0].item;
}
