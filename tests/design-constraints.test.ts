import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";

const require = createRequire(import.meta.url);
const {
  defaultDesignConstraints,
  describeDesignConstraints,
  getValidationConstraintOptions,
  readDesignConstraints,
  normalizeDesignConstraints
} = require("../studio/server/services/design-constraints.ts");
const {
  createPresentation,
  deletePresentation,
  listPresentations,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const { saveDeckContext } = require("../studio/server/services/state.ts");

type CoveragePresentation = Record<string, unknown> & {
  id: string;
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createCoveragePresentation(suffix: string): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Design constraints coverage",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise design constraint normalization.",
    title: `Design Constraints ${Date.now()} ${suffix}`
  }) as CoveragePresentation;
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function cleanupCoveragePresentations(): void {
  const current = listPresentations();
  const currentPresentations = Array.isArray(current.presentations)
    ? current.presentations as CoveragePresentation[]
    : [];
  const knownIds = new Set(currentPresentations.map((presentation) => presentation.id));

  for (const id of createdPresentationIds) {
    if (!knownIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch {
      // Keep cleanup best-effort so the original assertion failure remains visible.
    }
  }

  const afterCleanup = listPresentations();
  const remainingPresentations = Array.isArray(afterCleanup.presentations)
    ? afterCleanup.presentations as CoveragePresentation[]
    : [];
  if (remainingPresentations.some((presentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(cleanupCoveragePresentations);

test("default design constraints favor concise presentation-scale slides", () => {
  assert.equal(defaultDesignConstraints.maxWordsPerSlide, 60);
  assert.deepEqual(normalizeDesignConstraints({}).maxWordsPerSlide, 60);
  assert.ok(
    describeDesignConstraints({}).includes("keep each slide at or under 60 words"),
    "generation context should state the lower default word budget"
  );
});

test("explicit deck word budgets still override the lower default", () => {
  assert.equal(normalizeDesignConstraints({ maxWordsPerSlide: 42 }).maxWordsPerSlide, 42);
});

test("design constraints clamp unsafe numeric overrides", () => {
  assert.deepEqual(normalizeDesignConstraints({
    maxWordsPerSlide: 500,
    minCaptionGapIn: -1,
    minContentGapIn: 3,
    minFontSizePt: 3,
    minPanelPaddingIn: 2
  }), {
    maxWordsPerSlide: 250,
    minCaptionGapIn: 0.02,
    minContentGapIn: 1.5,
    minFontSizePt: 6,
    minPanelPaddingIn: 0.5
  });
});

test("design constraints fall back for non-numeric inputs", () => {
  assert.deepEqual(normalizeDesignConstraints({
    maxWordsPerSlide: "many",
    minCaptionGapIn: Number.NaN,
    minContentGapIn: undefined,
    minFontSizePt: null,
    minPanelPaddingIn: {}
  }), {
    ...defaultDesignConstraints,
    minFontSizePt: 6
  });
});

test("design constraints describe every enforced spacing and type rule", () => {
  const description = describeDesignConstraints({
    maxWordsPerSlide: 42,
    minCaptionGapIn: 0.24,
    minContentGapIn: 0.36,
    minFontSizePt: 12,
    minPanelPaddingIn: 0.16
  });

  assert.deepEqual(description, [
    "keep visible text at or above 12pt",
    "keep each slide at or under 42 words",
    "keep main content groups at least 0.36in apart",
    "keep captions at least 0.24in from visuals",
    "keep panel text inset at least 0.16in"
  ]);
});

test("design constraints produce validation option thresholds", () => {
  const options = getValidationConstraintOptions({
    maxWordsPerSlide: 42,
    minCaptionGapIn: 0.24,
    minContentGapIn: 0.36,
    minFontSizePt: 12,
    minPanelPaddingIn: 0.16
  });

  assert.deepEqual(options, {
    captionSpacing: {
      minGap: 0.24
    },
    contentSpacing: {
      minGap: 0.36
    },
    minimumFontSize: {
      minFontSizePt: 12
    },
    slideWordCount: {
      maxWordsPerSlide: 42
    },
    textPadding: {
      minBottom: 0.1,
      minHorizontal: 0.16,
      minTop: 0.16
    },
    verticalBalance: {
      minGap: 0.36
    }
  });
});

test("design constraints read active deck settings", () => {
  createCoveragePresentation("active-deck");
  saveDeckContext({
    deck: {
      designConstraints: {
        maxWordsPerSlide: 45,
        minCaptionGapIn: 0.25,
        minContentGapIn: 0.4,
        minFontSizePt: 13,
        minPanelPaddingIn: 0.12
      }
    },
    slides: {}
  });

  assert.deepEqual(readDesignConstraints(), {
    maxWordsPerSlide: 45,
    minCaptionGapIn: 0.25,
    minContentGapIn: 0.4,
    minFontSizePt: 13,
    minPanelPaddingIn: 0.12
  });
});
