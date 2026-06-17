import {
  pathToArray as sharedPathToArray,
  pathToString as sharedPathToString,
  type PathSegment as SharedPathSegment
} from "../../shared/field-path.ts";
import { fnv1aHash } from "../../shared/stable-json-hash.ts";

export namespace StudioClientSlideSpecPath {
  export type PathSegment = SharedPathSegment;
  type JsonRecord = Record<string, unknown>;

  function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function readIndexedValue(container: unknown, segment: PathSegment): unknown {
    if (Array.isArray(container) && typeof segment === "number") {
      return container[segment];
    }
    if (isRecord(container)) {
      return container[String(segment)];
    }
    return undefined;
  }

  function writeIndexedValue(container: unknown, segment: PathSegment, value: unknown): void {
    if (Array.isArray(container) && typeof segment === "number") {
      container[segment] = value;
      return;
    }
    if (isRecord(container)) {
      container[String(segment)] = value;
      return;
    }
    throw new Error(`Cannot edit unknown slide field segment: ${segment}`);
  }

  export function pathToArray(path: unknown): PathSegment[] {
    return sharedPathToArray(path);
  }

  export function pathToString(path: unknown): string {
    return sharedPathToString(path);
  }

  export function hashFieldValue(value: unknown): string {
    return fnv1aHash(value);
  }

  export function getPathValue(slideSpec: unknown, path: unknown): unknown {
    return pathToArray(path).reduce<unknown>((current, segment) => {
      return readIndexedValue(current, segment);
    }, slideSpec);
  }

  export function cloneWithPath<T>(slideSpec: T, path: unknown, value: unknown): T {
    const nextSpec = JSON.parse(JSON.stringify(slideSpec)) as T;
    const segments = pathToArray(path);
    const field = segments.pop();
    const target = segments.reduce<unknown>((current, segment) => {
      if (current === null || current === undefined) {
        throw new Error(`Cannot edit unknown slide field: ${pathToString(path)}`);
      }

      return readIndexedValue(current, segment);
    }, nextSpec);

    if (!target || field === undefined) {
      throw new Error(`Cannot edit unknown slide field: ${pathToString(path)}`);
    }

    writeIndexedValue(target, field, value);
    return nextSpec;
  }
}
