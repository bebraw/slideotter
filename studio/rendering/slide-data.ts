import { asRecord, isRecord, type JsonRecord } from "./html.ts";

export type CardItem = JsonRecord & {
  body?: unknown;
  label?: unknown;
  source?: unknown;
  title?: unknown;
  value?: unknown;
};

export type MediaItem = JsonRecord & {
  alt?: unknown;
  caption?: unknown;
  source?: unknown;
  src?: unknown;
};

export type SlotRegion = JsonRecord & {
  column?: unknown;
  columnSpan?: unknown;
  row?: unknown;
  rowSpan?: unknown;
  slot?: unknown;
  spacing?: unknown;
};

export type SlotRegionLayoutDefinition = JsonRecord & {
  constraints?: JsonRecord;
  regions: SlotRegion[];
  type: "slotRegionLayout";
};

export type SlideSpec = JsonRecord & {
  attribution?: unknown;
  bullets?: unknown;
  caption?: unknown;
  cards?: unknown;
  context?: unknown;
  customVisual?: unknown;
  eyebrow?: unknown;
  guardrails?: unknown;
  guardrailsTitle?: unknown;
  id?: unknown;
  index?: unknown;
  layout?: unknown;
  layoutDefinition?: unknown;
  logo?: unknown;
  media?: unknown;
  mediaItems?: unknown;
  note?: unknown;
  quote?: unknown;
  resources?: unknown;
  resourcesTitle?: unknown;
  signals?: unknown;
  signalsTitle?: unknown;
  source?: unknown;
  summary?: unknown;
  title?: unknown;
  type?: unknown;
};

export type SlideEntry = JsonRecord & {
  id?: unknown;
  index?: unknown;
  presentationX?: unknown;
  presentationY?: unknown;
  slideSpec?: unknown;
};

export type DocumentMetadata = JsonRecord & {
  author?: unknown;
  company?: unknown;
  objective?: unknown;
  subject?: unknown;
};

export type DocumentPayload = JsonRecord & {
  index?: unknown;
  inlineCss?: unknown;
  lang?: unknown;
  metadata?: unknown;
  slideId?: unknown;
  slides?: unknown;
  slideSpec?: unknown;
  theme?: unknown;
  title?: unknown;
  totalSlides?: unknown;
};

export function toSlideSpec(value: unknown): SlideSpec {
  return asRecord(value);
}

export function toDocumentPayload(value: unknown): DocumentPayload {
  return asRecord(value);
}

export function toItems(value: unknown): CardItem[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function toMediaItems(value: unknown): MediaItem[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function toSlideEntries(value: unknown): SlideEntry[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
