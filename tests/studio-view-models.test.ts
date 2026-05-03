const assert = require("node:assert/strict");
const test = require("node:test");

const drawerToolModel = require("../studio/client/drawer-tool-model.ts");
const slideActionModel = require("../studio/client/slide-action-model.ts");

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
