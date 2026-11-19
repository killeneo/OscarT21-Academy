// Unit tests for the voice-command matching rules. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchAction, norm, pickTarget, stripClickVerb } from "../lib/voice-commands.ts";

const C = {
  down: ["вниз", "ниже"],
  up: ["вверх"],
  top: ["в начало"],
  bottom: ["вниз страницы", "в конец"],
  back: ["назад"],
  forward: ["вперёд"],
  stop: ["стоп", "отмена"],
  done: ["готово"],
  click: ["нажми", "открой"],
};

test("norm drops case, punctuation and ё", () => {
  assert.equal(norm("  Вперёд!  "), "вперед");
  assert.equal(norm("Нажми, «Войти»."), "нажми войти");
});

test("whole-phrase commands match, partial phrases do not", () => {
  assert.equal(matchAction("Вниз.", C), "down");
  assert.equal(matchAction("вниз страницы", C), "bottom");
  assert.equal(matchAction("вперед", C), "forward");
  assert.equal(matchAction("СТОП", C), "stop");
  assert.equal(matchAction("вниз пожалуйста", C), null);
  assert.equal(matchAction("", C), null);
});

test("click verb is stripped only at the start", () => {
  assert.equal(stripClickVerb("Нажми Войти", C.click), "войти");
  assert.equal(stripClickVerb("Открой каталог", C.click), "каталог");
  assert.equal(stripClickVerb("Войти", C.click), "войти");
  assert.equal(stripClickVerb("пожалуйста нажми войти", C.click), "пожалуйста нажми войти");
});

test("pickTarget: exact beats partial, ambiguity is refused, short queries never partial-match", () => {
  const items = [
    { item: "login", name: "войти" },
    { item: "signup", name: "регистрация" },
    { item: "a", name: "курсы для родителей" },
    { item: "b", name: "курсы для педагогов" },
  ];
  assert.equal(pickTarget(items, "войти"), "login");
  assert.equal(pickTarget(items, "регистр"), "signup");
  assert.equal(pickTarget(items, "курсы для"), null); // two names of equal length: do not guess
  assert.equal(pickTarget(items, "вх"), null);
  assert.equal(pickTarget(items, ""), null);
  assert.equal(pickTarget(items, "удалить"), null);
});
