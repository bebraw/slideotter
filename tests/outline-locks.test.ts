import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOutlineLocks } from "../studio/shared/outline-locks.ts";

test("outline locks keep only numeric keys with true values", () => {
  assert.deepEqual(normalizeOutlineLocks({
    "1": true,
    "02": true,
    "3a": true,
    a3: true,
    "4": false,
    "5": "true"
  }), {
    "1": true,
    "02": true
  });
});

test("outline locks reject arrays, nulls, and primitives", () => {
  assert.deepEqual(normalizeOutlineLocks(null), {});
  assert.deepEqual(normalizeOutlineLocks(["1"]), {});
  assert.deepEqual(normalizeOutlineLocks("1"), {});
});
