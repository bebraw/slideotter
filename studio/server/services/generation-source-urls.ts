type GenerationSourceFields = {
  audience?: unknown;
  constraints?: unknown;
  objective?: unknown;
  outline?: unknown;
  sourceSnippets?: Array<{ url?: unknown }> | undefined;
  themeBrief?: unknown;
  title?: unknown;
};

function extractUrls(value: unknown): string[] {
  return String(value || "").match(/https?:\/\/[^\s),\]]+/g) || [];
}

export function collectProvidedUrls(fields: GenerationSourceFields = {}): string[] {
  const sourceUrls = Array.isArray(fields.sourceSnippets)
    ? fields.sourceSnippets.map((snippet) => snippet && snippet.url).filter(Boolean)
    : [];

  return [
    fields.title,
    fields.audience,
    fields.objective,
    fields.constraints,
    fields.themeBrief,
    fields.outline,
    ...sourceUrls
  ].flatMap(extractUrls);
}
