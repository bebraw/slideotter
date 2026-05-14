import assert from "node:assert/strict";
import test from "node:test";

import { cloneJsonObject, setPathValue } from "../studio/server/services/generated-json-path.ts";

test("generated JSON path helper writes nested object and array paths", () => {
  const value = {
    slides: [
      {
        keyPoints: [
          { title: "Old title" }
        ],
        title: "Slide"
      }
    ]
  };

  setPathValue(value, ["slides", 0, "keyPoints", 0, "title"], "New title");

  assert.equal(value.slides[0]?.keyPoints[0]?.title, "New title");
});

test("generated JSON path helper ignores incompatible paths", () => {
  const value = {
    slides: [
      { title: "Slide" }
    ]
  };

  setPathValue(value, ["slides", 0, "missing", "title"], "Ignored");

  assert.deepEqual(value, {
    slides: [
      { title: "Slide" }
    ]
  });
});

test("generated JSON path helper ignores keys with incompatible container types", () => {
  const value = {
    slides: [
      {
        title: "Slide"
      }
    ],
    meta: {
      title: "Deck"
    }
  };

  setPathValue(value, ["slides", "0", "title"], "Ignored");
  setPathValue(value, ["meta", 0], "Ignored");

  assert.deepEqual(value, {
    slides: [
      {
        title: "Slide"
      }
    ],
    meta: {
      title: "Deck"
    }
  });
});

test("generated JSON path clone does not retain nested object references", () => {
  const source = {
    slides: [
      { title: "Original" }
    ]
  };
  const cloned = cloneJsonObject(source);

  setPathValue(cloned, ["slides", 0, "title"], "Changed");

  assert.equal(source.slides[0]?.title, "Original");
  assert.equal(cloned.slides[0]?.title, "Changed");
});
