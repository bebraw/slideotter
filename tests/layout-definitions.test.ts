const assert = require("node:assert/strict");
const test = require("node:test");

const layouts = require("../studio/server/services/layouts.ts");
const operations = require("../studio/server/services/operations.ts");

test("slot-region layout definitions normalize constrained slots, regions, and validation metadata", () => {
  const definition = layouts._test.normalizeLayoutDefinition({
    constraints: {
      maxLines: 5,
      minFontSize: 20,
      progressClearance: true
    },
    mediaTreatment: {
      fit: "contain",
      focalPoint: "center"
    },
    readingOrder: ["title", "summary", "signals"],
    regions: [
      {
        align: "stretch",
        area: "lead",
        column: 1,
        columnSpan: 6,
        id: "title-region",
        row: 1,
        rowSpan: 2,
        slot: "title",
        spacing: "normal"
      },
      {
        align: "stretch",
        area: "support",
        column: 7,
        columnSpan: 6,
        id: "signals-region",
        row: 2,
        rowSpan: 3,
        slot: "signals",
        spacing: "tight"
      }
    ],
    slots: [
      {
        id: "title",
        maxLines: 2,
        required: true,
        role: "title"
      },
      {
        id: "summary",
        maxLines: 3,
        required: true,
        role: "summary"
      },
      {
        id: "signals",
        maxLines: 6,
        required: true,
        role: "signals"
      }
    ],
    typography: {
      signals: "metric",
      summary: "body",
      title: "title"
    },
    type: "slotRegionLayout"
  }, ["content"]);

  assert.equal(definition.type, "slotRegionLayout");
  assert.equal(definition.schemaVersion, 1);
  assert.deepEqual(definition.readingOrder, ["title", "summary", "signals"]);
  assert.equal(definition.slots.length, 3);
  assert.equal(definition.regions.length, 2);
  assert.equal(definition.constraints.minFontSize, 20);
  assert.equal(definition.typography.signals, "metric");
});

test("slot-region layout definitions reject unbounded or hidden renderer state", () => {
  assert.throws(() => layouts._test.normalizeLayoutDefinition({
    regions: [
      {
        area: "body",
        slot: "unknown"
      }
    ],
    slots: [
      {
        id: "title",
        role: "title"
      }
    ],
    type: "slotRegionLayout"
  }, ["content"]), /must reference a known slot/);

  assert.throws(() => layouts._test.normalizeLayoutDefinition({
    regions: [
      {
        area: "body",
        slot: "title"
      }
    ],
    slots: [
      {
        id: "title",
        role: "custom-css"
      }
    ],
    type: "slotRegionLayout"
  }, ["content"]), /slots\[0\]\.role must be one of/);
});

test("redo-layout can build a reusable slot-region definition for content slides", () => {
  const slideSpec = {
    eyebrow: "Decision",
    guardrails: [
      { id: "g1", label: "must-show", value: "1" },
      { id: "g2", label: "compare pass", value: "1" },
      { id: "g3", label: "apply once", value: "1" }
    ],
    guardrailsTitle: "Decision checks",
    layout: "focus",
    signals: [
      { id: "s1", label: "claim", value: 1 },
      { id: "s2", label: "proof", value: 2 },
      { id: "s3", label: "boundary", value: 3 },
      { id: "s4", label: "next step", value: 4 }
    ],
    signalsTitle: "Decision inputs",
    summary: "Support one decision and keep the next step clear.",
    title: "Decision slide",
    type: "content"
  };

  const definition = operations._test.createGeneratedLayoutDefinition(slideSpec, slideSpec, {
    emphasis: "focus the claim with supporting evidence"
  });

  assert.equal(definition.type, "slotRegionLayout");
  assert.ok(definition.slots.some((slot) => slot.id === "signals"));
  assert.ok(definition.regions.some((region) => region.slot === "guardrails"));
  assert.equal(definition.constraints.progressClearance, true);
});

test("custom layout authoring accepts only complete content slot-region definitions", () => {
  const slideSpec = {
    eyebrow: "Decision",
    guardrails: [
      { id: "g1", label: "must-show", value: "1" },
      { id: "g2", label: "compare pass", value: "1" },
      { id: "g3", label: "apply once", value: "1" }
    ],
    guardrailsTitle: "Decision checks",
    signals: [
      { id: "s1", label: "claim", value: 1 },
      { id: "s2", label: "proof", value: 2 },
      { id: "s3", label: "boundary", value: 3 },
      { id: "s4", label: "next step", value: 4 }
    ],
    signalsTitle: "Decision inputs",
    summary: "Support one decision and keep the next step clear.",
    title: "Decision slide",
    type: "content"
  };
  const definition = operations._test.createGeneratedLayoutDefinition(slideSpec, slideSpec, {
    emphasis: "balanced content layout"
  });

  const normalized = operations._test.validateCustomLayoutDefinitionForSlide(slideSpec, definition);
  assert.equal(normalized.type, "slotRegionLayout");

  assert.throws(() => operations._test.validateCustomLayoutDefinitionForSlide({
    title: "Break",
    type: "divider"
  }, definition), /content slides first/);

  assert.throws(() => operations._test.validateCustomLayoutDefinitionForSlide(slideSpec, {
    ...definition,
    slots: definition.slots.filter((slot) => slot.id !== "guardrails")
  }), /guardrails slot|must reference a known slot/);
});
