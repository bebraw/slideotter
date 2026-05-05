import assert from "node:assert/strict";
import * as fs from "node:fs";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  listPresentations,
  presentationRuntimeFile,
  presentationsRegistryFile,
  regeneratePresentationSlides,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  archiveStructuredSlide,
  getSlides,
  insertStructuredSlide,
  readSlideSpec,
  reorderActiveSlides
} = require("../studio/server/services/slides.ts");
const { getDeckContext } = require("../studio/server/services/state.ts");
const { getPresentationPaths } = require("../studio/server/services/presentations.ts");
const { readActiveDeckContext } = require("../studio/server/services/active-deck-context.ts");
const { removeAllowedPath } = require("../studio/server/services/write-boundary.ts");

type JsonRecord = Record<string, unknown>;
type CoveragePresentationFields = Record<string, unknown>;

type CoveragePresentation = JsonRecord & {
  id: string;
  slideCount?: number;
  targetSlideCount?: number;
  title?: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: CoveragePresentation[];
};

type CoverageSlideInfo = JsonRecord & {
  archived?: boolean;
  id: string;
  index: number;
  skipped?: boolean;
  title?: string;
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createCoveragePresentation(suffix: string, fields: CoveragePresentationFields = {}): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise high-risk filesystem-backed studio services.",
    title: `Coverage Risk ${Date.now()} ${suffix}`,
    ...fields
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function listCoveragePresentations(): PresentationRegistry {
  return listPresentations();
}

function cleanupCoveragePresentations(): void {
  const current = listCoveragePresentations();
  const knownIds = new Set(current.presentations.map((presentation: CoveragePresentation) => presentation.id));

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

  const afterCleanup = listCoveragePresentations();
  if (afterCleanup.presentations.some((presentation: CoveragePresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

function createContentSlideSpec(title: string, index = 2): JsonRecord {
  return {
    type: "content",
    index,
    title,
    eyebrow: "Coverage",
    summary: "A structured slide used to verify insert, archive, and variant behavior.",
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
  cleanupCoveragePresentations();
});

test("presentation lifecycle keeps registry, active deck, and copied files consistent", () => {
  const presentation = createCoveragePresentation("lifecycle", { targetSlideCount: 8 });
  const paths = getPresentationPaths(presentation.id);

  assert.ok(fs.existsSync(paths.rootDir), "created presentation should have a root directory");
  assert.equal(listPresentations().activePresentationId, presentation.id, "created presentation should become active");
  assert.equal(getSlides().length, 3, "new presentations should start with a three-slide scaffold");
  assert.equal(getDeckContext().deck.lengthProfile.targetCount, 8, "new presentations should persist the requested target slide count");
  assert.equal(
    listCoveragePresentations().presentations.find((entry: CoveragePresentation) => entry.id === presentation.id)?.targetSlideCount,
    8,
    "presentation summaries should expose the requested target slide count"
  );

  const duplicate = duplicatePresentation(presentation.id);
  createdPresentationIds.add(duplicate.id);
  const duplicatePaths = getPresentationPaths(duplicate.id);

  assert.equal(listPresentations().activePresentationId, duplicate.id, "duplicated presentation should become active");
  assert.ok(fs.existsSync(duplicatePaths.rootDir), "duplicate should copy presentation files");
  assert.equal(getSlides().length, 3, "duplicate should copy the slide scaffold");
  assert.equal(
    listCoveragePresentations().presentations.find((entry: CoveragePresentation) => entry.id === duplicate.id)?.title,
    duplicate.title,
    "duplicate should retitle the deck summary"
  );

  deletePresentation(duplicate.id);
  createdPresentationIds.delete(duplicate.id);
  assert.ok(
    !listCoveragePresentations().presentations.some((entry: CoveragePresentation) => entry.id === duplicate.id),
    "deleted duplicate should leave the registry"
  );
  assert.ok(!fs.existsSync(duplicatePaths.rootDir), "deleted duplicate should remove copied files");

  assert.throws(
    () => setActivePresentation("missing-presentation"),
    /Unknown presentation/,
    "selecting an unknown presentation should fail explicitly"
  );
});

test("regenerating presentation slides rejects invalid persisted slide shapes", () => {
  const presentation = createCoveragePresentation("regenerate-validation");
  const slideSpecs = getSlides().map((slide: CoverageSlideInfo) => readSlideSpec(slide.id, { presentationId: presentation.id }));
  const invalidContentSlide = createContentSlideSpec("Invalid regenerated slide", 2);

  invalidContentSlide.signals = [
    ...(invalidContentSlide.signals as JsonRecord[]),
    { id: "signal-four", label: "four", value: 0.5 }
  ];

  assert.throws(
    () => regeneratePresentationSlides(presentation.id, [
      slideSpecs[0],
      invalidContentSlide,
      slideSpecs[2]
    ]),
    /slideSpec\.signals must contain at most 3 items|slideSpec\.signals must contain 3 items/,
    "generated slide regeneration should reject four-item content stacks before writing them"
  );
});

test("active presentation selection writes runtime state without rewriting the registry", () => {
  const current = listCoveragePresentations();
  let target = current.presentations.find((presentation: CoveragePresentation) => presentation.id !== current.activePresentationId);

  if (!target) {
    target = createCoveragePresentation("runtime-selection");
  }

  const registryBefore = fs.readFileSync(presentationsRegistryFile, "utf8");
  setActivePresentation(target.id);
  const registryAfter = fs.readFileSync(presentationsRegistryFile, "utf8");
  const runtime = JSON.parse(fs.readFileSync(presentationRuntimeFile, "utf8"));

  assert.equal(registryAfter, registryBefore, "selecting a deck should not rewrite the tracked presentation registry");
  assert.equal(runtime.activePresentationId, target.id, "runtime state should carry the active deck selection");
});

test("active deck context returns the caller fallback when scoped JSON is unreadable", () => {
  const presentation = createCoveragePresentation("scoped-context-fallback");
  setActivePresentation(presentation.id);
  const paths = getPresentationPaths(presentation.id);
  const activeDeckContextFile = paths.deckContextFile;
  const activeDeckContextBackup = `${activeDeckContextFile}.coverage-backup`;

  fs.renameSync(activeDeckContextFile, activeDeckContextBackup);

  try {
    fs.writeFileSync(activeDeckContextFile, "{not-json", "utf8");
    assert.deepEqual(readActiveDeckContext({ fallback: true }), { fallback: true });
  } finally {
    removeAllowedPath(activeDeckContextFile, { force: true });
    fs.renameSync(activeDeckContextBackup, activeDeckContextFile);
  }
});

test("structured slide insert and archive preserve active order and hidden history", () => {
  createCoveragePresentation("slides");

  const created = insertStructuredSlide(createContentSlideSpec("Inserted coverage slide", 2), 2);
  const activeSlides = getSlides();

  assert.equal(created.id, "slide-04", "insert should allocate the next slide file instead of overwriting");
  assert.deepEqual(
    activeSlides.map((slide: CoverageSlideInfo) => `${slide.id}:${slide.index}`),
    ["slide-01:1", "slide-04:2", "slide-02:3", "slide-03:4"],
    "insert should move later active slides forward"
  );

  const removed = archiveStructuredSlide(created.id);
  const remainingSlides = getSlides();
  const archivedSlides = getSlides({ includeArchived: true });

  assert.equal(removed.id, created.id, "archive should report the removed active slide");
  assert.deepEqual(
    remainingSlides.map((slide: CoverageSlideInfo) => `${slide.id}:${slide.index}`),
    ["slide-01:1", "slide-02:2", "slide-03:3"],
    "archive should close the active slide index gap"
  );
  assert.equal(
    archivedSlides.find((slide: CoverageSlideInfo) => slide.id === created.id)?.archived,
    true,
    "archived slides should stay inspectable when requested"
  );

  const reordered = reorderActiveSlides(["slide-03", "slide-01", "slide-02"]);
  assert.deepEqual(
    reordered.map((slide: CoverageSlideInfo) => `${slide.id}:${slide.index}`),
    ["slide-03:1", "slide-01:2", "slide-02:3"],
    "manual reorder should persist the requested active slide order"
  );
  assert.throws(
    () => reorderActiveSlides(["slide-03", "slide-03", "slide-02"]),
    /every active slide exactly once|unknown or duplicate/,
    "manual reorder should reject duplicate or incomplete slide ids"
  );
});
