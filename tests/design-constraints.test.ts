import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  defaultDesignConstraints,
  describeDesignConstraints,
  normalizeDesignConstraints
} = require("../studio/server/services/design-constraints.ts");

test("default design constraints favor concise presentation-scale slides", () => {
  assert.equal(defaultDesignConstraints.maxWordsPerSlide, 60);
  assert.deepEqual(normalizeDesignConstraints({}).maxWordsPerSlide, 60);
  assert.ok(
    describeDesignConstraints({}).includes("keep each slide at or under 60 words"),
    "generation context should state the lower default word budget"
  );
});

test("explicit deck word budgets still override the lower default", () => {
  assert.equal(normalizeDesignConstraints({ maxWordsPerSlide: 42 }).maxWordsPerSlide, 42);
});
