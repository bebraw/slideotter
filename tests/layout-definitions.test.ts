import assert from "node:assert/strict";
import test from "node:test";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const layoutDrafts = require("../studio/server/services/layout-drafts.ts");
const layoutHandlers = require("../studio/server/layout-handlers.ts");
const layouts = require("../studio/server/services/layouts.ts");
const operations = require("../studio/server/services/operations.ts");
const slideDom = require("../studio/rendering/slide-dom.ts");
const documents = require("../studio/rendering/documents.ts");

type LayoutRegion = {
  area?: string;
  row?: number;
  rowSpan?: number;
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

test("empty layout treatment normalizes to the standard renderer treatment", () => {
  assert.equal(layouts._test.normalizeLayoutTreatment(""), "standard");

  const markup = slideDom.renderSlideMarkup({
    cards: [
      { id: "audience", title: "Audience", body: "Operators and maintainers" },
      { id: "tone", title: "Tone", body: "Direct and practical" },
      { id: "constraints", title: "Constraints", body: "Keep it short" }
    ],
    eyebrow: "Draft deck",
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
  assert.match(markup, /data-slide-layout="standard"/);

  assert.throws(
    () => slideDom.renderSlideMarkup({
      eyebrow: "Draft deck",
      layout: "default",
      summary: "Explain why the studio keeps source, preview, and PDF output together.",
      title: "slideotter",
      type: "cover"
    }),
    /slideSpec\.layout must be one of/,
    "Renderer should reject removed treatment aliases"
  );
});

test("standard content slides with sparse text use a simple one-column path", () => {
  const markup = slideDom.renderSlideMarkup({
    guardrails: [
      { id: "g1", title: "Fit", body: "Keep it short." },
      { id: "g2", title: "Flow", body: "Use one path." },
      { id: "g3", title: "Space", body: "Leave room." }
    ],
    guardrailsTitle: "Checks",
    layout: "standard",
    signals: [
      { id: "s1", title: "Claim", body: "One clear point." },
      { id: "s2", title: "Proof", body: "One proof cue." },
      { id: "s3", title: "Action", body: "One next step." }
    ],
    signalsTitle: "Path",
    summary: "Short support copy keeps the slide readable.",
    title: "Simple slide",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__content-columns--simple/);
});

test("standard content slides with dense text still use the simple one-column path", () => {
  const longBody = "This sentence intentionally carries enough words to make the slide dense.";
  const markup = slideDom.renderSlideMarkup({
    guardrails: [
      { id: "g1", title: "Decision fit", body: longBody },
      { id: "g2", title: "Operating flow", body: longBody },
      { id: "g3", title: "Audience need", body: longBody }
    ],
    guardrailsTitle: "Decision checks",
    layout: "standard",
    signals: [
      { id: "s1", title: "Claim clarity", body: longBody },
      { id: "s2", title: "Proof quality", body: longBody },
      { id: "s3", title: "Action path", body: longBody }
    ],
    signalsTitle: "Evidence path",
    summary: "Dense support copy should keep the balanced layout so parallel material still scans cleanly.",
    title: "Dense content slide",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__content-columns--simple/);
});

test("non-standard content slide layouts keep their specialized column path", () => {
  const markup = slideDom.renderSlideMarkup({
    guardrails: [
      { id: "g1", title: "Fit", body: "Check scope." },
      { id: "g2", title: "Flow", body: "Check order." },
      { id: "g3", title: "Space", body: "Check rhythm." }
    ],
    guardrailsTitle: "Checklist",
    layout: "checklist",
    signals: [
      { id: "s1", title: "Claim", body: "One claim." },
      { id: "s2", title: "Proof", body: "One proof." },
      { id: "s3", title: "Action", body: "One action." }
    ],
    signalsTitle: "Context",
    summary: "Checklist treatment keeps its own layout behavior.",
    title: "Checklist slide",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.doesNotMatch(markup, /dom-slide__content-columns--simple/);
});

test("bullet content slides render as plain bullets without support panels", () => {
  const markup = slideDom.renderSlideMarkup({
    guardrails: [
      { id: "g1", title: "Support", body: "This support copy stays in data only." },
      { id: "g2", title: "Review", body: "This support copy stays in data only." },
      { id: "g3", title: "Scope", body: "This support copy stays in data only." }
    ],
    guardrailsTitle: "Audience Guardrails",
    layout: "bullets",
    signals: [
      { id: "s1", title: "Repeat", body: "The event keeps the experience direct and relaxed." },
      { id: "s2", title: "Breaks", body: "Use breaks to compare practical patterns with peers." },
      { id: "s3", title: "Meet people", body: "Meet speakers and participants between sessions." }
    ],
    signalsTitle: "Signals",
    summary: "The event keeps the experience direct and relaxed.",
    title: "The Experience",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__content-bullets/);
  assert.doesNotMatch(markup, /class="[^"]*dom-panel/);
  assert.doesNotMatch(markup, /Audience Guardrails/);
  assert.doesNotMatch(markup, /<p data-edit-path="signals\.0\.body"[^>]*>The event keeps/);
});

test("statement content slides render a dominant claim with compact support", () => {
  const markup = slideDom.renderSlideMarkup({
    guardrails: [
      { id: "g1", title: "Support", body: "This support copy stays in data only." },
      { id: "g2", title: "Review", body: "This support copy stays in data only." },
      { id: "g3", title: "Scope", body: "This support copy stays in data only." }
    ],
    guardrailsTitle: "Audience Guardrails",
    layout: "statement",
    signals: [
      { id: "s1", title: "Repeat", body: "The event keeps the experience direct and relaxed." },
      { id: "s2", title: "Breaks", body: "Use breaks to compare practical patterns with peers." },
      { id: "s3", title: "Meet people", body: "Meet speakers and participants between sessions." }
    ],
    signalsTitle: "Signals",
    summary: "The event keeps the experience direct and relaxed.",
    title: "The Experience",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__content-statement/);
  assert.match(markup, /dom-slide__content-statement-claim/);
  assert.doesNotMatch(markup, /class="[^"]*dom-panel/);
  assert.doesNotMatch(markup, /Audience Guardrails/);
  assert.doesNotMatch(markup, /<p data-edit-path="signals\.0\.body"[^>]*>The event keeps/);
});

test("spotlight content slides render a large keyword with support points", () => {
  const markup = slideDom.renderSlideMarkup({
    guardrails: [
      { id: "g1", title: "Support", body: "This support copy stays in data only." },
      { id: "g2", title: "Review", body: "This support copy stays in data only." },
      { id: "g3", title: "Scope", body: "This support copy stays in data only." }
    ],
    guardrailsTitle: "Audience Guardrails",
    layout: "spotlight",
    signals: [
      { id: "s1", title: "Visible AI", body: "AI agents reshape frontend workflows." },
      { id: "s2", title: "Design", body: "Design futures and accessibility frame the discussion." },
      { id: "s3", title: "Development", body: "Simplicity and best practices ground the development track." }
    ],
    signalsTitle: "Signals",
    summary: "Themes cover design futures, accessibility, simplicity, best practices, and visible AI impact.",
    title: "Themes for 2026",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__content-spotlight/);
  assert.match(markup, /dom-slide__content-spotlight-kicker/);
  assert.match(markup, /Visible AI/);
  assert.doesNotMatch(markup, /class="[^"]*dom-panel/);
  assert.doesNotMatch(markup, /Audience Guardrails/);
});

test("image-split content slides render media beside compact copy", () => {
  const markup = slideDom.renderSlideMarkup({
    compositionIntent: {
      archetype: "image-split",
      focalPoint: "image and claim",
      rationale: "The image should carry the slide beside short support copy."
    },
    layout: "standard",
    media: {
      alt: "Diagram preview",
      id: "diagram-preview",
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC"
    },
    signals: [
      { id: "s1", title: "Visual", body: "The diagram shows the workflow at a glance." },
      { id: "s2", title: "Claim", body: "Short copy keeps attention on the image." },
      { id: "s3", title: "Action", body: "Use the visual as the explanation anchor." }
    ],
    signalsTitle: "Signals",
    summary: "A visual anchor with a short support claim.",
    title: "Diagram-led slide",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__content-image-split/);
  assert.match(markup, /dom-slide__content-image-split-media/);
  assert.match(markup, /Diagram preview/);
  assert.doesNotMatch(markup, /class="[^"]*dom-panel/);
});

test("presentation documents expose reviewed narration scripts and controls", () => {
  const slideSpec = {
    guardrails: [
      { id: "g1", title: "Fit", body: "Keep the claim bounded." },
      { id: "g2", title: "Scale", body: "Keep text presentation-sized." },
      { id: "g3", title: "Rhythm", body: "Keep support concise." }
    ],
    guardrailsTitle: "Checks",
    narration: {
      advance: "afterSpeech",
      durationSeconds: 16,
      script: "Introduce the claim and then advance to the supporting slide."
    },
    signals: [
      { id: "s1", title: "Claim", body: "One clear claim anchors the slide." },
      { id: "s2", title: "Support", body: "Short support keeps it readable." },
      { id: "s3", title: "Action", body: "The audience can follow quickly." }
    ],
    signalsTitle: "Signals",
    summary: "One claim with concise support.",
    title: "Narrated slide",
    type: "content"
  };
  const markup = documents.renderPresentationDocument({
    slides: [{
      id: "slide-01",
      index: 1,
      presentationX: 1,
      presentationY: 0,
      slideSpec
    }],
    title: "Narration coverage"
  });

  assert.match(markup, /data-narration-script="Introduce the claim/);
  assert.match(markup, /data-narration-advance="afterSpeech"/);
  assert.match(markup, /data-narration-action="toggle"/);
  assert.match(markup, /data-narration-body/);
  assert.match(markup, /data-narration-action="play"/);
  assert.match(markup, /data-narration-auto-advance checked/);
  assert.match(markup, /slideotter:narration-collapsed/);
  assert.match(markup, /SpeechSynthesisUtterance/);
});

test("slide spec validation accepts explicit composition intent and rejects unknown archetypes", () => {
  const slideSpecs = require("../studio/server/services/slide-specs/index.ts");

  assert.doesNotThrow(() => slideSpecs.validateSlideSpec({
    compositionIntent: {
      archetype: "statement",
      focalPoint: "claim",
      rationale: "The slide should foreground one claim."
    },
    guardrails: [
      { id: "g1", title: "Fit", body: "Keep the claim bounded." },
      { id: "g2", title: "Scale", body: "Keep text presentation-sized." },
      { id: "g3", title: "Rhythm", body: "Keep support concise." }
    ],
    guardrailsTitle: "Checks",
    signals: [
      { id: "s1", title: "Claim", body: "One clear claim anchors the slide." },
      { id: "s2", title: "Support", body: "Short support keeps it readable." },
      { id: "s3", title: "Action", body: "The audience can follow quickly." }
    ],
    signalsTitle: "Signals",
    summary: "One claim with concise support.",
    title: "Explicit intent",
    type: "content"
  }));

  assert.throws(
    () => slideSpecs.validateSlideSpec({
      compositionIntent: {
        archetype: "ornamental-grid",
        focalPoint: "decoration",
        rationale: "Unknown archetypes should not pass validation."
      },
      guardrails: [
        { id: "g1", title: "Fit", body: "Keep the claim bounded." },
        { id: "g2", title: "Scale", body: "Keep text presentation-sized." },
        { id: "g3", title: "Rhythm", body: "Keep support concise." }
      ],
      guardrailsTitle: "Checks",
      signals: [
        { id: "s1", title: "Claim", body: "One clear claim anchors the slide." },
        { id: "s2", title: "Support", body: "Short support keeps it readable." },
        { id: "s3", title: "Action", body: "The audience can follow quickly." }
      ],
      signalsTitle: "Signals",
      summary: "One claim with concise support.",
      title: "Unknown intent",
      type: "content"
    }),
    /compositionIntent\.archetype must be one of/
  );
});

test("slide spec validation accepts reviewable narration and rejects unsafe advance modes", () => {
  const slideSpecs = require("../studio/server/services/slide-specs/index.ts");

  assert.doesNotThrow(() => slideSpecs.validateSlideSpec({
    guardrails: [
      { id: "g1", title: "Fit", body: "Keep the claim bounded." },
      { id: "g2", title: "Scale", body: "Keep text presentation-sized." },
      { id: "g3", title: "Rhythm", body: "Keep support concise." }
    ],
    guardrailsTitle: "Checks",
    narration: {
      advance: "afterSpeech",
      durationSeconds: 18,
      script: "This slide introduces the claim, then gives the audience one concrete support point."
    },
    signals: [
      { id: "s1", title: "Claim", body: "One clear claim anchors the slide." },
      { id: "s2", title: "Support", body: "Short support keeps it readable." },
      { id: "s3", title: "Action", body: "The audience can follow quickly." }
    ],
    signalsTitle: "Signals",
    summary: "One claim with concise support.",
    title: "Narrated slide",
    type: "content"
  }));

  assert.throws(
    () => slideSpecs.validateSlideSpec({
      guardrails: [
        { id: "g1", title: "Fit", body: "Keep the claim bounded." },
        { id: "g2", title: "Scale", body: "Keep text presentation-sized." },
        { id: "g3", title: "Rhythm", body: "Keep support concise." }
      ],
      guardrailsTitle: "Checks",
      narration: {
        advance: "teleport",
        script: "Invalid advance mode should not pass."
      },
      signals: [
        { id: "s1", title: "Claim", body: "One clear claim anchors the slide." },
        { id: "s2", title: "Support", body: "Short support keeps it readable." },
        { id: "s3", title: "Action", body: "The audience can follow quickly." }
      ],
      signalsTitle: "Signals",
      summary: "One claim with concise support.",
      title: "Invalid narration",
      type: "content"
    }),
    /narration\.advance/
  );
});

test("explicit content layout definitions override bullet treatment", () => {
  const markup = slideDom.renderSlideMarkup({
    guardrails: [
      { id: "g1", title: "Support", body: "Keep the review bounded." },
      { id: "g2", title: "Review", body: "Check the preview before saving." },
      { id: "g3", title: "Scope", body: "Keep the layout scoped." }
    ],
    guardrailsTitle: "Support",
    layout: "bullets",
    layoutDefinition: layouts._test.normalizeLayoutDefinition({
      readingOrder: ["title", "summary", "signals"],
      regions: [
        { column: 1, columnSpan: 6, id: "title-region", row: 1, rowSpan: 2, slot: "title" },
        { column: 7, columnSpan: 6, id: "signals-region", row: 1, rowSpan: 4, slot: "signals" }
      ],
      slots: [
        { id: "title", role: "title" },
        { id: "summary", role: "summary" },
        { id: "signals", role: "signals" }
      ],
      type: "slotRegionLayout"
    }, ["content"]),
    signals: [
      { id: "s1", title: "Breaks", body: "Use breaks to compare practical patterns with peers." },
      { id: "s2", title: "Meet people", body: "Meet speakers and participants between sessions." },
      { id: "s3", title: "Format", body: "Keep the format easy to follow." }
    ],
    signalsTitle: "Signals",
    summary: "The event keeps the experience direct and relaxed.",
    title: "The Experience",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__custom-layout-grid/);
  assert.doesNotMatch(markup, /dom-slide__content-bullets/);
});

test("layout exchange preserves provenance compatibility and validation evidence", () => {
  const exported = layouts._test.createLayoutExchangeDocument({
    compatibility: {
      contentDensities: ["current-slide", "dense"],
      slideTypes: ["content"],
      themes: ["current", "contrast"]
    },
    id: "fixture-metadata-layout",
    name: "Fixture metadata layout",
    provenance: {
      source: "generated-candidate",
      workflow: "redo-layout"
    },
    supportedTypes: ["content"],
    treatment: "standard",
    validationEvidence: {
      currentSlideValidation: { ok: true },
      status: "passed"
    }
  });
  const imported = layouts._test.readLayoutFromExchangeDocument(exported);

  assert.deepEqual(imported.compatibility?.contentDensities, ["current-slide", "dense"]);
  assert.equal(imported.provenance?.source, "generated-candidate");
  assert.equal((imported.validationEvidence?.currentSlideValidation as { ok?: boolean } | undefined)?.ok, true);
});

test("layout save metadata distinguishes favorite-ready representative previews", () => {
  const body = {
    layoutPreview: {
      currentSlideValidation: { ok: true },
      mode: "multi-slide"
    },
    operation: "custom-layout"
  };
  const compatibility = layoutHandlers._test.createLayoutCompatibility(body, "content");
  const evidence = layoutHandlers._test.createLayoutEvidence(body);

  assert.deepEqual(compatibility.contentDensities, ["current-slide", "representative"]);
  assert.equal(compatibility.validationScope, "current-and-representative");
  assert.equal(evidence.favoriteReady, true);
  assert.deepEqual(evidence.previewEvidence, {
    currentSlide: true,
    representative: true
  });
});

test("saved slot-region layouts apply their reusable definition", () => {
  const slideSpec = {
    eyebrow: "Decision",
    guardrails: [{ id: "g1", title: "Guardrail", body: "Keep the decision bounded." }],
    guardrailsTitle: "Checks",
    layout: "standard",
    layoutDefinition: {
      regions: [{ column: 1, columnSpan: 12, row: 1, rowSpan: 2, slot: "title" }],
      slots: [{ id: "title", role: "title" }],
      type: "slotRegionLayout"
    },
    signals: [{ id: "s1", title: "Signal", body: "One signal carries the point." }],
    signalsTitle: "Signals",
    summary: "Support one decision and keep the next step clear.",
    title: "Decision slide",
    type: "content"
  };
  const layoutDefinition = operations._test.createGeneratedLayoutDefinition(slideSpec, slideSpec, {
    emphasis: "lead sidebar layout"
  });
  const applied = layouts._test.applyLayoutObjectToSlideSpec(slideSpec, {
    definition: layoutDefinition,
    id: "saved-slot-region-layout",
    name: "Saved slot region layout",
    supportedTypes: ["content"],
    treatment: "steps"
  });

  assert.equal(applied.layout, "steps");
  assert.equal(applied.layoutDefinition.type, "slotRegionLayout");
  assert.deepEqual(applied.layoutDefinition.readingOrder, layoutDefinition.readingOrder);

  const cleared = layouts._test.applyLayoutObjectToSlideSpec(applied, {
    id: "plain-standard-layout",
    name: "Plain standard layout",
    supportedTypes: ["content"],
    treatment: "standard"
  });

  assert.equal(cleared.layout, "standard");
  assert.equal("layoutDefinition" in cleared, false);
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
    layout: "standard",
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
  const contentDefinition = layoutDrafts.createCustomLayoutDraftDefinition({
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

  const coverDefinition = layoutDrafts.createCustomLayoutDraftDefinition({
    profile: "lead-support",
    slideType: "cover",
    spacing: "normal"
  });

  assert.equal(coverDefinition.type, "slotRegionLayout");
  assert.deepEqual(coverDefinition.readingOrder, ["title", "summary", "note", "cards"]);
  assert.ok(coverDefinition.regions.some((region: LayoutRegion) => region.slot === "cards"));
  assert.equal(coverDefinition.typography.note, "caption");

  assert.throws(() => layoutDrafts.createCustomLayoutDraftDefinition({
    minFontSize: 2,
    slideType: "content"
  }), /minFontSize must be an integer/);
});

test("lead-support content drafts reserve enough space for support panels", () => {
  const contentDefinition = layoutDrafts.createCustomLayoutDraftDefinition({
    profile: "lead-support",
    slideType: "content",
    spacing: "tight"
  });
  const supportRegions = contentDefinition.regions.filter((region: LayoutRegion) => region.slot === "signals" || region.slot === "guardrails");

  assert.deepEqual(supportRegions.map((region: LayoutRegion) => ({
    row: region.row,
    rowSpan: region.rowSpan,
    slot: region.slot
  })), [
    { row: 4, rowSpan: 5, slot: "signals" },
    { row: 4, rowSpan: 5, slot: "guardrails" }
  ]);
});

test("slot-region renderer annotates normalized grid positions for compatibility styles", () => {
  const markup = slideDom.renderSlideMarkup({
    guardrails: [{ id: "g1", title: "Fit", body: "Keep nearby content connected." }],
    guardrailsTitle: "Checks",
    layout: "steps",
    layoutDefinition: {
      constraints: { minFontSize: 18 },
      regions: [
        { column: 1, columnSpan: 6, id: "signals-region", row: 5, rowSpan: 3, slot: "signals", spacing: "tight" },
        { column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing: "tight" }
      ],
      type: "slotRegionLayout"
    },
    signals: [{ id: "s1", title: "Example", body: "One example carries the point." }],
    signalsTitle: "What to notice",
    summary: "One concise supporting point.",
    title: "Added Detail",
    type: "content"
  }, {
    index: 1,
    totalSlides: 1
  });

  assert.match(markup, /dom-slide__custom-layout-region--signals/);
  assert.match(markup, /dom-slide--custom-layout/);
  assert.match(markup, /data-region-row="5"/);
  assert.match(markup, /data-region-row-span="3"/);
});
