export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((entry: unknown): entry is JsonRecord => asRecord(entry) === entry)
    : [];
}

export function trimWords(value: unknown, limit = 12): string {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }

  const words = source.split(/\s+/);
  if (words.length <= limit) {
    return words.join(" ");
  }

  return `${words.slice(0, limit).join(" ")}...`;
}

export function compactSentence(value: unknown, fallback: unknown, limit = 14): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return trimWords(normalized || fallback, limit);
}

export function normalizeSentence(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
}
