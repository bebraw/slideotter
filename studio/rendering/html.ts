export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

export function escapeHtml(value: unknown): string {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function editAttrs(path: string, label?: string): string {
  return ` data-edit-path="${escapeHtml(path)}" data-edit-label="${escapeHtml(label || path)}"`;
}

export function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function toFiniteNumberOr(value: unknown, fallback: number): number {
  return toFiniteNumber(value) ?? fallback;
}
