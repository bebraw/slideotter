import assert from "node:assert/strict";
import test from "node:test";

import {
  asRecord,
  asRecordArray,
  compactSentence,
  normalizeSentence,
  trimWords
} from "../studio/shared/json-utils.ts";

test("JSON record helpers reject nulls, arrays, and primitives", () => {
  const record = { title: "Slide" };

  assert.equal(asRecord(record), record);
  assert.deepEqual(asRecord(null), {});
  assert.deepEqual(asRecord(["not", "record"]), {});
  assert.deepEqual(asRecord("not-record"), {});
  assert.deepEqual(asRecord(42), {});
});

test("JSON record array helper keeps only object entries", () => {
  const first = { title: "First" };
  const second = { title: "Second" };

  assert.deepEqual(asRecordArray([first, null, ["nested"], second, "ignored"]), [first, second]);
  assert.deepEqual(asRecordArray({ title: "not-array" }), []);
});

test("trimWords normalizes surrounding whitespace and enforces word limit", () => {
  assert.equal(trimWords("  one   two\nthree  ", 3), "one two three");
  assert.equal(trimWords("one two three four", 3), "one two three...");
  assert.equal(trimWords("   ", 3), "");
  assert.equal(trimWords(null, 3), "");
});

test("compactSentence collapses whitespace, uses fallback, and trims to limit", () => {
  assert.equal(compactSentence("  one \n two\t three  ", "fallback", 3), "one two three");
  assert.equal(compactSentence("", "fallback value with detail", 2), "fallback value...");
  assert.equal(compactSentence("one two three", "fallback", 2), "one two...");
});

test("normalizeSentence collapses spacing and removes gaps before punctuation", () => {
  assert.equal(normalizeSentence("  Hello   ,   world  !  "), "Hello, world!");
  assert.equal(normalizeSentence("Line\nbreak\ttext"), "Line break text");
  assert.equal(normalizeSentence(null), "");
});
