import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  archiveOutlinePlan,
  createOutlinePlanFromDeckPlan,
  createOutlinePlanFromPresentation,
  createPresentation,
  deleteOutlinePlan,
  deletePresentation,
  derivePresentationFromOutlinePlan,
  duplicateOutlinePlan,
  listOutlinePlans,
  listPresentations,
  outlinePlanToDeckPlan,
  proposeDeckChangesFromOutlinePlan,
  saveOutlinePlan,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const { getSlides } = require("../studio/server/services/slides.ts");
const { getDeckContext } = require("../studio/server/services/state.ts");
const { createSource, listSources } = require("../studio/server/services/sources.ts");

type JsonRecord = Record<string, unknown>;

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

type CoverageOutlinePlan = JsonRecord & {
  id: string;
  name?: string;
  sections: Array<{
    slides: JsonRecord[];
  }>;
  sourcePresentationId?: string;
  targetSlideCount?: number;
  traceability: Array<{
    kind?: string;
    sourceId?: string;
  }>;
};

type GeneratedDeckPlanSlide = {
  intent: string;
  keyMessage: string;
  role?: string;
  sourceNeed?: string;
  title: string;
  type?: string;
  visualNeed: string;
};

type GeneratedDeckPlan = {
  audience: string;
  language: string;
  narrativeArc: string;
  outline: string;
  slides: GeneratedDeckPlanSlide[];
  thesis: string;
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createCoveragePresentation(suffix: string, fields: JsonRecord = {}): CoveragePresentation {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise outline plan storage and derivation.",
    title: `Outline Plan Coverage ${Date.now()} ${suffix}`,
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

function createGeneratedDeckPlan(title: string, slideCount: number): GeneratedDeckPlan {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : (["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5] ?? "context");
    const label = `${title} ${index + 1}`;

    return {
      intent: `${label} has a distinct planning intent.`,
      keyMessage: `${label} carries one clear generated message.`,
      role,
      sourceNeed: `${label} should use supplied context when relevant.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content",
      visualNeed: `${label} may use fitting supplied imagery.`
    };
  });

  return {
    audience: "Coverage audience",
    language: "English",
    narrativeArc: `${title} moves from context to action.`,
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: `${title} should exercise phased generation.`
  };
}

test.after(() => {
  cleanupCoveragePresentations();
});

test("outline plans stay presentation-scoped and can derive a lineage-marked deck", () => {
  const presentation = createCoveragePresentation("outline-plans", { targetSlideCount: 6 });
  createSource({
    text: "Outline plan source records should optionally copy into derived decks.",
    title: "Outline plan source"
  });
  const generatedPlan: CoverageOutlinePlan = createOutlinePlanFromPresentation(presentation.id, {
    name: "Coverage reusable outline",
    purpose: "Turn the current scaffold into a reusable plan."
  });

  assert.equal(generatedPlan.sourcePresentationId, presentation.id);
  assert.equal(listOutlinePlans(presentation.id).length, 1, "generated outline plan should persist with the source presentation");
  assert.equal(generatedPlan.sections[0]?.slides.length, 3, "current deck plan should carry one intent per active slide");
  assert.ok(
    generatedPlan.traceability.some((entry: { kind?: string; sourceId?: string }) => entry.kind === "source-snippet" && entry.sourceId),
    "generated outline plans should keep pointer-style source traceability"
  );

  const deckPlanOutline = createGeneratedDeckPlan("Approved outline coverage", 4);
  const approvedPlan: CoverageOutlinePlan = createOutlinePlanFromDeckPlan(presentation.id, deckPlanOutline, {
    name: "Approved coverage outline",
    objective: "Exercise approved outline storage.",
    targetSlideCount: 4
  });

  assert.equal(listOutlinePlans(presentation.id).length, 2, "multiple outline plans should persist for one presentation");
  assert.equal(approvedPlan.targetSlideCount, 4);

  const result = derivePresentationFromOutlinePlan(presentation.id, approvedPlan.id, {
    copySources: true,
    title: "Coverage derived outline deck"
  });
  createdPresentationIds.add(result.presentation.id);
  const derivedContext = getDeckContext();

  assert.equal(result.presentation.slideCount, 4, "derived deck should create one placeholder slide per plan slide");
  assert.equal(derivedContext.deck.lineage.sourcePresentationId, presentation.id);
  assert.equal(derivedContext.deck.lineage.outlinePlanId, approvedPlan.id);
  assert.equal(listSources().length, 1, "derived deck should copy source records when requested");
  assert.equal(listOutlinePlans(result.presentation.id).length, 1, "derived deck should carry a copied outline plan");

  setActivePresentation(presentation.id);
  const currentSlideCount = getSlides().length;
  const candidate = proposeDeckChangesFromOutlinePlan(presentation.id, approvedPlan.id);
  assert.equal(candidate.slides.length, 4, "outline-plan candidate should include one step per planned slide");
  assert.equal(candidate.planStats.inserted, 1, "longer outline plans should propose inserted slide candidates");
  assert.equal(getSlides().length, currentSlideCount, "proposing outline-plan changes should not mutate the current deck");
  assert.equal(
    outlinePlanToDeckPlan(approvedPlan).slides.length,
    approvedPlan.targetSlideCount,
    "outline plans should convert into approved deck plans for live generation handoff"
  );

  const duplicatedPlan = duplicateOutlinePlan(presentation.id, generatedPlan.id, {
    name: "Coverage reusable outline copy"
  });
  assert.equal(duplicatedPlan.parentPlanId, generatedPlan.id, "duplicated outline plans should retain parent lineage");
  assert.equal(listOutlinePlans(presentation.id).length, 3, "duplicating a plan should add a sibling plan");

  archiveOutlinePlan(presentation.id, generatedPlan.id);
  assert.equal(listOutlinePlans(presentation.id).length, 2, "archived plans should be hidden from the normal list");
  assert.equal(listOutlinePlans(presentation.id, { includeArchived: true }).length, 3, "archived plans should remain stored");

  deleteOutlinePlan(presentation.id, duplicatedPlan.id);
  assert.equal(listOutlinePlans(presentation.id).length, 1, "deleting one plan should leave sibling plans intact");
});

test("outline plan storage rejects malformed plans before derivation", () => {
  const presentation = createCoveragePresentation("outline-plan-validation");

  assert.throws(
    () => saveOutlinePlan(presentation.id, {
      id: "bad-plan",
      name: "Bad plan",
      sections: []
    }),
    /at least one section/,
    "outline plans without slide intents should be rejected"
  );
});
