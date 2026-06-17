import { asRecord } from "./selection-records.ts";
import {
  pathToArray,
  pathToString
} from "./selection-path-format.ts";
import { getIndexedValue } from "./selection-path-read.ts";

export { getPathValue, pathStartsWith } from "./selection-path-read.ts";

export function setPathValue(value: unknown, path: unknown, nextValue: unknown): unknown {
  const segments = pathToArray(path);
  if (!segments.length) {
    return nextValue;
  }

  const clone = JSON.parse(JSON.stringify(value));
  let target: unknown = clone;
  segments.slice(0, -1).forEach((segment) => {
    const nextTarget = getIndexedValue(target, segment);
    if (nextTarget === null || nextTarget === undefined) {
      throw new Error(`Cannot set unknown selection field: ${pathToString(path)}`);
    }

    target = nextTarget;
  });
  const finalSegment = segments[segments.length - 1];
  if (finalSegment === undefined) {
    return clone;
  }
  if (Array.isArray(target) && typeof finalSegment === "number") {
    target[finalSegment] = nextValue;
  } else if (target && typeof target === "object" && !Array.isArray(target)) {
    asRecord(target)[String(finalSegment)] = nextValue;
  } else {
    throw new Error(`Cannot set unknown selection field: ${pathToString(path)}`);
  }
  return clone;
}
