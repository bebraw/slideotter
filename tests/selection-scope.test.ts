const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertPatchWithinSelectionScope,
  assertSelectionAnchorsCurrent,
  buildActionDescriptors,
  createSelectionApplyScope,
  hashFieldValue,
  mergeCandidateIntoSelectionScope,
  normalizeSelectionScope
} = require("../studio/server/services/selection-scope.ts");

const baseSpec = {
  guardrails: [
    { body: "Keep review explicit.", title: "Review" },
    { body: "Compare alternatives before applying.", title: "Compare" }
  ],
  guardrailsTitle: "Guardrails",
  signals: [
    { body: "Use chat for bounded tasks.", title: "Chat" },
    { body: "Current and candidate views.", title: "Views" }
  ],
  signalsTitle: "Signals",
  summary: "Chat launches bounded workflows.",
  title: "Use chat for bounded tasks",
  type: "content"
};

type ActionDescriptor = {
  acceptsScope: string[];
  rel: string;
};

test("normalizes selection scope with field hash and path metadata", () => {
  const scope = normalizeSelectionScope({
    fieldPath: ["signals", 1, "body"],
    selectedText: "Current and candidate views.",
    slideId: "slide-12"
  }, {
    slideId: "slide-12",
    slideSpec: baseSpec
  });

  assert.equal(scope.kind, "selection");
  assert.deepEqual(scope.fieldPath, ["signals", 1, "body"]);
  assert.equal(scope.fieldHash, hashFieldValue("Current and candidate views."));
});

test("selection merge rewrites only selected owning field", () => {
  const scope = normalizeSelectionScope({
    fieldPath: ["signals", 1, "body"],
    selectedText: "Current and candidate views.",
    slideId: "slide-12"
  }, {
    slideId: "slide-12",
    slideSpec: baseSpec
  });
  const candidate = {
    ...baseSpec,
    guardrailsTitle: "Changed outside scope",
    signals: [
      baseSpec.signals[0],
      { ...baseSpec.signals[1], body: "Compare the current slide with candidates." }
    ]
  };

  const merged = mergeCandidateIntoSelectionScope(baseSpec, candidate, scope);

  assert.equal(merged.signals[1].body, "Compare the current slide with candidates.");
  assert.equal(merged.guardrailsTitle, "Guardrails");
  assert.doesNotThrow(() => assertPatchWithinSelectionScope(baseSpec, merged, scope));
});

test("selection apply rejects unrelated field changes", () => {
  const scope = normalizeSelectionScope({
    fieldPath: ["signals", 1, "body"],
    selectedText: "Current and candidate views.",
    slideId: "slide-12"
  }, {
    slideId: "slide-12",
    slideSpec: baseSpec
  });
  const nextSpec = {
    ...baseSpec,
    summary: "Changed outside scope."
  };

  assert.throws(
    () => assertPatchWithinSelectionScope(baseSpec, nextSpec, scope),
    /outside its scope/
  );
});

test("selection apply rejects stale field hash", () => {
  const scope = normalizeSelectionScope({
    fieldHash: hashFieldValue("Previous value."),
    fieldPath: ["signals", 1, "body"],
    selectedText: "Current and candidate views.",
    slideId: "slide-12"
  }, {
    slideId: "slide-12",
    slideSpec: baseSpec
  });

  assert.throws(
    () => assertSelectionAnchorsCurrent(baseSpec, scope),
    /changed after candidate generation/
  );
});

test("action descriptors advertise selection scope without deck mutation power", () => {
  const actions = buildActionDescriptors();
  const assistantAction = actions.find((action: ActionDescriptor) => action.rel === "assistant-message");
  const deckAction = actions.find((action: ActionDescriptor) => action.rel === "ideate-deck-structure");

  assert.ok(assistantAction.acceptsScope.includes("selection"));
  assert.ok(assistantAction.acceptsScope.includes("slide"));
  assert.ok(!assistantAction.acceptsScope.includes("deck"));
  assert.deepEqual(deckAction.acceptsScope, ["deck"]);
});

test("selection apply scope records family-changing metadata explicitly", () => {
  const scope = normalizeSelectionScope({
    fieldPath: ["signals", 1, "body"],
    selectedText: "Current and candidate views.",
    slideId: "slide-12"
  }, {
    slideId: "slide-12",
    slideSpec: baseSpec
  });
  const applyScope = createSelectionApplyScope(scope, {
    allowFamilyChange: true,
    familyChange: {
      droppedFields: ["signals"],
      preservedFields: ["title", "quote"],
      targetFamily: "quote"
    }
  });

  assert.equal(applyScope.allowFamilyChange, true);
  assert.equal(applyScope.familyChange.targetFamily, "quote");
  assert.equal(applyScope.scopeLabel, "Selected signals 2 body");
});
