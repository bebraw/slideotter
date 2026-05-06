export type JsonObject = Record<string, unknown>;

export type TextPoint = JsonObject & {
  body?: unknown;
  title?: unknown;
};

export type GeneratedPlanSlide = JsonObject & {
  coverIntent?: unknown;
  eyebrow?: unknown;
  guardrailTitle?: unknown;
  guardrails?: TextPoint[];
  guardrailsTitle?: unknown;
  intent?: unknown;
  keyPoints?: TextPoint[];
  keyPointsTitle?: unknown;
  label?: unknown;
  mediaMaterialId?: unknown;
  note?: unknown;
  resourceTitle?: unknown;
  resources?: TextPoint[];
  resourcesTitle?: unknown;
  role?: unknown;
  section?: unknown;
  signalsTitle?: unknown;
  speakerNote?: unknown;
  speakerNotes?: unknown;
  sourceNeed?: unknown;
  sourceNeeds?: unknown;
  summary?: unknown;
  title?: unknown;
  type?: unknown;
  value?: unknown;
  visualNeed?: unknown;
  visualNeeds?: unknown;
};

export type GeneratedReference = {
  title?: unknown;
  url?: unknown;
};

export type GeneratedPlan = JsonObject & {
  references?: GeneratedReference[];
  slides?: GeneratedPlanSlide[];
};

export type SlideItem = JsonObject & {
  body?: unknown;
  label?: unknown;
  title?: unknown;
  value?: unknown;
};

export type GeneratedSlideSpec = JsonObject & {
  bullets?: SlideItem[];
  cards?: SlideItem[];
  context?: unknown;
  coverIntent?: unknown;
  eyebrow?: unknown;
  guardrails?: SlideItem[];
  guardrailsTitle?: unknown;
  media?: JsonObject & {
    alt?: unknown;
    caption?: unknown;
  };
  mediaItems?: SlideItem[];
  note?: unknown;
  quote?: unknown;
  resources?: SlideItem[];
  resourcesTitle?: unknown;
  signals?: SlideItem[];
  signalsTitle?: unknown;
  summary?: unknown;
  title?: unknown;
  type?: unknown;
};
