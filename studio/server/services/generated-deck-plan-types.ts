export type JsonObject = Record<string, unknown>;

export type DeckPlanSlide = JsonObject & {
  evidence?: unknown;
  evidenceNeed?: unknown;
  image?: unknown;
  imageNeed?: unknown;
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  sourceNeeds?: unknown;
  source_notes?: unknown;
  sourceNotes?: unknown;
  title?: unknown;
  type?: unknown;
  value?: unknown;
  visualNeed?: unknown;
  visualNeeds?: unknown;
  visual_notes?: unknown;
  visualNotes?: unknown;
};

export type DeckPlan = JsonObject & {
  narrativeArc?: unknown;
  outline?: unknown;
  slides?: DeckPlanSlide[];
  thesis?: unknown;
  title?: unknown;
};
