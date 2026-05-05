import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";

const require = createRequire(import.meta.url);

const {
  createSameFamilyLayoutIntentSpec
} = require("../studio/server/services/local-layout-candidates.ts");

type JsonRecord = Record<string, unknown>;

function createContentSlide(layout = "standard"): JsonRecord {
  return {
    eyebrow: "Variant workflow",
    guardrails: [
      { body: "Keep candidate application visible.", id: "guardrail-1", title: "Apply" },
      { body: "Compare before promotion.", id: "guardrail-2", title: "Review" },
      { body: "Preserve the target slide.", id: "guardrail-3", title: "Scope" }
    ],
    guardrailsTitle: "Decision checks",
    index: 1,
    layout,
    signals: [
      { body: "Candidates need a visible delta.", id: "signal-1", title: "Delta" },
      { body: "Preview should match apply.", id: "signal-2", title: "Preview" },
      { body: "Slide identity stays stable.", id: "signal-3", title: "Identity" }
    ],
    signalsTitle: "Apply signals",
    summary: "Layout candidates should make a visible change when applied.",
    title: "Variant apply",
    type: "content"
  };
}

test("same-family layout intents avoid no-op content candidates", () => {
  const candidate = createSameFamilyLayoutIntentSpec(createContentSlide("standard"), {
    emphasis: "Make the hierarchy easier to scan.",
    label: "Workflow layout",
    rationale: "The slide should feel easier to compare."
  });

  assert.equal(candidate.type, "content");
  assert.notEqual(candidate.layout, "standard", "generic layout variants should produce a visible layout change");
});

test("same-family layout intents choose another treatment from non-standard content layouts", () => {
  const candidate = createSameFamilyLayoutIntentSpec(createContentSlide("focus"), {
    emphasis: "Make the hierarchy easier to scan.",
    label: "Workflow layout",
    rationale: "The slide should feel easier to compare."
  });

  assert.equal(candidate.type, "content");
  assert.notEqual(candidate.layout, "focus", "generic layout variants should not resolve back to the current layout");
});
