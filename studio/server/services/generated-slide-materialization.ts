import { completePlanSlideFields, isGenericPlanSummary, normalizePlanForMaterialization } from "./generated-slide-plan-normalization.ts";
import { resolvePhotoGridMaterialSet, resolvePlanSlideMedia } from "./generated-slide-media.ts";
import { cleanText, isAuthoringMetaText, isScaffoldLeak, isWeakLabel, requireVisibleText, sentence } from "./generated-text-hygiene.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import type { MaterialCandidate } from "./generated-materials.ts";
import type { GeneratedPlan, GeneratedPlanSlide, GeneratedReference, GeneratedSlideSpec, JsonObject, TextPoint } from "./generated-slide-types.ts";
import type { MaterialMedia } from "./generated-slide-media.ts";

type SlideSpecObject = JsonObject;

type NormalizedPoint = {
  body: string;
  title: string;
};

type VisibleTextBoundary = {
  internalTexts: string[];
};

const defaultCardTitleWordLimit = 8;
const defaultCardBodyWordLimit = 14;

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
};

export type GenerationFieldsForMaterialization = ProgressOptions & JsonObject & {
  audience?: unknown;
  constraints?: unknown;
  materialCandidates?: MaterialCandidate[] | undefined;
  objective?: unknown;
  outline?: unknown;
  sourceSnippets?: Array<{ url?: unknown }> | undefined;
  title?: unknown;
};

export type GenerationMaterializationOptions = ProgressOptions & {
  startIndex?: unknown;
  totalSlides?: unknown;
  usedMaterialIds?: Set<string>;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTextPoint(value: unknown): value is TextPoint {
  return isJsonObject(value);
}

function normalizeBoundaryText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collectBoundaryText(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const normalized = normalizeBoundaryText(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectBoundaryText);
  }

  if (isJsonObject(value)) {
    return Object.values(value).flatMap(collectBoundaryText);
  }

  return [];
}

function createVisibleTextBoundary(planSlide: GeneratedPlanSlide): VisibleTextBoundary {
  const internalFieldNames: Array<keyof GeneratedPlanSlide> = [
    "intent",
    "sourceNeed",
    "sourceNeeds",
    "speakerNote",
    "speakerNotes",
    "value",
    "visualNeed",
    "visualNeeds"
  ];
  const internalTexts = uniqueBy(
    internalFieldNames.flatMap((fieldName) => collectBoundaryText(planSlide[fieldName]))
      .filter((text) => text.split(/\s+/).length >= 4),
    (text) => text
  );

  return { internalTexts };
}

function isInternalPlanningText(value: unknown, boundary: VisibleTextBoundary): boolean {
  const normalized = normalizeBoundaryText(value);
  if (!normalized || normalized.split(/\s+/).length < 4) {
    return false;
  }

  return boundary.internalTexts.some((internalText) => internalText === normalized || internalText.startsWith(`${normalized} `));
}

function isUsableVisibleText(value: unknown, boundary: VisibleTextBoundary): boolean {
  return Boolean(value)
    && !isWeakLabel(value)
    && !isScaffoldLeak(value)
    && !isAuthoringMetaText(value)
    && !isInternalPlanningText(value, boundary);
}

function validateSlideSpecObject<T extends SlideSpecObject>(spec: T): T {
  const validated = validateSlideSpec(spec);
  return isJsonObject(validated) ? { ...spec, ...validated } : spec;
}

function slugPart(value: unknown, fallback = "item"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return slug || fallback;
}

function extractUrls(value: unknown): string[] {
  return String(value || "").match(/https?:\/\/[^\s),\]]+/g) || [];
}

