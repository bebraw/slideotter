export function trimWords(value: unknown, limit = 12): string {
  const words = String(value || "").match(/\S+/g) || [];
  if (words.length <= limit) {
    return words.join(" ");
  }

  return `${words.slice(0, limit).join(" ")}...`;
}

export function compactSentence(value: unknown, fallback: unknown, limit = 14): string {
  const normalized = normalizeSentence(value);
  return trimWords(normalized || fallback, limit);
}

export function normalizeSentence(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
}
