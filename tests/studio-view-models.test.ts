import assert from "node:assert/strict";
import test from "node:test";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const drawerToolModel = require("../studio/client/shell/drawer-tool-model.ts");
const slideActionModel = require("../studio/client/editor/slide-action-model.ts");
const manualSlideModel = require("../studio/client/editor/manual-slide-model.ts");
const currentSlideValidationModel = require("../studio/client/editor/current-slide-validation-model.ts");
const mediaControlModel = require("../studio/client/editor/media-control-model.ts");
const contentRunModel = require("../studio/client/creation/content-run-model.ts");
const creationDraftStatusModel = require("../studio/client/creation/creation-draft-status-model.ts");
const customLayoutPreviewModel = require("../studio/client/creation/custom-layout-preview-model.ts");
const customLayoutValidationModel = require("../studio/client/creation/custom-layout-validation-model.ts");
const creationStageModel = require("../studio/client/creation/creation-stage-model.ts");
const editableOutlineModel = require("../studio/client/creation/editable-outline-model.ts");
const sourceOutlineModel = require("../studio/client/creation/source-outline-model.ts");
const slideReorderModel = require("../studio/client/editor/slide-reorder-model.ts");
const variantComparisonModel = require("../studio/client/variants/variant-comparison-model.ts");
const outlinePlanViewModel = require("../studio/client/planning/outline-plan-view-model.ts");

test("drawer tool model exposes shortcut and mobile order from one source", () => {
  const tools = drawerToolModel.listDrawerTools();

  assert.deepEqual(
    tools.map((tool: { key: string }) => tool.key),
    ["outline", "context", "layout", "debug", "structuredDraft", "theme", "assistant"]
  );
  assert.deepEqual(drawerToolModel.listDrawerShortcutOrder(), tools.map((tool: { key: string }) => tool.key));
  assert.deepEqual(drawerToolModel.listMobileDrawerTools(), tools);
  assert.deepEqual(
    tools.map((tool: { shortcut: string }) => tool.shortcut),
    ["1", "2", "3", "4", "5", "6", "7"]
  );
  assert.deepEqual(
    drawerToolModel.listMobileDrawerTools().map((tool: { mobileLabel: string }) => tool.mobileLabel),
    ["Outline", "Context", "Layout", "Diagnostics", "Spec", "Theme", "Assistant"]
  );
});

test("current slide action model summarizes task availability without DOM state", () => {
  const withoutSlide = slideActionModel.buildCurrentSlideActions({
    customVisualCount: 0,
    materialCount: 0,
    selectedSlideId: null,
    variantCount: 0
  });
  assert.deepEqual(withoutSlide.map((action: { enabled: boolean }) => action.enabled), [false, false, false]);

  const withSlide = slideActionModel.buildCurrentSlideActions({
    customVisualCount: 1,
    materialCount: 2,
    selectedSlideId: "slide-3",
    variantCount: 3
  });
  assert.deepEqual(withSlide.map((action: { key: string }) => action.key), ["improve", "media", "visuals"]);
  assert.deepEqual(withSlide.map((action: { enabled: boolean }) => action.enabled), [true, true, true]);
  assert.deepEqual(
    withSlide.map((action: { summary: string }) => action.summary),
    ["3 candidates ready", "2 materials available", "1 visual available"]
  );
});

test("manual slide model labels two-dimensional deck positions", () => {
  const slides = [
    { id: "intro", index: 1, title: "Intro" },
    { id: "detail-a", index: 2, title: "Detail A" },
    { id: "main", index: 3, title: "Main" },
    { id: "extra", index: 4, title: "Extra" }
  ];
  const labels = manualSlideModel.buildSlideNavigationLabels(slides, {
    coreSlideIds: ["intro", "main"],
    detours: [{ parentId: "intro", slideIds: ["detail-a"] }],
    mode: "two-dimensional"
  });

  assert.deepEqual(Object.fromEntries(labels), {
    intro: { description: "Core slide", label: "1" },
    "detail-a": { description: "Subslide below 1", label: "1a" },
    main: { description: "Core slide", label: "2" },
    extra: { description: "Outside navigation", label: "4" }
  });
});

