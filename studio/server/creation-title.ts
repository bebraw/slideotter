type JsonObject = Record<string, unknown>;

type TitleSource = JsonObject & {
  objective?: unknown;
  slides?: Array<JsonObject & { title?: unknown }>;
  thesis?: unknown;
  title?: unknown;
};

function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function trimTitle(value: unknown): string {
  return compactText(value)
    .replace(/[.。!?]+$/g, "")
    .slice(0, 96)
    .trim();
}

function inferCreationTitle(fields: TitleSource = {}, deckPlan: TitleSource = {}, fallback = "Untitled presentation"): string {
  const slides = Array.isArray(deckPlan.slides) ? deckPlan.slides : [];
  const firstSlide = slides.find((slide) => slide && typeof slide === "object" && !Array.isArray(slide));
  const candidates = [
    fields.title,
    deckPlan.title,
    deckPlan.thesis,
    firstSlide && firstSlide.title,
    fields.objective
  ];

  for (const candidate of candidates) {
    const title = trimTitle(candidate);
    if (title) {
      return title;
    }
  }

  return fallback;
}

function hasCreationBrief(fields: TitleSource = {}): boolean {
  return [
    fields.title,
    fields.objective,
    fields.audience,
    fields.constraints,
    fields.presentationSourceText,
    fields.presentationSourceUrls,
    fields.themeBrief
  ].some((value) => Boolean(compactText(value)));
}

export {
  hasCreationBrief,
  inferCreationTitle
};
