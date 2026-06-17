import { pathToString } from "./selection-path-format.ts";
import { asRecord } from "./selection-records.ts";
import {
  selectionLabelFromPath,
  type SelectionEntry
} from "./selection-normalization.ts";

export function getSelectionEntries(scope: unknown): SelectionEntry[] {
  const scopeRecord = asRecord(scope);
  if (!Object.keys(scopeRecord).length) {
    return [];
  }

  return scopeRecord.kind === "selectionGroup"
    ? Array.isArray(scopeRecord.selections) ? scopeRecord.selections.map(asRecord).filter((entry): entry is SelectionEntry => Array.isArray(entry.fieldPath)) : []
    : Array.isArray(scopeRecord.fieldPath) ? [scopeRecord as SelectionEntry] : [];
}

export function describeSelectionScope(scope: unknown): string {
  const scopeRecord = asRecord(scope);
  if (!scope) {
    return "Current slide";
  }

  if (scopeRecord.kind === "selectionGroup") {
    return "Selected fields";
  }

  const entry = getSelectionEntries(scope)[0];
  const path = pathToString(entry && entry.fieldPath);
  const label = entry && entry.label ? entry.label : selectionLabelFromPath(path);
  return /body|summary|quote|title|note|caption/i.test(label)
    ? `Selected ${label}`
    : "Selected text";
}
