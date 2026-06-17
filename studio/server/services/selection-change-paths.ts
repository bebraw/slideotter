import { canonicalJson } from "./selection-hash.ts";
import { asRecord } from "./selection-records.ts";
import type { FieldPath } from "./selection-path-format.ts";

function pathSegmentFromKey(key: string): string | number {
  return Number.isInteger(Number(key)) ? Number(key) : key;
}

export function collectChangedPaths(before: unknown, after: unknown, basePath: FieldPath = []): FieldPath[] {
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
  return [...keys].flatMap((key) => collectChangedPaths(beforeRecord[key], afterRecord[key], [...basePath, pathSegmentFromKey(key)]));
}
