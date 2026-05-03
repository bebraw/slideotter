import assert from "node:assert/strict";
import test from "node:test";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const drawerToolModel = require("../studio/client/shell/drawer-tool-model.ts");
const slideActionModel = require("../studio/client/editor/slide-action-model.ts");
const manualSlideModel = require("../studio/client/editor/manual-slide-model.ts");
const contentRunModel = require("../studio/client/creation/content-run-model.ts");

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
