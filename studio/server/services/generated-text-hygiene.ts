const danglingTailWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "through",
  "to",
  "when",
  "where",
  "while",
  "with",
  "within",
  "without"
]);

export function normalizeVisibleText(value: unknown): string {
  return String(value || "")
    .replace(/…/g, "")
    .replace(/\.{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function trimWords(value: unknown, limit = 12): string {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  const trimmed = words.slice(0, limit);
  while (trimmed.length > 4) {
    const tail = String(trimmed[trimmed.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
    if (!danglingTailWords.has(tail)) {
      break;
    }

    trimmed.pop();
  }

  return trimmed.join(" ").replace(/[,:;]$/g, "");
}

export function sentence(value: unknown, fallback: unknown, limit = 14): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return trimWords(normalized || fallback, limit);
}

export function isWeakLabel(value: unknown): boolean {
  return /^(summary|title:?|key point|point|item|slide|section|role|body|n\/a|none)$/i.test(String(value || "").trim());
}

export function isScaffoldLeak(value: unknown): boolean {
  const text = String(value || "").trim();
  return /^(guardrails|key points|sources to verify)$/i.test(text)
    || /^(?:opening|cover|title|closing|summary|content|divider|reference|photo|image) slide with\b/i.test(text)
    || /refine constraints before expanding the deck/i.test(text)
    || /\buse this slide as (?:the )?(?:opening frame|closing handoff|section divider|reference slide)\b/i.test(text)
    || /\bfor the presentation sequence\b/i.test(text);
}

export function isUnsupportedBibliographicClaim(value: unknown): boolean {
  return /\b(et al\.|journal|proceedings|doi:|isbn)\b/i.test(String(value || "")) && !/https?:\/\//.test(String(value || ""));
}

export function hasDanglingEnding(value: unknown): boolean {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    return false;
  }

  const tail = String(words[words.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
  return danglingTailWords.has(tail);
}

export function cleanText(value: unknown): string {
  const normalized = normalizeVisibleText(value)
    .replace(/\b(title|summary|body):\s*$/i, "")
    .trim();

  return isUnsupportedBibliographicClaim(normalized) ? "" : normalized;
}

export function requireVisibleText(value: unknown, fieldName: string): string {
  const text = cleanText(value);
  if (text && !isWeakLabel(text)) {
    return text;
  }

  throw new Error(`Generated presentation plan is missing usable ${fieldName}.`);
}
