export function createSlug(value: unknown, fallback = "presentation"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);

  return slug || fallback;
}

export function createFileSlug(value: unknown, fallback: string): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/\.[^.]+$/u, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return slug || fallback;
}

export function normalizeCompactText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

export function normalizeTargetSlideCount(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(1, parsed);
}
