export type PathSegment = string | number;
export type FieldPath = PathSegment[];

export function pathToArray(path: unknown): FieldPath {
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
  return pathToArray(path).map(String).join(".");
}
