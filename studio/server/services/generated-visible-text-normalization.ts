function normalizeVisibleText(value: unknown): string {
  return String(value || "")
    .replace(/…/g, "")
    .replace(/\.{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export {
  normalizeVisibleText
};
