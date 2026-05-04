import { asRecord as asJsonObject } from "../../shared/json-utils.ts";
import {
  type DeckStructureContext,
  type DeckStructureSlide
} from "./deck-structure-context.ts";
import { createDeckStructurePlan } from "./deck-structure-plan-construction.ts";
import { readSlideSpec } from "./slides.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

export type DeckWideAuthoringDefinition = JsonObject & {
  changeLead: string;
  createSlideSpec: (context: DeckStructureContext, options: DeckWideAuthoringDetails) => SlideSpec;
  kindLabel?: unknown;
  label: string;
  roles?: string[];
  replacementSummary?: (slide: DeckStructureSlide, index: number) => string;
  summary: string;
  titles?: unknown;
};

export type DeckWideAuthoringDetails = {
  currentSlide: DeckStructureSlide;
  currentSpec: SlideSpec;
  index: number;
  proposedIndex: number;
  proposedTitle: string;
};

export function createInsertedDecisionCriteriaSlide(context: DeckStructureContext, proposedIndex: number): SlideSpec {
  return asJsonObject(validateSlideSpec({
    eyebrow: "Decision criteria",
    guardrails: [
      {
        body: "The slide must carry the claim, evidence, and next action.",
        id: `decision-criteria-guardrail-1`,
        title: "Must include"
      },
      {
        body: "Only the selected candidate should be promoted into the deck.",
        id: `decision-criteria-guardrail-2`,
        title: "Apply step"
      },
      {
        body: "The proof needs a visible preview before acceptance.",
        id: `decision-criteria-guardrail-3`,
        title: "Preview pass"
      }
    ],
    guardrailsTitle: "Decision checks",
    index: proposedIndex,
    signals: [
      {
        body: "Name the decision the audience should be able to make.",
        id: `decision-criteria-signal-1`,
        title: "Claim"
      },
      {
        body: "Show the structure options before judging them.",
        id: `decision-criteria-signal-2`,
        title: "Options"
      },
      {
        body: "Connect the proof slide to the shared runtime and validation path.",
        id: `decision-criteria-signal-3`,
        title: "Proof"
      },
      {
        body: "End with the concrete authoring or approval action.",
        id: `decision-criteria-signal-4`,
        title: "Action"
      }
    ],
    signalsTitle: "Decision inputs",
    summary: `Surface the criteria that connect ${context.slides[1] ? context.slides[1].currentTitle : "structure options"} to ${context.slides[2] ? context.slides[2].currentTitle : "proof"}.`,
    title: "Decision criteria",
    type: "content"
  }));
}

export function createReplacementOperatorChecklistSlide(
  context: DeckStructureContext,
  proposedIndex: number,
  proposedTitle: string
): SlideSpec {
  const proofSlide = context.slides.find((slide: DeckStructureSlide) => slide.index === 3);
  const proofTitle = proofSlide ? proofSlide.currentTitle : "the proof block";

  return asJsonObject(validateSlideSpec({
    bullets: [
      {
        body: `Restate the main decision with ${proofTitle} attached as the supporting evidence.`,
        id: "operator-checklist-bullet-1",
        title: "State the call"
      },
      {
        body: "Carry forward the guardrails and the one apply path before asking for sign-off.",
        id: "operator-checklist-bullet-2",
        title: "Carry the guardrails"
      },
      {
        body: "Close with the explicit next owner, timing, and preview check that keeps the deck honest.",
        id: "operator-checklist-bullet-3",
        title: "Name the next move"
      }
    ],
    eyebrow: "Operator checklist",
    index: proposedIndex,
    resources: [
      {
        body: "Saved outline plus promoted slide titles and order",
        id: "operator-checklist-resource-1",
        title: "Plan source",
        bodyFontSize: 10.8
      },
      {
        body: "Preview rebuild plus npm run quality:gate",
        id: "operator-checklist-resource-2",
        title: "Approval gate",
        bodyFontSize: 10.8
      }
    ],
    resourcesTitle: "Keep nearby",
    summary: `Replace the closing slide with one operator-ready checklist that turns ${proofTitle} into an explicit handoff.`,
    title: proposedTitle || "Operator checklist",
    type: "summary"
  }));
}

export function createDeckWideAuthoringPlan(
  context: DeckStructureContext,
  definition: DeckWideAuthoringDefinition
): JsonObject {
  return createDeckStructurePlan(context, {
    ...definition,
    kindLabel: String(definition.kindLabel || "Deck authoring"),
    replacements: context.slides.map((slide: DeckStructureSlide, index: number) => ({
      createSlideSpec: (currentContext: DeckStructureContext, proposedIndex: number, proposedTitle: string, currentSlide: DeckStructureSlide) => {
        const currentSpec = asJsonObject(readSlideSpec(currentSlide.id));
        return definition.createSlideSpec(currentContext, {
          currentSlide,
          currentSpec,
          index,
          proposedIndex,
          proposedTitle
        });
      },
      currentIndex: slide.index,
      slideId: slide.id,
      summary: typeof definition.replacementSummary === "function"
        ? definition.replacementSummary(slide, index)
        : `Rewrite ${slide.currentTitle} as part of the ${definition.label.toLowerCase()} pass.`,
      type: slide.type || "content"
    })),
    titles: Array.isArray(definition.titles) ? definition.titles.map((title: unknown) => String(title || "")) : []
  });
}
