const assert = require("node:assert/strict");
const test = require("node:test");

const layouts = require("../studio/server/services/layouts.ts");
const operations = require("../studio/server/services/operations.ts");
const slideDom = require("../studio/client/preview/slide-dom.ts");

type LayoutRegion = {
  area?: string;
  slot: string;
};

type LayoutSlot = {
  id: string;
};

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

test("default layout treatment aliases normalize to the standard renderer treatment", () => {
  assert.equal(layouts._test.normalizeLayoutTreatment("default"), "standard");
  assert.equal(layouts._test.normalizeLayoutTreatment(" Default "), "standard");

  const markup = slideDom.renderSlideMarkup({
    cards: [
      { id: "audience", title: "Audience", body: "Operators and maintainers" },
      { id: "tone", title: "Tone", body: "Direct and practical" },
      { id: "constraints", title: "Constraints", body: "Keep it short" }
    ],
    eyebrow: "Draft deck",
    layout: "default",
    logo: "slideotter",
    note: "Prepared from the current deck constraints.",
    summary: "Explain why the studio keeps source, preview, and PDF output together.",
    title: "slideotter",
    type: "cover"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide--layout-standard/);
  assert.doesNotMatch(markup, /dom-slide--layout-default/);
  assert.match(markup, /data-slide-layout="standard"/);
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
  assert.ok(definition.slots.some((slot: LayoutSlot) => slot.id === "signals"));
  assert.ok(definition.regions.some((region: LayoutRegion) => region.slot === "guardrails"));
  assert.equal(definition.constraints.progressClearance, true);
});

test("custom layout authoring accepts complete content and cover slot-region definitions", () => {
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
  }, definition), /content and cover slides/);

  assert.throws(() => operations._test.validateCustomLayoutDefinitionForSlide(slideSpec, {
    ...definition,
    slots: definition.slots.filter((slot: LayoutSlot) => slot.id !== "guardrails")
  }), /guardrails slot|must reference a known slot/);

  const coverSlideSpec = {
    cards: [
      { id: "audience", title: "Audience", body: "Operators and maintainers" },
      { id: "tone", title: "Tone", body: "Direct and practical" }
    ],
    eyebrow: "Draft deck",
    logo: "slideotter",
    note: "Prepared from the current deck constraints.",
    summary: "Explain why the studio keeps source, preview, and PDF output together.",
    title: "slideotter",
    type: "cover"
  };
  const coverDefinition = {
    constraints: {
      captionAttached: true,
      maxLines: 6,
      minFontSize: 18,
      progressClearance: true
    },
    mediaTreatment: {
      fit: "contain",
      focalPoint: "center"
    },
    readingOrder: ["title", "summary", "note", "cards"],
    regions: [
      {
        align: "stretch",
        area: "lead",
        column: 1,
        columnSpan: 7,
        id: "title-region",
        row: 1,
        rowSpan: 3,
        slot: "title",
        spacing: "normal"
      },
      {
        align: "stretch",
        area: "lead",
        column: 1,
        columnSpan: 7,
        id: "summary-region",
        row: 4,
        rowSpan: 2,
        slot: "summary",
        spacing: "normal"
      },
      {
        align: "stretch",
        area: "lead",
        column: 1,
        columnSpan: 7,
        id: "note-region",
        row: 6,
        rowSpan: 2,
        slot: "note",
        spacing: "normal"
      },
      {
        align: "stretch",
        area: "sidebar",
        column: 8,
        columnSpan: 5,
        id: "cards-region",
        row: 1,
        rowSpan: 7,
        slot: "cards",
        spacing: "normal"
      }
    ],
    slots: [
      { id: "title", maxLines: 3, required: true, role: "title" },
      { id: "summary", maxLines: 3, required: true, role: "summary" },
      { id: "note", maxLines: 3, required: true, role: "caption" },
      { id: "cards", maxLines: 6, required: true, role: "body" }
    ],
    typography: {
      cards: "body",
      note: "caption",
      summary: "body",
      title: "title"
    },
    type: "slotRegionLayout"
  };

  const normalizedCover = operations._test.validateCustomLayoutDefinitionForSlide(coverSlideSpec, coverDefinition);
  assert.equal(normalizedCover.type, "slotRegionLayout");
  assert.deepEqual(normalizedCover.readingOrder, ["title", "summary", "note", "cards"]);

  assert.throws(() => operations._test.validateCustomLayoutDefinitionForSlide(coverSlideSpec, {
    ...coverDefinition,
    slots: coverDefinition.slots.filter((slot) => slot.id !== "cards")
  }), /cards slot|must reference a known slot/);

  assert.throws(() => operations._test.validateCustomLayoutDefinitionForSlide(slideSpec, coverDefinition), /signals slot/);
});

test("custom layout draft definitions are server-owned for content and cover slides", () => {
  const contentDefinition = layouts._test.createCustomLayoutDraftDefinition({
    minFontSize: 20,
    profile: "lead-sidebar",
    slideType: "content",
    spacing: "tight"
  });

  assert.equal(contentDefinition.type, "slotRegionLayout");
  assert.deepEqual(contentDefinition.readingOrder, ["title", "summary", "signals", "guardrails"]);
  assert.ok(contentDefinition.regions.some((region: LayoutRegion) => region.slot === "signals" && region.area === "sidebar"));
  assert.equal(contentDefinition.constraints.minFontSize, 20);
  assert.equal(contentDefinition.typography.title, "title");

  const coverDefinition = layouts._test.createCustomLayoutDraftDefinition({
    profile: "lead-support",
    slideType: "cover",
    spacing: "normal"
  });

  assert.equal(coverDefinition.type, "slotRegionLayout");
  assert.deepEqual(coverDefinition.readingOrder, ["title", "summary", "note", "cards"]);
  assert.ok(coverDefinition.regions.some((region: LayoutRegion) => region.slot === "cards"));
  assert.equal(coverDefinition.typography.note, "caption");

  assert.throws(() => layouts._test.createCustomLayoutDraftDefinition({
    minFontSize: 2,
    slideType: "content"
  }), /minFontSize must be an integer/);
});
