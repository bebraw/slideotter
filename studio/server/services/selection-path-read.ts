import { asRecord } from "./selection-records.ts";
import {
  pathToArray,
  type PathSegment
} from "./selection-path-format.ts";

export function getIndexedValue(value: unknown, segment: PathSegment): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) && typeof segment === "number") {
    return value[segment];
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return asRecord(value)[String(segment)];
  }

  return undefined;
}

export function getPathValue(value: unknown, path: unknown): unknown {
  return pathToArray(path).reduce((current, segment) => {
    return getIndexedValue(current, segment);
  }, value);
}

export function pathStartsWith(path: unknown, prefix: unknown): boolean {
  const left = pathToArray(path);
  const right = pathToArray(prefix);
  return right.length <= left.length && right.every((segment, index) => String(segment) === String(left[index]));
}
