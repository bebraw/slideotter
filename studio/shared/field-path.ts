export type PathSegment = string | number;
export type FieldPath = PathSegment[];

export function pathSegmentFromUnknown(segment: unknown): PathSegment {
  return Number.isInteger(Number(segment)) && String(segment).trim() !== ""
    ? Number(segment)
    : String(segment);
}

export function pathToArray(path: unknown): FieldPath {
  if (Array.isArray(path)) {
    return path.map(pathSegmentFromUnknown);
  }

  return String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(pathSegmentFromUnknown);
}

export function pathToString(path: unknown): string {
  return (Array.isArray(path) ? path : pathToArray(path)).map(String).join(".");
}
