export namespace StudioClientSlideSpecPath {
  export type PathSegment = number | string;
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
    if (Array.isArray(path)) {
      return path.map((segment) => Number.isInteger(Number(segment)) && String(segment).trim() !== ""
        ? Number(segment)
        : String(segment));
    }

    return String(path || "")
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => Number.isInteger(Number(segment)) ? Number(segment) : segment);
  }

  export function pathToString(path: unknown): string {
    return (Array.isArray(path) ? path : pathToArray(path)).map(String).join(".");
  }

  function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map(canonicalJson).join(",")}]`;
    }

    if (isRecord(value)) {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    }

    return JSON.stringify(value);
  }

  export function hashFieldValue(value: unknown): string {
    let hash = 2166136261;
    const text = canonicalJson(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
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