function collectProvidedUrls(fields: GenerationFieldsForMaterialization = {}): string[] {
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

function uniqueBy<T>(values: T[], getKey: (value: T) => unknown): T[] {
  const seen = new Set<unknown>();
  const result: T[] = [];

  values.forEach((value) => {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(value);
  });

  return result;
}

function pointTitleText(point: TextPoint | null | undefined, fieldName: string, index: number, body: string, boundary: VisibleTextBoundary): string {
  const title = cleanText(point && point.title);
  if (isUsableVisibleText(title, boundary)) {
    return title;
  }

  const derived = sentence(body, body, 4);
  if (isUsableVisibleText(derived, boundary)) {
    return derived;
  }

  throw new Error(`Generated presentation plan is missing usable ${fieldName}[${index}].title.`);
}

function normalizeAllGeneratedPoints(points: unknown, fieldName: string, boundary: VisibleTextBoundary): NormalizedPoint[] {
  const normalized = Array.isArray(points)
    ? points.filter(isTextPoint).flatMap((point: TextPoint, index: number) => {
      const body = requireVisibleText(point && point.body, `${fieldName}[${index}].body`);
      if (isScaffoldLeak(body) || isAuthoringMetaText(body) || isInternalPlanningText(body, boundary)) {
        return [];
      }
      const title = pointTitleText(point, fieldName, index, body, boundary);
      return [{ body, title }];
    })
    : [];
  return uniqueBy(normalized, (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`);
}

function normalizeGeneratedPoints(points: unknown, count: number, fieldName: string, boundary: VisibleTextBoundary): NormalizedPoint[] {
  const unique = normalizeAllGeneratedPoints(points, fieldName, boundary);

  if (unique.length < count) {
    throw new Error(`Generated presentation plan needs ${count} distinct ${fieldName} items in the deck language.`);
  }

  return unique.slice(0, count);
}

function normalizedPointsOrEmpty(points: unknown, fieldName: string, boundary: VisibleTextBoundary): NormalizedPoint[] {
  try {
    return normalizeAllGeneratedPoints(points, fieldName, boundary);
  } catch (_error) {
    return [];
  }
}

function fillGeneratedPoints(points: NormalizedPoint[], fallbackPoints: NormalizedPoint[], count: number): NormalizedPoint[] {
  return uniqueBy([...points, ...fallbackPoints], (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`)
    .slice(0, count);
}

function fallbackGuardrailPoints(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): NormalizedPoint[] {
  const keyPoints = normalizedPointsOrEmpty(planSlide.keyPoints, "keyPoints", boundary);
  const summary = cleanText(planSlide.summary);
  const slideTitle = cleanText(planSlide.title);

  return keyPoints.slice(0, 3).map((point, index) => {
    const anchor = sentence(point.title || point.body, point.body, 6);
    const fallbackBody = sentence([
      anchor,
      slideTitle,
      summary
    ].filter(Boolean).join(" keeps grounded in "), point.body, defaultCardBodyWordLimit);

    return {
      body: fallbackBody,
      title: ["Scope", "Evidence", "Action"][index] || anchor
    };
  });
}

function contentGuardrailPoints(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): NormalizedPoint[] {
  const guardrails = normalizedPointsOrEmpty(planSlide.guardrails, "guardrails", boundary);
  if (guardrails.length >= 3) {
    return guardrails.slice(0, 3);
  }

  const fallbackPoints = fallbackGuardrailPoints(planSlide, boundary);
  const filled = fillGeneratedPoints(guardrails, fallbackPoints, 3);
  if (filled.length < 3) {
    throw new Error("Generated presentation plan needs 3 distinct guardrails items in the deck language.");
  }

  return filled;
}

function toCards(planSlide: GeneratedPlanSlide, prefix: string, count: number, boundary: VisibleTextBoundary, fieldName: "guardrails" | "keyPoints" | "resources" = "keyPoints"): NormalizedPoint[] {
  return normalizeGeneratedPoints(planSlide[fieldName], count, fieldName, boundary)
    .map((point, index) => {
      const body = sentence(point.body, point.body, defaultCardBodyWordLimit);
      const rawTitle = sentence(point.title, point.title, defaultCardTitleWordLimit);
      const title = isWeakLabel(rawTitle) || isScaffoldLeak(rawTitle) || isInternalPlanningText(rawTitle, boundary)
        ? sentence(body, body, defaultCardTitleWordLimit)
        : rawTitle;
      return {
        body,
        id: `${prefix}-${index + 1}`,
        title
      };
    });
}

function planFieldText(planSlide: GeneratedPlanSlide, fieldName: keyof GeneratedPlanSlide, limit: number, boundary: VisibleTextBoundary): string {
  const text = requireVisibleText(planSlide && planSlide[fieldName], fieldName);
  if (isScaffoldLeak(text) || isAuthoringMetaText(text) || isInternalPlanningText(text, boundary)) {
    const repaired = scaffoldFieldText(planSlide, fieldName, boundary);
    if (repaired) {
      return sentence(repaired, repaired, limit);
    }

    const fallback = fallbackPlanFieldText(planSlide, fieldName, boundary);
    if (fallback) {
      return sentence(fallback, fallback, limit);
    }

    throw new Error(`Generated presentation plan contains internal planning text in ${fieldName}.`);
  }

  return sentence(text, text, limit);
}

function fallbackPlanFieldText(planSlide: GeneratedPlanSlide, fieldName: keyof GeneratedPlanSlide, boundary: VisibleTextBoundary): string {
  const firstPointBody = (Array.isArray(planSlide.keyPoints) ? planSlide.keyPoints : [])
    .map((item: TextPoint) => cleanText(item && item.body))
    .find((body: string) => isUsableVisibleText(body, boundary)) || "";
  const firstPointTitle = scaffoldFieldText(planSlide, "signalsTitle", boundary);
  const summary = cleanText(planSlide.summary);
  const title = cleanText(planSlide.title);
  const candidates = fieldName === "note"
    ? [firstPointBody, firstPointTitle, summary, title]
    : [firstPointTitle, firstPointBody, title];

  return candidates.find((candidate: string) => isUsableVisibleText(candidate, boundary)) || "";
}

function scaffoldFieldText(planSlide: GeneratedPlanSlide, fieldName: keyof GeneratedPlanSlide, boundary: VisibleTextBoundary): string {
  const items = fieldName === "guardrailsTitle"
    ? planSlide.guardrails
    : fieldName === "resourcesTitle"
      ? planSlide.resources
      : fieldName === "signalsTitle"
        ? planSlide.keyPoints
        : undefined;
  if (!Array.isArray(items)) {
    return "";
  }

  return items
    .map((item: TextPoint) => cleanText(item && item.title))
    .find((title: string) => isUsableVisibleText(title, boundary)) || "";
}

function planSummaryText(planSlide: GeneratedPlanSlide, limit: number, boundary: VisibleTextBoundary): string {
  const summary = cleanText(planSlide && planSlide.summary);
  if (summary && !isGenericPlanSummary(summary) && !isScaffoldLeak(summary) && !isAuthoringMetaText(summary) && !isInternalPlanningText(summary, boundary)) {
    return sentence(summary, summary, limit);
  }

  const fallback = fallbackPlanFieldText(planSlide, "summary", boundary);
  if (fallback) {
    return sentence(fallback, fallback, limit);
  }

  throw new Error("Generated presentation plan is missing a usable slide summary in the deck language.");
}

function planTitleText(planSlide: GeneratedPlanSlide, limit: number, boundary: VisibleTextBoundary): string {
  const title = cleanText(planSlide.title);
  if (isUsableVisibleText(title, boundary)) {
    return sentence(title, title, limit);
  }

  const fallback = fallbackPlanFieldText(planSlide, "title", boundary);
  if (fallback) {
    return sentence(fallback, fallback, limit);
  }

  throw new Error("Generated presentation plan is missing a usable slide title in the deck language.");
}

function toContentSlide(planSlide: GeneratedPlanSlide, index: number): SlideSpecObject {
  const boundary = createVisibleTextBoundary(planSlide);
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const secondaryPoints = contentGuardrailPoints(planSlide, boundary);

  return validateSlideSpecObject({
    eyebrow: planFieldText(planSlide, "eyebrow", 4, boundary),
    guardrails: secondaryPoints.map((point, guardrailIndex) => ({
      body: sentence(point.body, point.body, defaultCardBodyWordLimit),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point.title, point.title, defaultCardTitleWordLimit)
    })),
    guardrailsTitle: planFieldText(planSlide, "guardrailsTitle", 5, boundary),
    layout: planSlide.role === "mechanics" || planSlide.role === "example" ? "steps" : planSlide.role === "tradeoff" ? "checklist" : "standard",
    signals: toCards(planSlide, `${prefix}-signal`, 4, boundary),
    signalsTitle: planFieldText(planSlide, "signalsTitle", 4, boundary),
    summary: planSummaryText(planSlide, 14, boundary),
    title: planTitleText(planSlide, 8, boundary),
    type: "content"
  });
}

function toDividerSlide(planSlide: GeneratedPlanSlide): SlideSpecObject {
  const boundary = createVisibleTextBoundary(planSlide);
  return validateSlideSpecObject({
    title: planTitleText(planSlide, 8, boundary),
    type: "divider"
  });
}

function toPhotoGridSlide(planSlide: GeneratedPlanSlide, index: number, mediaItems: MaterialMedia[]): SlideSpecObject {
  const boundary = createVisibleTextBoundary(planSlide);
  return validateSlideSpecObject({
    caption: planSummaryText(planSlide, 14, boundary),
    mediaItems: mediaItems.slice(0, 3).map((media, mediaIndex) => ({
      ...media,
      caption: media.caption || sentence(planSlide.summary, planSlide.title, 14),
      title: sentence(media.alt || planSlide.title, planSlide.title, 6),
      id: media.id || `${slugPart(planSlide.title, `photo-grid-${index}`)}-${mediaIndex + 1}`
    })),
    summary: planSummaryText(planSlide, 14, boundary),
    title: planTitleText(planSlide, 8, boundary),
    type: "photoGrid"
  });
}

export function materializePlan(fields: GenerationFieldsForMaterialization, plan: GeneratedPlan, options: GenerationMaterializationOptions = {}): GeneratedSlideSpec[] {
  const normalizedPlan = normalizePlanForMaterialization(plan, options);
  const rawSlides = Array.isArray(normalizedPlan.slides) ? normalizedPlan.slides : [];
  const slideTotal = Number.isFinite(Number(options.totalSlides)) ? Number(options.totalSlides) : rawSlides.length;
  const startOffset = Number.isFinite(Number(options.startIndex)) ? Number(options.startIndex) : 0;
  const slides = rawSlides.map((planSlide, index) => completePlanSlideFields(planSlide, startOffset + index, slideTotal));
  const title = sentence(requireVisibleText(fields.title || (slides[0] && slides[0].title), "presentation title"), fields.title || (slides[0] && slides[0].title), 8);
  const total = slideTotal;
  const startIndex = startOffset;
  const materialCandidates = Array.isArray(fields.materialCandidates) ? fields.materialCandidates : [];
  const usedMaterialIds = options.usedMaterialIds instanceof Set ? options.usedMaterialIds : new Set<string>();
  const suppliedUrls = new Set(collectProvidedUrls(fields));
  const references = Array.isArray(normalizedPlan.references)
    ? normalizedPlan.references
      .filter((reference: GeneratedReference) => reference && suppliedUrls.has(String(reference.url || "").trim()))
      .slice(0, 2)
    : [];

  return slides.map((planSlide, index) => {
    const slideNumber = startIndex + index + 1;
    const isFirst = slideNumber === 1;
    const isLast = slideNumber === total && total > 1;
    const prefix = slugPart(planSlide.title, `slide-${slideNumber}`);
    const boundary = createVisibleTextBoundary(planSlide);

    if (isFirst) {
      const media = resolvePlanSlideMedia(planSlide, materialCandidates, usedMaterialIds);
      return validateSlideSpecObject({
        cards: toCards(planSlide, `${prefix}-card`, 3, boundary),
        eyebrow: planFieldText(planSlide, "eyebrow", 4, boundary),
        layout: "focus",
        ...(media ? { media } : {}),
        note: planFieldText(planSlide, "note", 14, boundary),
        summary: planSummaryText(planSlide, 14, boundary),
        title,
        type: "cover"
      });
    }

    if (isLast) {
      const media = resolvePlanSlideMedia(planSlide, materialCandidates, usedMaterialIds);
      const generatedResources = normalizeGeneratedPoints(planSlide.resources, 2, "resources", boundary);
      const referenceByUrl: Map<string, GeneratedReference> = new Map(references.map((reference: GeneratedReference) => [String(reference.url || "").trim(), reference]));
      const resourceItems = generatedResources.map((resource, resourceIndex) => {
        const matchingReference = referenceByUrl.get(String(resource.body || "").trim());

        return {
          body: matchingReference ? matchingReference.url : sentence(resource.body, resource.body, 18),
          id: `${prefix}-resource-${resourceIndex + 1}`,
          title: sentence(resource.title, matchingReference && matchingReference.title || resource.title, 5)
        };
      });

      return validateSlideSpecObject({
        bullets: toCards(planSlide, `${prefix}-bullet`, 3, boundary),
        eyebrow: planFieldText(planSlide, "eyebrow", 4, boundary),
        layout: "checklist",
        ...(media ? { media } : {}),
        resources: resourceItems.map((resource, resourceIndex) => ({
          body: sentence(resource.body, resource.body, 12),
          id: `${prefix}-resource-${resourceIndex + 1}`,
          title: sentence(resource.title, resource.title, 5)
        })),
        resourcesTitle: planFieldText(planSlide, "resourcesTitle", 5, boundary),
        summary: planSummaryText(planSlide, 14, boundary),
        title: planTitleText(planSlide, 8, boundary),
        type: "summary"
      });
    }

    if (planSlide.role === "divider") {
      return toDividerSlide(planSlide);
    }

    if (planSlide.type === "photoGrid") {
      const mediaItems = resolvePhotoGridMaterialSet(planSlide, materialCandidates);
      if (mediaItems.length >= 2) {
        return toPhotoGridSlide(planSlide, slideNumber, mediaItems);
      }
    }

    const media = resolvePlanSlideMedia(planSlide, materialCandidates, usedMaterialIds);
    return validateSlideSpecObject({
      ...toContentSlide(planSlide, slideNumber),
      ...(media ? { media } : {})
    });
  });
}
