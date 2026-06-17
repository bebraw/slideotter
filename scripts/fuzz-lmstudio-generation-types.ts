import type { DeckPlan } from "../studio/server/services/generated-deck-plan-types.ts";

export type JsonObject = Record<string, unknown>;

export type FuzzMaterial = {
  alt: string;
  id: string;
  title: string;
  url: string;
};

export type FuzzFields = JsonObject & {
  audience: string;
  constraints: string;
  objective: string;
  presentationMaterials?: FuzzMaterial[];
  presentationSources?: Array<JsonObject & {
    id: string;
    text: string;
    title: string;
    url: string;
  }>;
  targetSlideCount: number;
  title: string;
  tone: string;
};

export type DeckPlanResponse = JsonObject & {
  plan?: DeckPlan | undefined;
};

export type SlideSpec = JsonObject & {
  bullets?: Array<JsonObject>;
  cards?: Array<JsonObject>;
  guardrails?: Array<JsonObject>;
  media?: unknown;
  mediaItems?: unknown;
  note?: unknown;
  resources?: Array<JsonObject>;
  signals?: Array<JsonObject>;
  summary?: unknown;
  title?: unknown;
  type?: unknown;
};

export type DraftedPresentation = JsonObject & {
  retrieval?: {
    snippets?: unknown;
  };
  slideSpecs: SlideSpec[];
};

export type GenerationModule = {
  generateInitialDeckPlan: (fields: FuzzFields) => Promise<DeckPlanResponse>;
  generatePresentationFromDeckPlan: (fields: FuzzFields, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse) => Promise<DraftedPresentation>;
  generatePresentationFromDeckPlanIncremental: (fields: FuzzFields, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse) => Promise<DraftedPresentation>;
};
