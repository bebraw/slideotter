import { hashFieldValue } from "./selection-hash.ts";
import {
  pathToArray,
  pathToString,
  type FieldPath
} from "./selection-path-format.ts";
import { getPathValue } from "./selection-path-values.ts";
import { asRecord, type JsonRecord } from "./selection-records.ts";

export type SelectionEntry = {
  anchorText: string;
  fieldHash: string;
  fieldPath: FieldPath;
  label: string;
  selectedText: string;
  selectionRange: {
    end: number | null;
    start: number | null;
  } | null;
};

type SelectionScope = SelectionEntry & {
  kind: "selection";
  presentationId: string;
  slideId: string;
  slideRevision: string | null;
};

type SelectionGroupScope = {
  kind: "selectionGroup";
  label: string;
  presentationId: string;
  selections: SelectionEntry[];
  slideId: string;
  slideRevision: string | null;
};

export type NormalizedSelectionScope = SelectionScope | SelectionGroupScope;

type SelectionNormalizeOptions = {
  presentationId?: unknown;
  slideId?: unknown;
  slideSpec?: unknown;
};

type NormalizedSelectionRange = SelectionEntry["selectionRange"];

export function normalizeText(value: unknown, limit = 500): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function selectionLabelFromPath(path: unknown): string {
  const segments = pathToArray(path);
  if (!segments.length) {
    return "Selection";
  }

  const last = segments[segments.length - 1];
  const previous = segments.length > 1 ? segments[segments.length - 2] : null;
  if (typeof previous === "number") {
    return `${String(segments[segments.length - 3] || "Item")} ${previous + 1} ${String(last)}`;
  }

  return String(last);
}

function normalizeSelectionEntry(entry: unknown, slideSpec: unknown): SelectionEntry | null {
  const entryRecord: JsonRecord = asRecord(entry);
  if (!Object.keys(entryRecord).length) {
    return null;
  }

  const fieldPath = pathToArray(entryRecord.fieldPath || entryRecord.path);
  if (!fieldPath.length) {
    return null;
  }

  const fieldValue = getPathValue(slideSpec, fieldPath);
  if (fieldValue === undefined) {
    return null;
  }

  const selectedText = normalizeText(entryRecord.selectedText || entryRecord.text || fieldValue);
  const anchorText = normalizeText(entryRecord.anchorText || selectedText || fieldValue);
  if (!selectedText && typeof fieldValue !== "string") {
    return null;
  }

  const selectionRange = asRecord(entryRecord.selectionRange);
  return {
    anchorText,
    fieldHash: normalizeText(entryRecord.fieldHash, 80) || hashFieldValue(fieldValue),
    fieldPath,
    label: normalizeText(entryRecord.label, 80) || selectionLabelFromPath(fieldPath),
    selectedText: selectedText || normalizeText(fieldValue),
    selectionRange: normalizeSelectionRange(selectionRange)
  };
}

function normalizeSelectionRange(selectionRange: JsonRecord): NormalizedSelectionRange {
  if (!Object.keys(selectionRange).length) {
    return null;
  }

  return {
    end: normalizeRangeBoundary(selectionRange.end),
    start: normalizeRangeBoundary(selectionRange.start)
  };
}

function normalizeRangeBoundary(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeSelectionScope(selection: unknown, options: SelectionNormalizeOptions = {}): NormalizedSelectionScope | null {
  const selectionRecord = asRecord(selection);
  if (!Object.keys(selectionRecord).length || !options.slideSpec) {
    return null;
  }

  const kind = selectionRecord.kind === "selectionGroup" || Array.isArray(selectionRecord.selections)
    ? "selectionGroup"
    : "selection";
  const expectedSlideId = normalizeText(options.slideId, 80);
  const slideId = normalizeText(selectionRecord.slideId || options.slideId, 80);
  if (expectedSlideId && slideId && slideId !== expectedSlideId) {
    return null;
  }

  if (kind === "selectionGroup") {
    return normalizeSelectionGroupScope(selectionRecord, options, slideId);
  }

  const normalized = normalizeSelectionEntry(selectionRecord, options.slideSpec);
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    kind,
    presentationId: normalizePresentationId(selectionRecord, options),
    slideId,
    slideRevision: normalizeSlideRevision(selectionRecord)
  };
}

function normalizePresentationId(selectionRecord: JsonRecord, options: SelectionNormalizeOptions): string {
  return normalizeText(selectionRecord.presentationId || options.presentationId, 80);
}

function normalizeSlideRevision(selectionRecord: JsonRecord): string | null {
  return normalizeText(selectionRecord.slideRevision, 120) || null;
}

function normalizeSelectionGroupScope(
  selectionRecord: JsonRecord,
  options: SelectionNormalizeOptions,
  slideId: string
): NormalizedSelectionScope | null {
  const selections = (Array.isArray(selectionRecord.selections) ? selectionRecord.selections : [])
    .map((entry) => normalizeSelectionEntry(entry, options.slideSpec))
    .filter((entry): entry is SelectionEntry => Boolean(entry));
  const uniquePaths = new Set(selections.map((entry) => pathToString(entry.fieldPath)));
  if (!selections.length || uniquePaths.size !== selections.length) {
    return null;
  }

  return {
    kind: "selectionGroup",
    label: `${selections.length} selected fields`,
    presentationId: normalizePresentationId(selectionRecord, options),
    selections,
    slideId,
    slideRevision: normalizeSlideRevision(selectionRecord)
  };
}
