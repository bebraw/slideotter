import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  createPresentation,
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  getSlides,
  readSlideSpec,
  writeSlideSpec
} = require("../studio/server/services/slides.ts");
const {
  applyVariant,
  captureVariant,
  getVariantStorageStatus,
  listVariantsForSlide,
  updateVariant
} = require("../studio/server/services/variants.ts");

type JsonRecord = Record<string, unknown>;

type CoveragePresentation = JsonRecord & {
  id: string;
};

type CoverageSlideInfo = JsonRecord & {
  id: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: CoveragePresentation[];
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createCoveragePresentation(suffix: string): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise variant persistence and apply behavior.",
    title: `Coverage Variants ${Date.now()} ${suffix}`
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function cleanupCoveragePresentations(): void {
  const current = listPresentations() as PresentationRegistry;
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

  const afterCleanup = listPresentations() as PresentationRegistry;
  if (afterCleanup.presentations.some((presentation: CoveragePresentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(() => {
  cleanupCoveragePresentations();
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
  assert.equal(getVariantStorageStatus().slideLocalStructured, 1, "variant storage status should reflect stored structured variants");

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

test("structured variant application preserves the target slide position", () => {
  createCoveragePresentation("variant-position");
  const currentSpec = readSlideSpec("slide-02");
  const variantSpec = {
    ...currentSpec,
    index: 99,
    title: "Position-safe variant"
  };

  const variant = captureVariant({
    id: "position-variant",
    label: "Position variant",
    slideId: "slide-02",
    slideSpec: variantSpec
  });

  assert.equal(variant.slideSpec.index, 99, "fixture should reproduce a misplaced variant candidate");
  applyVariant(variant.id);

  assert.equal(readSlideSpec("slide-02").title, "Position-safe variant", "variant content should still apply");
  assert.equal(readSlideSpec("slide-02").index, 2, "variant apply should keep the target slide's stored index");
  assert.deepEqual(
    getSlides().map((slide: CoverageSlideInfo) => slide.id),
    ["slide-01", "slide-02", "slide-03"],
    "variant apply should not reorder the active deck"
  );
});

test("structured variants reject visible semantic leaks before capture and update", () => {
  createCoveragePresentation("variant-quarantine");
  const currentSpec = readSlideSpec("slide-01");

  assert.throws(
    () => captureVariant({
      id: "leaky-variant",
      label: "Leaky variant",
      slideId: "slide-01",
      slideSpec: {
        ...currentSpec,
        cards: [
          {
            body: "Ensure all claims are supported by official sources.",
            id: "card-one",
            title: "Source Verification"
          }
        ],
        title: "Leaky capture"
      }
    }),
    /Visible text quarantine blocked Captured variant/,
    "variant capture should reject slide-visible authoring metadata"
  );

  const variant = captureVariant({
    id: "safe-variant",
    label: "Safe variant",
    slideId: "slide-01",
    slideSpec: {
      ...currentSpec,
      title: "Safe variant"
    }
  });

  assert.throws(
    () => updateVariant(variant.id, {
      slideSpec: {
        ...currentSpec,
        summary: "Audience understands the purpose of this presentation.",
        title: "Leaky update"
      }
    }),
    /Visible text quarantine blocked Updated variant/,
    "variant updates should reject slide-visible scaffold copy"
  );
});

test("transient variant slide spec writes can preserve the target slide position", () => {
  createCoveragePresentation("transient-variant-position");
  const currentSpec = readSlideSpec("slide-02");

  writeSlideSpec("slide-02", {
    ...currentSpec,
    index: 99,
    title: "Transient position-safe variant"
  }, { preservePlacement: true });

  assert.equal(readSlideSpec("slide-02").title, "Transient position-safe variant", "transient variant content should apply");
  assert.equal(readSlideSpec("slide-02").index, 2, "transient variant apply should keep the target slide's stored index");
  assert.deepEqual(
    getSlides().map((slide: CoverageSlideInfo) => slide.id),
    ["slide-01", "slide-02", "slide-03"],
    "transient variant apply should not reorder the active deck"
  );
});