test("manual slide model formats add and delete references", () => {
  const slide = { id: "main", index: 3, title: "Main" };

  assert.deepEqual(manualSlideModel.buildManualDeckEditReference({
    detourChecked: false,
    selectedLabel: { description: "Core slide", label: "2" },
    selectedSlide: slide
  }), {
    deleteReference: "Ready to remove 3. Main.",
    systemReference: "New slides are inserted after 3. Main."
  });
  assert.deepEqual(manualSlideModel.buildManualDeckEditReference({
    detourChecked: true,
    selectedLabel: { description: "Subslide below 1", label: "1a" },
    selectedSlide: slide
  }), {
    deleteReference: "Ready to remove 3. Main.",
    systemReference: "New subslide will be added to the same stack as 1a."
  });
  assert.deepEqual(manualSlideModel.buildManualDeckEditReference({
    detourChecked: true,
    selectedLabel: null,
    selectedSlide: null
  }), {
    deleteReference: "Select a slide before removing.",
    systemReference: "Select a slide before adding."
  });
});

test("slide reorder model moves and labels deck positions", () => {
  assert.deepEqual(slideReorderModel.moveSlideId(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(slideReorderModel.moveSlideId(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(slideReorderModel.reorderSlideIds(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);

  const entries = slideReorderModel.buildSlideReorderEntries({
    context: {
      deck: {
        navigation: {
          coreSlideIds: ["a", "c"],
          detours: [{ parentId: "a", slideIds: ["b"] }],
          mode: "two-dimensional"
        }
      }
    },
    reorderSlideIds: ["b", "a", "c"],
    selectedSlideId: "a",
    slides: [
      { id: "a", index: 1, title: "Intro" },
      { id: "b", index: 2, title: "Detail" },
      { id: "c", index: 3, title: "Close" }
    ]
  });

  assert.deepEqual(entries.map((entry: { description: string; fileOrder: number; id: string; selected: boolean; titleLabel: string }) => ({
    description: entry.description,
    fileOrder: entry.fileOrder,
    id: entry.id,
    selected: entry.selected,
    titleLabel: entry.titleLabel
  })), [
    { description: "Subslide below 1", fileOrder: 1, id: "b", selected: false, titleLabel: "1a. Detail" },
    { description: "Core slide", fileOrder: 2, id: "a", selected: true, titleLabel: "1. Intro" },
    { description: "Core slide", fileOrder: 3, id: "c", selected: false, titleLabel: "2. Close" }
  ]);
});

test("current slide validation model formats compact status copy", () => {
  assert.equal(currentSlideValidationModel.validationLabel({ state: "looks-good" }), "Looks good");
  assert.equal(
    currentSlideValidationModel.validationDetail({ state: "looks-good" }),
    "Current-slide DOM validation passed for this media treatment."
  );
  assert.equal(currentSlideValidationModel.validationLabel({ state: "needs-attention" }), "Needs attention");
  assert.equal(
    currentSlideValidationModel.validationDetail({ issues: [{ rule: "media-spacing" }], state: "needs-attention" }),
    "1 warning found. Review media fit, caption spacing, or progress-area clearance."
  );
  assert.equal(currentSlideValidationModel.validationLabel({ state: "blocked" }), "Blocked");
  assert.equal(
    currentSlideValidationModel.validationDetail({ errors: [{ rule: "text-overflow" }, { rule: "media-bounds" }], state: "blocked" }),
    "2 blocking issues found on the current slide."
  );
  assert.equal(currentSlideValidationModel.validationLabel({}), "Draft unchecked");
});

test("custom layout validation model formats save-oriented status copy", () => {
  assert.equal(customLayoutValidationModel.customLayoutValidationLabel({ state: "looks-good" }), "Looks good");
  assert.equal(
    customLayoutValidationModel.customLayoutValidationDetail({ state: "looks-good" }),
    "Current-slide DOM validation passed for this preview."
  );
  assert.equal(customLayoutValidationModel.customLayoutValidationLabel({ state: "needs-attention" }), "Needs attention");
  assert.equal(
    customLayoutValidationModel.customLayoutValidationDetail({ issues: [{ rule: "spacing" }], state: "needs-attention" }),
    "1 warning found. You can continue, but review spacing and media before saving."
  );
  assert.equal(customLayoutValidationModel.customLayoutValidationLabel({ state: "blocked" }), "Blocked");
  assert.equal(
    customLayoutValidationModel.customLayoutValidationDetail({ errors: [{ rule: "bounds" }, { rule: "overflow" }], state: "blocked" }),
    "2 blocking issues found. Fix the layout before saving as a favorite."
  );
  assert.equal(customLayoutValidationModel.customLayoutValidationLabel({}), "Draft unchecked");
});

test("custom layout preview model derives preview specs without DOM state", () => {
  assert.equal(customLayoutPreviewModel.normalizeLayoutTreatment("DEFAULT"), "standard");
  assert.equal(customLayoutPreviewModel.normalizeLayoutTreatment(" editorial "), "editorial");
  assert.equal(customLayoutPreviewModel.parseOptionalLayoutDefinition("not json"), null);
  assert.deepEqual(customLayoutPreviewModel.parseOptionalLayoutDefinition("{\"type\":\"slotRegionLayout\"}"), {
    type: "slotRegionLayout"
  });
  assert.throws(
    () => customLayoutPreviewModel.parseRequiredJson("", "empty", "invalid"),
    /empty/
  );
  assert.throws(
    () => customLayoutPreviewModel.parseRequiredJson("{", "empty", "invalid"),
    /invalid/
  );

  assert.deepEqual(customLayoutPreviewModel.buildCustomLayoutPreviewSlideSpec({
    layout: "standard",
    title: "Selected",
    type: "content"
  }, "dense", { type: "slotRegionLayout" }), {
    layout: "dense",
    layoutDefinition: { type: "slotRegionLayout" },
    title: "Selected",
    type: "content"
  });
  assert.deepEqual(customLayoutPreviewModel.buildCustomLayoutPreviewSlideSpec({
    layout: "standard",
    title: "Selected",
    type: "content"
  }, "", { type: "slotRegionLayout" }, { includeLayoutDefinition: false }), {
    layout: "standard",
    title: "Selected",
    type: "content"
  });
  assert.equal(customLayoutPreviewModel.buildCustomLayoutPreviewSlideSpec({ type: "photoGrid" }, "dense", null), null);
  assert.equal(customLayoutPreviewModel.shouldUseCustomLayoutLivePreview({
    definitionPreviewActive: false,
    drawerOpen: true,
    mainPreviewActive: true,
    selectedSlideSupported: true,
    slidePresent: true
  }), true);
  assert.equal(customLayoutPreviewModel.shouldUseCustomLayoutLivePreview({
    definitionPreviewActive: true,
    drawerOpen: true,
    mainPreviewActive: false,
    selectedSlideSupported: true,
    slidePresent: true
  }), false);
});

test("media control model derives button state without DOM state", () => {
  assert.equal(mediaControlModel.normalizeMediaFocalPoint("TOP-LEFT"), "top-left");
  assert.equal(mediaControlModel.normalizeMediaFocalPoint("outside"), "center");

  assert.deepEqual(mediaControlModel.buildMediaControlState({
    selectedMaterialId: "",
    selectedMedia: null,
    selectedSlideId: null
  }), {
    detachDisabled: true,
    fillDisabled: true,
    fitDisabled: true,
    focalPointDisabled: true,
    focalPointValue: "center",
    hasMedia: false,
    recenterDisabled: true
  });

  assert.deepEqual(mediaControlModel.buildMediaControlState({
    selectedMaterialId: "material-1",
    selectedMedia: { fit: "cover", focalPoint: "bottom-right" },
    selectedSlideId: "slide-1"
  }), {
    detachDisabled: false,
    fillDisabled: true,
    fitDisabled: false,
    focalPointDisabled: false,
    focalPointValue: "bottom-right",
    hasMedia: true,
    recenterDisabled: false
  });
});

test("content run model summarizes progressive generation state", () => {
  const run = {
    slides: [
      { status: "complete" },
      { status: "generating" },
      { error: "The provider returned invalid JSON after retry with an overlong diagnostic payload.", status: "failed" }
    ],
    status: "running"
  };
  const slides = contentRunModel.runSlides(run);

  assert.equal(contentRunModel.getAutoContentRunSlideIndex(run), 2);
  assert.equal(
    contentRunModel.formatContentRunSummary(run, 4, slides),
    "1/4 slides complete. Generating. Slide 2 is generating. 1 failed. Slide 3 failed: The provider returned invalid JSON after retry with an overlong diagnostic payload."
  );
});

test("content run model derives action and preview state", () => {
  const deckPlan = {
    slides: [
      { intent: "Open", keyMessage: "Start here", title: "Intro" },
      { intent: "Explain", keyMessage: "Show proof", sourceNeed: "Use sources", title: "Proof" }
    ]
  };
  const run = {
    completed: 1,
    slideCount: 2,
    slides: [
      { slideSpec: { title: "Intro", type: "cover" }, status: "complete" },
      { error: "Provider failed", status: "failed" }
    ],
    status: "failed"
  };

  assert.equal(contentRunModel.shouldShowContentRunNavStatus(deckPlan, run), true);
  assert.deepEqual(contentRunModel.getContentRunActionState(deckPlan, run), {
    completedCount: 1,
    failedIndex: 1,
    incompleteCount: 1,
    run,
    runSlides: run.slides,
    slideCount: 2
  });

  const preview = contentRunModel.getContentRunPreviewState(deckPlan, run, 99);
  assert.equal(preview.selected, 2);
  assert.equal(preview.status, "failed");
  assert.equal(preview.statusLabel, "Failed");
  assert.equal(preview.planSlide.title, "Proof");
  assert.equal(preview.runSlide.error, "Provider failed");
});

test("creation draft status model formats generation workflow states", () => {
  assert.equal(creationDraftStatusModel.formatCreationDraftStatus({
    approved: false,
    contentRun: null,
    hasOutline: false,
    outlineDirty: false,
    unlockedOutlineCount: 0,
    workflowRunning: true
  }), "Generation is running from a locked snapshot. Wait for it to finish before changing the draft.");

  assert.equal(creationDraftStatusModel.formatCreationDraftStatus({
    approved: false,
    contentRun: {
      failedSlideIndex: 1,
      slides: [
        { status: "complete" },
        { error: "The slide failed because a generated image reference could not be resolved from the current material set.", status: "failed" }
      ],
      status: "failed"
    },
    hasOutline: true,
    outlineDirty: false,
    unlockedOutlineCount: 2,
    workflowRunning: false
  }), "Slide generation failed on slide 2. The slide failed because a generated image reference could not be resolved from the current material set. Retry from the failed slide in Studio or inspect the saved error log.");

  assert.equal(creationDraftStatusModel.formatCreationDraftStatus({
    approved: false,
    contentRun: { status: "stopped" },
    hasOutline: true,
    outlineDirty: false,
    unlockedOutlineCount: 2,
    workflowRunning: false
  }), "Slide generation stopped. Completed slides remain available in Slide Studio.");

  assert.equal(creationDraftStatusModel.formatCreationDraftStatus({
    approved: false,
    contentRun: null,
    hasOutline: true,
    outlineDirty: true,
    unlockedOutlineCount: 2,
    workflowRunning: false
  }), "Brief changed. Regenerate the outline before approving it.");

  assert.equal(creationDraftStatusModel.formatCreationDraftStatus({
    approved: false,
    contentRun: null,
    hasOutline: true,
    outlineDirty: false,
    unlockedOutlineCount: 0,
    workflowRunning: false
  }), "All outline slides are kept. Unlock a slide before regenerating the outline.");

  assert.equal(creationDraftStatusModel.formatCreationDraftStatus({
    approved: true,
    contentRun: null,
    hasOutline: true,
    outlineDirty: false,
    unlockedOutlineCount: 2,
    workflowRunning: false
  }), "Outline approved. Slide Studio will show generated slides as they validate.");

  assert.equal(creationDraftStatusModel.formatCreationDraftStatus({
    approved: false,
    contentRun: null,
    hasOutline: false,
    outlineDirty: false,
    unlockedOutlineCount: 0,
    workflowRunning: false
  }), "Draft is saved locally as ignored runtime state.");
});

test("creation stage model gates outline and content stages", () => {
  assert.equal(creationStageModel.normalizeCreationStage("sources"), "structure");
  assert.equal(creationStageModel.normalizeCreationStage("unknown"), "brief");
  assert.deepEqual(creationStageModel.getCreationStageAccess("brief", {
    hasOutline: true
  }), {
    enabled: true,
    state: "complete"
  });
  assert.deepEqual(creationStageModel.getCreationStageAccess("structure", {
    hasOutline: false
  }), {
    enabled: false,
    state: "locked"
  });
  assert.deepEqual(creationStageModel.getCreationStageAccess("content", {
    approved: true,
    hasOutline: true,
    outlineDirty: false
  }), {
    enabled: true,
    state: "available"
  });
  assert.deepEqual(creationStageModel.getCreationStageAccess("content", {
    approved: true,
    hasOutline: true,
    outlineDirty: true
  }), {
    enabled: false,
    state: "locked"
  });
});

test("editable outline model clones and formats approved deck plans", () => {
  const deckPlan = {
    thesis: "One clear point",
    slides: [
      { title: "Setup", keyMessage: "Name the problem" },
      { title: "Proof", intent: "Show the evidence" },
      { intent: "Close with the operating action" }
    ]
  };

  const cloned = editableOutlineModel.cloneDeckPlan(deckPlan);
  assert.notEqual(cloned, deckPlan);
  assert.notEqual(cloned.slides[0], deckPlan.slides[0]);
  assert.deepEqual(
    editableOutlineModel.buildEditableDeckPlanOutline(cloned.slides),
    [
      "1. Setup - Name the problem",
      "2. Proof - Show the evidence",
      "3. Slide 3 - Close with the operating action"
    ].join("\n")
  );

  const clonedFirstSlide = cloned.slides[0];
  const sourceFirstSlide = deckPlan.slides[0];
  assert.ok(clonedFirstSlide && sourceFirstSlide);
  clonedFirstSlide.title = "Changed";
  assert.equal(sourceFirstSlide.title, "Setup", "editing a clone should not mutate the source deck plan");
});

test("editable outline model normalizes slide locks before counting unlocked slides", () => {
  const deckPlan = editableOutlineModel.asDeckPlan({
    slides: [
      { title: "One" },
      { title: "Two" },
      null,
      { title: "Three" }
    ]
  });

  assert.deepEqual(editableOutlineModel.normalizeOutlineLocks({
    "0": true,
    "1": false,
    second: true
  }), {
    "0": true
  });
  assert.deepEqual(editableOutlineModel.updateOutlineLocks({ "0": true }, 2, true), {
    "0": true,
    "2": true
  });
  assert.deepEqual(editableOutlineModel.updateOutlineLocks({ "0": true, "2": true }, 0, false), {
    "2": true
  });
  assert.equal(editableOutlineModel.countUnlockedOutlineSlides(deckPlan, { "1": true }), 2);
});

test("source outline model prefers notes before source need fallback", () => {
  assert.equal(sourceOutlineModel.formatSourceOutlineText(null), "No source guidance yet.");
  assert.equal(sourceOutlineModel.formatSourceOutlineText({ sourceNeed: "Use interview notes." }), "Use interview notes.");
  assert.equal(sourceOutlineModel.formatSourceOutlineText({
    sourceNeed: "Use interview notes.",
    sourceNotes: "Quote the maintainer notes."
  }), "Quote the maintainer notes.");
  assert.equal(sourceOutlineModel.formatSourceOutlineText({
    sourceText: "Legacy source text"
  }), "Legacy source text");
});

test("variant comparison model summarizes structured and source changes", () => {
  const currentSpec = {
    summary: "A short setup.",
    title: "Original",
    type: "summary",
    bullets: [{ title: "One", body: "Keep this concise." }],
    resources: []
  };
  const variantSpec = {
    summary: "A longer setup with more context.",
    title: "Revised",
    type: "summary",
    bullets: [{ title: "One", body: "Keep this concise and add the proof point." }],
    resources: []
  };

  const structuredComparison = variantComparisonModel.buildStructuredComparison(currentSpec, variantSpec);
  assert.equal(structuredComparison.totalChanges, 3);
  assert.deepEqual(structuredComparison.groups, ["framing", "bullets"]);

  const diff = variantComparisonModel.summarizeDiff("one\ntwo", "one\nthree\nfour");
  assert.deepEqual(diff, {
    added: 1,
    changed: 1,
    highlights: [
      { after: "three", before: "two", line: 2 },
      { after: "four", before: "(no line)", line: 3 }
    ],
    removed: 0
  });

  const sourceRows = variantComparisonModel.buildSourceDiffRows("one\ntwo", "one\nthree\nfour");
  assert.deepEqual(sourceRows.map((row: { changed: boolean; line: number }) => ({ changed: row.changed, line: row.line })), [
    { changed: false, line: 1 },
    { changed: true, line: 2 },
    { changed: true, line: 3 }
  ]);

  const decisionSupport = variantComparisonModel.buildVariantDecisionSupport(currentSpec, variantSpec, structuredComparison, diff);
  assert.equal(decisionSupport.scale, "Medium");
  assert.deepEqual(decisionSupport.focusItems.map((item: { label: string }) => item.label), ["Framing", "Bullets"]);
  assert.ok(decisionSupport.cues.some((cue: string) => cue.includes("Check changed areas")));
});

test("outline plan view model summarizes cards and comparison rows", () => {
  const plan = {
    name: "Reusable story",
    purpose: "Derive a focused deck",
    sections: [
      {
        intent: "Frame the issue",
        title: "Open",
        slides: [
          {
            intent: "Explain the goal",
            layoutHint: "cover",
            mustInclude: ["Goal", "Audience"],
            sourceSlideId: "slide-1",
            workingTitle: "Goal"
          }
        ]
      },
      {
        title: "Close",
        slides: []
      }
    ]
  };
  const currentSlides = [
    { id: "slide-1", index: 1, title: "Current goal" }
  ];

  assert.equal(outlinePlanViewModel.countOutlinePlanSlides(plan), 1);
  assert.deepEqual(outlinePlanViewModel.buildOutlinePlanCardSummary(plan), {
    purpose: "Derive a focused deck",
    sectionCount: 2,
    slideCount: 1,
    statsText: "2 sections | 1 slide intent",
    title: "Reusable story"
  });

  const comparison = outlinePlanViewModel.buildOutlinePlanComparison(plan, currentSlides);
  assert.equal(comparison.currentSequence, "1. Current goal");
  assert.equal(comparison.sections[0].slides[0].currentTitle, "1. Current goal");
  assert.equal(comparison.sections[0].slides[0].mustInclude, "Goal / Audience");
  assert.equal(comparison.sections[1].intent, "No section intent saved.");
});
