import { asRecord } from "./selection-records.ts";
import {
  pathToArray,
  pathToString,
  type PathSegment
} from "./selection-path-format.ts";

function getIndexedValue(value: unknown, segment: PathSegment): unknown {
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

export function pathStartsWith(path: unknown, prefix: unknown): boolean {
  const left = pathToArray(path);
  const right = pathToArray(prefix);
  return right.length <= left.length && right.every((segment, index) => String(segment) === String(left[index]));
}
