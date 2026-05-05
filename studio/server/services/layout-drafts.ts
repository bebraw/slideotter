import { normalizeLayoutDefinition } from "./layouts.ts";

const knownSpacingTokens = new Set(["loose", "none", "normal", "tight"]);

type SlotDefinition = {
  id: string;
  maxLines: number | null;
  required: boolean;
  role: string;
};

type RegionDefinition = {
  align: string;
  area: string;
  column: number;
  columnSpan: number;
  id: string;
  row: number;
  rowSpan: number;
  slot: string;
  spacing: string;
};

export type CustomLayoutDraftOptions = {
  minFontSize?: unknown;
  profile?: unknown;
  slideType?: unknown;
  spacing?: unknown;
};

function normalizeInteger(value: unknown, fallback: number, min: number, max: number, label: string): number {
  const numberValue = Number(value ?? fallback);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return numberValue;
}

function normalizeEnum(value: unknown, allowedValues: Set<string>, fallback: string, label: string): string {
  const stringValue = String(value || fallback).trim() || fallback;
  if (!allowedValues.has(stringValue)) {
    throw new Error(`${label} must be one of: ${Array.from(allowedValues).join(", ")}`);
  }
  return stringValue;
}

function normalizeDraftSlideType(value: unknown): string {
  const slideType = String(value || "content").trim();
  return slideType === "cover" ? "cover" : "content";
}

function createCustomLayoutSlots(slideType = "content"): SlotDefinition[] {
  if (normalizeDraftSlideType(slideType) === "cover") {
    return [
      { id: "title", maxLines: 3, required: true, role: "title" },
      { id: "summary", maxLines: 3, required: true, role: "summary" },
      { id: "note", maxLines: 3, required: true, role: "caption" },
      { id: "cards", maxLines: 6, required: true, role: "body" }
    ];
  }

  return [
    { id: "title", maxLines: 3, required: true, role: "title" },
    { id: "summary", maxLines: 3, required: true, role: "summary" },
    { id: "signals", maxLines: 6, required: true, role: "signals" },
    { id: "guardrails", maxLines: 5, required: true, role: "guardrails" }
  ];
}

function createCoverLayoutRegions(profile: string, spacing: string): RegionDefinition[] {
  if (profile === "lead-sidebar") {
    return [
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 4, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "note-region", row: 6, rowSpan: 2, slot: "note", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "cards-region", row: 1, rowSpan: 7, slot: "cards", spacing }
    ];
  }

  if (profile === "stacked-sequence") {
    return [
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "body", column: 1, columnSpan: 8, id: "cards-region", row: 5, rowSpan: 4, slot: "cards", spacing },
      { align: "stretch", area: "body", column: 9, columnSpan: 4, id: "note-region", row: 5, rowSpan: 4, slot: "note", spacing }
    ];
  }

  if (profile === "lead-support") {
    return [
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "title-region", row: 1, rowSpan: 4, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "summary-region", row: 5, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "support", column: 1, columnSpan: 8, id: "cards-region", row: 6, rowSpan: 3, slot: "cards", spacing },
      { align: "stretch", area: "support", column: 9, columnSpan: 4, id: "note-region", row: 6, rowSpan: 3, slot: "note", spacing }
    ];
  }

  return [
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 4, rowSpan: 2, slot: "summary", spacing },
    { align: "stretch", area: "support", column: 8, columnSpan: 5, id: "cards-region", row: 1, rowSpan: 7, slot: "cards", spacing },
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "note-region", row: 6, rowSpan: 2, slot: "note", spacing }
  ];
}

function createContentLayoutRegions(profile: string, spacing: string): RegionDefinition[] {
  if (profile === "lead-sidebar") {
    return [
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "signals-region", row: 1, rowSpan: 4, slot: "signals", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
    ];
  }

  if (profile === "stacked-sequence") {
    return [
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "body", column: 1, columnSpan: 6, id: "signals-region", row: 5, rowSpan: 4, slot: "signals", spacing },
      { align: "stretch", area: "body", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 4, slot: "guardrails", spacing }
    ];
  }

  if (profile === "lead-support") {
    return [
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "summary-region", row: 3, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "support", column: 1, columnSpan: 6, id: "signals-region", row: 4, rowSpan: 5, slot: "signals", spacing },
      { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "guardrails-region", row: 4, rowSpan: 5, slot: "guardrails", spacing }
    ];
  }

  return [
    { align: "stretch", area: "lead", column: 1, columnSpan: 6, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
    { align: "stretch", area: "lead", column: 1, columnSpan: 6, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
    { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "signals-region", row: 1, rowSpan: 4, slot: "signals", spacing },
    { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
  ];
}

export function createCustomLayoutDraftDefinition(options: CustomLayoutDraftOptions = {}) {
  const slideType = normalizeDraftSlideType(options.slideType);
  const profile = String(options.profile || "balanced-grid").trim() || "balanced-grid";
  const spacing = normalizeEnum(options.spacing, knownSpacingTokens, "normal", "spacing");
  const minFontSize = normalizeInteger(options.minFontSize, 18, 8, 72, "minFontSize");
  const slots = createCustomLayoutSlots(slideType);
  const regions = slideType === "cover"
    ? createCoverLayoutRegions(profile, spacing)
    : createContentLayoutRegions(profile, spacing);

  return normalizeLayoutDefinition({
    constraints: {
      captionAttached: true,
      maxLines: 6,
      minFontSize,
      progressClearance: true
    },
    mediaTreatment: {
      fit: "contain",
      focalPoint: "center"
    },
    readingOrder: slots.map((slot) => slot.id),
    regions,
    slots,
    typography: Object.fromEntries(slots.map((slot) => [
      slot.id,
      slot.role === "title" ? "title" : slot.role === "caption" ? "caption" : "body"
    ])),
    type: "slotRegionLayout"
  }, [slideType]);
}
