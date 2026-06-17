import { canonicalJson, hashFieldValue } from "./selection-hash.ts";
import { getSelectionEntries } from "./selection-entries.ts";
import {
  pathToString,
  type FieldPath
} from "./selection-path-format.ts";
import { getPathValue, pathStartsWith } from "./selection-path-values.ts";
import { asRecord } from "./selection-records.ts";
import { normalizeText } from "./selection-normalization.ts";

export function assertSelectionAnchorsCurrent(slideSpec: unknown, scope: unknown): void {
  getSelectionEntries(scope).forEach((entry) => {
    const currentValue = getPathValue(slideSpec, entry.fieldPath);
    if (currentValue === undefined) {
      throw new Error(`Selection target no longer exists: ${pathToString(entry.fieldPath)}`);
    }

    const currentHash = hashFieldValue(currentValue);
    if (entry.fieldHash && currentHash !== entry.fieldHash) {
      throw new Error("Selection target changed after candidate generation. Regenerate or rebase before applying.");
    }

    if (entry.anchorText && typeof currentValue === "string" && !normalizeText(currentValue, 5000).includes(entry.anchorText)) {
      throw new Error("Selection anchor no longer matches the current slide field.");
    }
  });
}

function collectChangedPaths(before: unknown, after: unknown, basePath: FieldPath = []): FieldPath[] {
  if (canonicalJson(before) === canonicalJson(after)) {
    return [];
  }

  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    return [basePath];
  }

  const beforeRecord = asRecord(before);
  const afterRecord = asRecord(after);
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  return [...keys].flatMap((key) => collectChangedPaths(beforeRecord[key], afterRecord[key], [...basePath, Number.isInteger(Number(key)) ? Number(key) : key]));
}

export function assertPatchWithinSelectionScope(before: unknown, after: unknown, scope: unknown): void {
  const allowedPaths = getSelectionEntries(scope).map((entry) => entry.fieldPath);
  const changedPaths = collectChangedPaths(before, after);
  const outside = changedPaths.filter((path) => !allowedPaths.some((allowed) => pathStartsWith(path, allowed)));

  if (outside.length) {
    throw new Error(`Selection-scoped candidate changed fields outside its scope: ${outside.map(pathToString).join(", ")}`);
  }
}
