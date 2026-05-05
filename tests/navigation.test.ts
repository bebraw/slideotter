import assert from "node:assert/strict";
import * as fs from "node:fs";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  createPresentation,
  deletePresentation,
  getPresentationPaths,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  getSlides,
  insertStructuredSlide,
  readSlideSpec
} = require("../studio/server/services/slides.ts");
const { validateSlideSpec } = require("../studio/server/services/slide-specs/index.ts");
const {
  addCoreSlideToNavigation,
  addDetourSlideToNavigation,
  normalizeDeckNavigation,
  orderSlidesForNavigation,
  removeSlideFromNavigation,
  validateDeckNavigation
} = require("../studio/server/services/navigation.ts");

type JsonRecord = Record<string, unknown>;

type NavigationSlide = JsonRecord & {
  id: string;
  index: number;
  x: number;
  y: number;
};

type TestPresentation = JsonRecord & {
  id: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: TestPresentation[];
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createNavigationPresentation(suffix: string): TestPresentation {
  const presentation = createPresentation({
    audience: "Navigation validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise two-dimensional deck navigation behavior.",
    title: `Navigation Coverage ${Date.now()} ${suffix}`
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function listNavigationPresentations(): PresentationRegistry {
  return listPresentations();
}

function cleanupNavigationPresentations(): void {
  const current = listNavigationPresentations();
  const knownIds = new Set(current.presentations.map((presentation: TestPresentation) => presentation.id));

  for (const id of createdPresentationIds) {
    if (!knownIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch (error) {
      // Keep cleanup best-effort so the original assertion failure remains visible.
    }
  }

  const afterCleanup = listNavigationPresentations();
  if (afterCleanup.presentations.some((presentation: TestPresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

function createContentSlideSpec(title: string, index = 2): JsonRecord {
  return {
    type: "content",
    index,
    title,
    eyebrow: "Coverage",
    summary: "A structured slide used to verify two-dimensional navigation behavior.",
    signalsTitle: "Signals",
    guardrailsTitle: "Guardrails",
    signals: [
      { id: "signal-one", label: "one", value: 0.8 },
      { id: "signal-two", label: "two", value: 0.7 },
      { id: "signal-three", label: "three", value: 0.6 }
    ],
    guardrails: [
      { id: "guardrail-one", label: "one", value: "1" },
      { id: "guardrail-two", label: "two", value: "1" },
      { id: "guardrail-three", label: "three", value: "1" }
    ]
  };
}

test.after(() => {
  cleanupNavigationPresentations();
});

test("two-dimensional navigation keeps linear decks compatible and validates detours", () => {
  createNavigationPresentation("navigation");

  insertStructuredSlide(createContentSlideSpec("Implementation detail slide", 4), 4);
  insertStructuredSlide(createContentSlideSpec("Technical appendix slide", 5), 5);
  const allSlides = getSlides({ includeSkipped: true });
  const navigation = normalizeDeckNavigation({
    coreSlideIds: ["slide-01", "slide-02", "slide-03"],
    detours: [
      {
        label: "Implementation detail",
        parentId: "slide-02",
        slideIds: ["slide-04", "slide-05"]
      }
    ],
    mode: "two-dimensional"
  }, allSlides);

  assert.deepEqual(
    orderSlidesForNavigation(allSlides, navigation).map((slide: NavigationSlide) => `${slide.id}:${slide.x},${slide.y}`),
    ["slide-01:1,0", "slide-02:2,0", "slide-03:3,0"],
    "default navigation order should stay on the core path"
  );
  assert.deepEqual(
    orderSlidesForNavigation(allSlides, navigation, { includeDetours: true })
      .map((slide: NavigationSlide) => `${slide.id}:${slide.x},${slide.y}`),
    ["slide-01:1,0", "slide-02:2,0", "slide-04:2,1", "slide-05:2,2", "slide-03:3,0"],
    "full presentation navigation should attach detours below their parent core slide"
  );
  assert.equal(validateDeckNavigation(navigation, allSlides).ok, true, "valid detour stacks should pass structure validation");

  const invalid = validateDeckNavigation({
    coreSlideIds: ["slide-01", "missing-slide"],
    detours: [
      {
        parentId: "slide-01",
        slideIds: ["slide-01", "also-missing"]
      }
    ],
    mode: "two-dimensional"
  }, allSlides);

  assert.equal(invalid.ok, false, "broken navigation references should fail validation");
  assert.ok(
    invalid.issues.some((issue: JsonRecord) => /unknown slide missing-slide/.test(String(issue.message || ""))),
    "validation should report missing core slides"
  );
  assert.ok(
    invalid.issues.some((issue: JsonRecord) => /cannot also be its parent/.test(String(issue.message || ""))),
    "validation should report self-parented detours"
  );

  const withCore = addCoreSlideToNavigation(navigation, allSlides, "slide-05", "slide-02");
  assert.deepEqual(
    withCore.coreSlideIds,
    ["slide-01", "slide-02", "slide-05", "slide-03"],
    "normal manual slides should be insertable into the core path"
  );
  assert.equal(
    withCore.detours.some((detour: JsonRecord) => Array.isArray(detour.slideIds) && detour.slideIds.includes("slide-05")),
    false,
    "promoting a slide into the core path should remove it from detours"
  );

  const withDetour = addDetourSlideToNavigation(withCore, allSlides, "slide-02", "slide-05", "Technical appendix");
  assert.deepEqual(
    withDetour.coreSlideIds,
    ["slide-01", "slide-02", "slide-03"],
    "detour slides should leave the core path"
  );
  assert.deepEqual(
    withDetour.detours.find((detour: JsonRecord) => detour.parentId === "slide-02")?.slideIds,
    ["slide-04", "slide-05"],
    "detour slides should append to their parent stack"
  );

  const removed = removeSlideFromNavigation(withDetour, allSlides, "slide-04");
  assert.deepEqual(
    removed.detours.find((detour: JsonRecord) => detour.parentId === "slide-02")?.slideIds,
    ["slide-05"],
    "removing a slide should clean detour references"
  );
});

test("sample two-dimensional demo keeps core path and detours wired", () => {
  const paths = getPresentationPaths("two-dimensional-demo");
  const context = JSON.parse(fs.readFileSync(paths.deckContextFile, "utf8"));
  const allSlides = getSlides({ includeSkipped: true, presentationId: "two-dimensional-demo" });
  const navigation = normalizeDeckNavigation(context.deck.navigation, allSlides);

  assert.equal(validateDeckNavigation(context.deck.navigation, allSlides).ok, true, "sample 2D deck navigation should validate");
  assert.deepEqual(
    orderSlidesForNavigation(allSlides, navigation).map((slide: NavigationSlide) => `${slide.id}:${slide.x},${slide.y}`),
    ["slide-01:1,0", "slide-02:2,0", "slide-03:3,0", "slide-04:4,0"],
    "sample 2D deck core path should stay concise"
  );
  assert.deepEqual(
    orderSlidesForNavigation(allSlides, navigation, { includeDetours: true })
      .map((slide: NavigationSlide) => `${slide.id}:${slide.x},${slide.y}`),
    ["slide-01:1,0", "slide-02:2,0", "slide-05:2,1", "slide-03:3,0", "slide-06:3,1", "slide-04:4,0"],
    "sample 2D deck should attach vertical detours beneath slides 2 and 3"
  );
});

test("sample two-dimensional demo uses canonical slide specs", () => {
  const allSlides = getSlides({ includeSkipped: true, presentationId: "two-dimensional-demo" });
  allSlides.forEach((slide: NavigationSlide) => {
    assert.doesNotThrow(
      () => validateSlideSpec(readSlideSpec(slide.id, { presentationId: "two-dimensional-demo" })),
      `sample 2D slide ${slide.id} should validate as a canonical slide spec`
    );
  });
});
