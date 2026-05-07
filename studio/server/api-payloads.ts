export type JsonObject = Record<string, unknown>;

export type SlideSpecPayload = JsonObject & {
  layout?: unknown;
  media?: JsonObject;
  type?: unknown;
};

export type ImageSearchPayload = JsonObject & {
  count?: unknown;
  provider?: unknown;
  query?: unknown;
  restrictions?: unknown;
};

export type CreationFields = JsonObject & {
  imageSearch: {
    count: unknown;
    provider: unknown;
    query: string;
    restrictions: string;
  };
  lang: string;
  presentationSourceUrls: string;
  presentationSourceText: string;
  targetSlideCount: unknown;
  title: string;
  visualTheme: JsonObject;
};

export type SourcePayload = JsonObject & {
  text?: unknown;
  title?: unknown;
  url?: unknown;
};

export type DeckPlanSlide = JsonObject & {
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  sourceNotes?: unknown;
  sourceText?: unknown;
  title?: unknown;
  type?: unknown;
  value?: unknown;
  visualNeed?: unknown;
};

export type DeckPlanPayload = JsonObject & {
  narrativeArc?: unknown;
  outline?: unknown;
  slides?: DeckPlanSlide[];
  thesis?: unknown;
};

export type OutlinePlanPayload = JsonObject & {
  archivedAt?: unknown;
  audience?: unknown;
  name?: unknown;
  objective?: unknown;
  purpose?: unknown;
  tone?: unknown;
};

export function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function jsonObjectOrEmpty(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

export function isSlideSpecPayload(value: unknown): value is SlideSpecPayload {
  return isJsonObject(value);
}

export function isImageSearchPayload(value: unknown): value is ImageSearchPayload {
  return isJsonObject(value);
}

export function isSourcePayload(value: unknown): value is SourcePayload {
  return isJsonObject(value);
}

export function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
  return isJsonObject(value);
}

export function isDeckPlanPayload(value: unknown): value is DeckPlanPayload {
  return isJsonObject(value);
}

export function deckPlanSlides(plan: unknown): DeckPlanSlide[] {
  return isDeckPlanPayload(plan) && Array.isArray(plan.slides)
    ? plan.slides.filter(isDeckPlanSlide)
    : [];
}

export function isOutlinePlanPayload(value: unknown): value is OutlinePlanPayload {
  return isJsonObject(value);
}

export function isVisualThemePayload(value: unknown): value is JsonObject {
  return isJsonObject(value);
}

export function normalizeCreationFields(body: JsonObject = {}): CreationFields {
  const fields = body;
  const imageSearch = isImageSearchPayload(fields.imageSearch) ? fields.imageSearch : null;
  const targetSlideCount = fields.targetSlideCount || fields.targetCount || null;

  return {
    audience: String(fields.audience || "").trim(),
    constraints: String(fields.constraints || "").trim(),
    imageSearch: imageSearch
      ? {
          count: imageSearch.count || 3,
          provider: imageSearch.provider || "openverse",
          query: String(imageSearch.query || "").trim(),
          restrictions: String(imageSearch.restrictions || "").trim()
        }
      : {
          count: 3,
          provider: "openverse",
          query: "",
          restrictions: ""
    },
    lang: String(fields.lang || fields.presentationLanguage || "").trim(),
    objective: String(fields.objective || "").trim(),
    presentationSourceUrls: String(fields.presentationSourceUrls || "").trim(),
    presentationSourceText: String(fields.presentationSourceText || "").trim(),
    sourcingStyle: typeof fields.sourcingStyle === "string" && ["compact-references", "inline-notes", "none"].includes(fields.sourcingStyle)
      ? fields.sourcingStyle
      : "none",
    targetSlideCount,
    themeBrief: String(fields.themeBrief || "").trim(),
    title: String(fields.title || "").trim(),
    tone: String(fields.tone || "").trim(),
    visualTheme: isJsonObject(fields.visualTheme) ? fields.visualTheme : {}
  };
}
