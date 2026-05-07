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
  getSlides
} = require("../studio/server/services/slides.ts");
const {
  createDeckStructureCandidateFromLlmIntent
} = require("../studio/server/services/deck-structure-llm-candidates.ts");
const {
  applyDeckStructureCandidate
} = require("../studio/server/services/deck-structure-operations.ts");

type JsonRecord = Record<string, unknown>;

type PresentationRecord = JsonRecord & {
  id: string;
};

type PresentationRegistry = {
  activePresentationId: string;
  presentations: PresentationRecord[];
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createCoveragePresentation(suffix: string): PresentationRecord {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise deck-structure quarantine behavior.",
    title: `Coverage Deck Structure ${Date.now()} ${suffix}`
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function cleanupCoveragePresentations(): void {
  const current = listPresentations() as PresentationRegistry;
  const knownIds = new Set(current.presentations.map((presentation: PresentationRecord) => presentation.id));

  for (const id of createdPresentationIds) {
    if (!knownIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch (error) {
      // Preserve the original assertion failure if cleanup also fails.
    }
  }

  const afterCleanup = listPresentations() as PresentationRegistry;
  if (afterCleanup.presentations.some((presentation: PresentationRecord) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(() => {
  cleanupCoveragePresentations();
});

test("deck-structure LLM insert candidates reject visible authoring metadata before preview", () => {
  const structureContext = {
    audience: "coverage audience",
    constraints: "keep the deck concise",
    deck: {},
    objective: "show quarantine behavior",
    outlineLines: ["Opening claim", "Supporting evidence"],
    slides: [
      {
        currentTitle: "Opening claim",
        id: "slide-01",
        index: 1,
        intent: "Frame the deck",
        outlineLine: "Opening claim",
        type: "cover"
      }
    ]
  };

  assert.throws(
    () => createDeckStructureCandidateFromLlmIntent(
      structureContext,
      {
        changeLead: "Insert one leaky slide.",
        label: "Leaky insert",
        slides: [
          {
            action: "insert",
            grounding: ["Ensure all claims are supported by official sources."],
            proposedIndex: 2,
            proposedTitle: "Leaky deck plan insert",
            rationale: "Ensure all claims are supported by official sources.",
            role: "Source Verification",
            summary: "Audience understands the purpose of this presentation.",
            type: "content"
          }
        ],
        summary: "Insert a leaky slide."
      },
      {
        model: "fixture-model",
        provider: "fixture"
      },
      {
        readExistingSlideSpec: () => null
      }
    ),
    /Visible text quarantine blocked deck-structure content intent/,
    "deck-structure candidates should reject leaky visible scaffold text before preview"
  );
});

test("deck-structure apply rejects leaky inserted scaffold specs before writing slides", async () => {
  createCoveragePresentation("apply-quarantine");
  const beforeCount = getSlides().length;

  await assert.rejects(
    () => applyDeckStructureCandidate({
      slides: [
        {
          action: "insert",
          proposedIndex: 2,
          proposedTitle: "Leaky insert",
          scaffold: {
            slideSpec: {
              eyebrow: "Plan",
              guardrails: [
                {
                  body: "Ensure all claims are supported by official sources.",
                  id: "guardrail-one",
                  title: "Source Verification"
                },
                {
                  body: "Keep text concise for readability.",
                  id: "guardrail-two",
                  title: "Visual Clarity"
                },
                {
                  body: "Avoid technical jargon for a beginner audience.",
                  id: "guardrail-three",
                  title: "Accessible Language"
                }
              ],
              guardrailsTitle: "Why it matters",
              layout: "standard",
              signals: [
                {
                  body: "Audience-facing copy should stay concrete.",
                  id: "signal-one",
                  title: "Concrete"
                },
                {
                  body: "Review candidate text before applying.",
                  id: "signal-two",
                  title: "Review"
                },
                {
                  body: "Keep slide text readable.",
                  id: "signal-three",
                  title: "Readable"
                }
              ],
              signalsTitle: "What changes",
              summary: "Ensure the tone remains appropriate for the audience.",
              title: "Leaky inserted slide",
              type: "content"
            }
          }
        }
      ]
    }),
    /Visible text quarantine blocked deck-structure insert apply/,
    "deck-structure apply should quarantine inserted slide specs before writes"
  );
  assert.equal(getSlides().length, beforeCount, "blocked deck-structure insert should not create a slide");
});
