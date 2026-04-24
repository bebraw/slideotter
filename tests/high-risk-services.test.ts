const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  archiveStructuredSlide,
  getSlides,
  insertStructuredSlide,
  readSlideSpec
} = require("../studio/server/services/slides.ts");
const {
  applyDeckLengthPlan,
  planDeckLength,
  restoreSkippedSlides
} = require("../studio/server/services/deck-length.ts");
const { getDeckContext } = require("../studio/server/services/state.ts");
const {
  createMaterialFromDataUrl,
  getMaterial,
  getMaterialFilePath,
  listMaterials
} = require("../studio/server/services/materials.ts");
const {
  applyVariant,
  captureVariant,
  getVariantStorageStatus,
  listVariantsForSlide,
  updateVariant
} = require("../studio/server/services/variants.ts");
const {
  assertAllowedWriteTarget,
  copyAllowedFile,
  ensureAllowedDir,
  removeAllowedPath,
  writeAllowedBinary,
  writeAllowedJson
} = require("../studio/server/services/write-boundary.ts");
const { getPresentationPaths } = require("../studio/server/services/presentations.ts");

const createdPresentationIds = new Set();
const originalActivePresentationId = listPresentations().activePresentationId;
const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC";

function createCoveragePresentation(suffix, fields: any = {}) {
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

function cleanupCoveragePresentations() {
  const current = listPresentations();
  const knownIds = new Set(current.presentations.map((presentation) => presentation.id));

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

  const afterCleanup = listPresentations();
  if (afterCleanup.presentations.some((presentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

function createContentSlideSpec(title, index = 2) {
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
      { id: "signal-three", label: "three", value: 0.6 },
      { id: "signal-four", label: "four", value: 0.5 }
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
    listPresentations().presentations.find((entry) => entry.id === presentation.id)?.targetSlideCount,
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
    listPresentations().presentations.find((entry) => entry.id === duplicate.id)?.title,
    duplicate.title,
    "duplicate should retitle the deck summary"
  );

  deletePresentation(duplicate.id);
  createdPresentationIds.delete(duplicate.id);
  assert.ok(
    !listPresentations().presentations.some((entry) => entry.id === duplicate.id),
    "deleted duplicate should leave the registry"
  );
  assert.ok(!fs.existsSync(duplicatePaths.rootDir), "deleted duplicate should remove copied files");

  assert.throws(
    () => setActivePresentation("missing-presentation"),
    /Unknown presentation/,
    "selecting an unknown presentation should fail explicitly"
  );
});

test("structured slide insert and archive preserve active order and hidden history", () => {
  createCoveragePresentation("slides");

  const created = insertStructuredSlide(createContentSlideSpec("Inserted coverage slide", 2), 2);
  const activeSlides = getSlides();

  assert.equal(created.id, "slide-04", "insert should allocate the next slide file instead of overwriting");
  assert.deepEqual(
    activeSlides.map((slide) => `${slide.id}:${slide.index}`),
    ["slide-01:1", "slide-04:2", "slide-02:3", "slide-03:4"],
    "insert should move later active slides forward"
  );

  const removed = archiveStructuredSlide(created.id);
  const remainingSlides = getSlides();
  const archivedSlides = getSlides({ includeArchived: true });

  assert.equal(removed.id, created.id, "archive should report the removed active slide");
  assert.deepEqual(
    remainingSlides.map((slide) => `${slide.id}:${slide.index}`),
    ["slide-01:1", "slide-02:2", "slide-03:3"],
    "archive should close the active slide index gap"
  );
  assert.equal(
    archivedSlides.find((slide) => slide.id === created.id)?.archived,
    true,
    "archived slides should stay inspectable when requested"
  );
});

test("deck length scaling marks slides as skipped and restores them without losing files", () => {
  createCoveragePresentation("deck-length");

  insertStructuredSlide(createContentSlideSpec("Implementation detail slide", 4), 4);
  insertStructuredSlide(createContentSlideSpec("Technical appendix slide", 5), 5);
  insertStructuredSlide(createContentSlideSpec("Reference material slide", 6), 6);

  assert.equal(getSlides().length, 6, "fixture should start with six active slides");

  const plan = planDeckLength({ mode: "appendix-first", targetCount: 4 });
  const skipActions = plan.actions.filter((action) => action.action === "skip");

  assert.equal(plan.currentCount, 6, "planning should describe the active deck length");
  assert.equal(plan.nextCount, 4, "planning should converge on the requested shorter length");
  assert.equal(skipActions.length, 2, "shortening should propose skips instead of deletion");

  const shortened = applyDeckLengthPlan({
    actions: plan.actions,
    mode: plan.mode,
    targetCount: plan.targetCount
  });
  const skippedSlideIds = getSlides({ includeSkipped: true })
    .filter((slide) => slide.skipped)
    .map((slide) => slide.id);

  assert.equal(shortened.lengthProfile.activeCount, 4, "applying a shorter plan should reduce only the active slide count");
  assert.equal(shortened.lengthProfile.skippedCount, 2, "skipped slides should be counted in the length profile");
  assert.equal(getSlides().length, 4, "default slide listing should hide skipped slides");
  assert.equal(getSlides({ includeSkipped: true }).length, 6, "skipped slides should remain inspectable");
  assert.equal(skippedSlideIds.length, 2, "skipped slides should be marked on their slide specs");
  skippedSlideIds.forEach((slideId) => {
    const slideSpec = readSlideSpec(slideId);
    assert.equal(slideSpec.skipped, true, "skipped specs should persist the skipped marker");
    assert.equal(slideSpec.skipMeta.operation, "scale-deck-length", "skipped specs should record their source operation");
  });

  const restorePlan = planDeckLength({ targetCount: 6 });
  assert.equal(
    restorePlan.actions.filter((action) => action.action === "restore").length,
    2,
    "lengthening should propose restoring previously skipped slides first"
  );

  const restoredByPlan = applyDeckLengthPlan({
    actions: restorePlan.actions,
    targetCount: restorePlan.targetCount
  });
  assert.equal(restoredByPlan.lengthProfile.activeCount, 6, "restore actions should return skipped slides to the active deck");
  assert.equal(getSlides({ includeSkipped: true }).filter((slide) => slide.skipped).length, 0, "restore actions should clear skipped markers");

  const oneSkipPlan = planDeckLength({ targetCount: 5 });
  applyDeckLengthPlan({
    actions: oneSkipPlan.actions,
    targetCount: oneSkipPlan.targetCount
  });
  assert.equal(getSlides().length, 5, "second shortening pass should leave one skipped slide");

  const restoredAll = restoreSkippedSlides({ all: true });
  assert.equal(restoredAll.restoredSlides, 1, "bulk restore should report restored skipped slides");
  assert.deepEqual(
    getSlides().map((slide) => slide.index),
    [1, 2, 3, 4, 5, 6],
    "restored slides should be compacted back into a contiguous active order"
  );
});

test("materials accept only bounded image data and keep paths presentation-scoped", () => {
  const presentation = createCoveragePresentation("materials");
  const material = createMaterialFromDataUrl({
    alt: "Coverage material",
    caption: "Source: coverage fixture",
    dataUrl: tinyPngDataUrl,
    fileName: "coverage fixture.png"
  });

  assert.equal(getMaterial(material.id).id, material.id, "created material should be retrievable");
  assert.ok(
    listMaterials().some((entry) => entry.url.includes(`/presentation-materials/${presentation.id}/`)),
    "material URLs should be scoped to the active presentation"
  );
  assert.ok(
    getMaterialFilePath(presentation.id, material.fileName).startsWith(getPresentationPaths(presentation.id).materialsDir),
    "material file path should resolve inside the presentation material directory"
  );

  assert.throws(
    () => createMaterialFromDataUrl({ dataUrl: "data:text/plain;base64,SGVsbG8=" }),
    /PNG, JPEG, GIF, or WebP/,
    "non-image material uploads should be rejected"
  );
  assert.throws(
    () => getMaterialFilePath(presentation.id, "../escape.png"),
    /Invalid material filename/,
    "material file lookup should reject traversal filenames"
  );
});

test("structured variants validate source before capture and apply only known variants", () => {
  createCoveragePresentation("variants");
  const currentSpec = readSlideSpec("slide-01");
  const variantSpec = {
    ...currentSpec,
    title: "Applied coverage variant"
  };

  const variant = captureVariant({
    id: "coverage-variant",
    label: "Coverage variant",
    slideId: "slide-01",
    slideSpec: variantSpec
  });

  assert.equal(variant.source.trim(), `${JSON.stringify(variantSpec, null, 2)}`.trim(), "structured variants should serialize from validated specs");
  assert.equal(listVariantsForSlide("slide-01")[0].id, "coverage-variant", "captured variant should be listed for the slide");

  const updatedVariant = updateVariant(variant.id, {
    notes: "Updated by coverage",
    slideSpec: {
      ...variantSpec,
      title: "Updated coverage variant"
    }
  });
  assert.equal(updatedVariant.notes, "Updated by coverage", "variant updates should persist editable metadata");
  assert.equal(updatedVariant.slideSpec.title, "Updated coverage variant", "variant updates should revalidate structured specs");
  assert.equal(getVariantStorageStatus().legacyUnstructured, 1, "variant storage status should reflect stored variants");

  applyVariant(variant.id);
  assert.equal(readSlideSpec("slide-01").title, "Updated coverage variant", "applying a variant should update the slide spec");

  assert.throws(
    () => captureVariant({ slideId: "slide-01", source: "{not-json" }),
    /invalid JSON/,
    "structured variant capture should reject malformed JSON"
  );
  assert.throws(
    () => applyVariant("missing-variant"),
    /Unknown variant/,
    "applying an unknown variant should fail explicitly"
  );
  assert.throws(
    () => updateVariant("missing-variant", { notes: "nope" }),
    /Unknown variant/,
    "updating an unknown variant should fail explicitly"
  );
});

test("write boundary blocks paths outside presentation, state, slides, and output roots", () => {
  const presentation = createCoveragePresentation("write-boundary");
  const paths = getPresentationPaths(presentation.id);
  const allowedStateFile = path.join(paths.stateDir, "deck-context.json");

  assert.equal(assertAllowedWriteTarget(allowedStateFile), path.resolve(allowedStateFile));
  writeAllowedJson(allowedStateFile, readSlideSpec("slide-01") ? { deck: { title: presentation.title }, slides: {} } : {});

  const allowedMaterialFile = path.join(paths.materialsDir, "coverage-boundary.bin");
  const copiedMaterialFile = path.join(paths.materialsDir, "coverage-boundary-copy.bin");
  writeAllowedBinary(allowedMaterialFile, Buffer.from("coverage"));
  copyAllowedFile(allowedMaterialFile, copiedMaterialFile);
  assert.equal(fs.readFileSync(copiedMaterialFile, "utf8"), "coverage", "copy should work inside allowed material roots");
  removeAllowedPath(copiedMaterialFile, { force: true });
  assert.equal(fs.existsSync(copiedMaterialFile), false, "remove should work inside allowed material roots");

  const slideOutputFile = path.join(process.cwd(), "slides", "output", "coverage-boundary.bin");
  writeAllowedBinary(slideOutputFile, Buffer.from("coverage-output"));
  assert.equal(fs.readFileSync(slideOutputFile, "utf8"), "coverage-output", "writes should work inside configured slide output roots");
  removeAllowedPath(slideOutputFile, { force: true });

  assert.throws(
    () => assertAllowedWriteTarget(path.join(process.cwd(), "package.json")),
    /outside the studio write boundary/,
    "write boundary should reject repo files outside allowed roots"
  );
  assert.throws(
    () => ensureAllowedDir(path.join(process.cwd(), "..", "slideotter-outside")),
    /outside the studio write boundary/,
    "directory creation should be blocked outside allowed roots"
  );
});
