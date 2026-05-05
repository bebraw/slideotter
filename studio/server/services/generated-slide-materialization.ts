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

function pointTitleText(point: TextPoint | null | undefined, fieldName: string, index: number, body: string): string {
  const title = cleanText(point && point.title);
  if (title && !isWeakLabel(title) && !isScaffoldLeak(title) && !isAuthoringMetaText(title)) {
    return title;
  }

  const derived = sentence(body, body, 4);
  if (derived && !isWeakLabel(derived) && !isScaffoldLeak(derived) && !isAuthoringMetaText(derived)) {
    return derived;
  }

  throw new Error(`Generated presentation plan is missing usable ${fieldName}[${index}].title.`);
}

function normalizeAllGeneratedPoints(points: unknown, fieldName: string): NormalizedPoint[] {
  const normalized = Array.isArray(points)
    ? points.filter(isTextPoint).flatMap((point: TextPoint, index: number) => {
      const body = requireVisibleText(point && point.body, `${fieldName}[${index}].body`);
      if (isScaffoldLeak(body) || isAuthoringMetaText(body)) {
        return [];
      }
      const title = pointTitleText(point, fieldName, index, body);
      return [{ body, title }];
    })
    : [];
  return uniqueBy(normalized, (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`);
}

function normalizeGeneratedPoints(points: unknown, count: number, fieldName: string): NormalizedPoint[] {
  const unique = normalizeAllGeneratedPoints(points, fieldName);

  if (unique.length < count) {
    throw new Error(`Generated presentation plan needs ${count} distinct ${fieldName} items in the deck language.`);
  }

  return unique.slice(0, count);
}

function normalizedPointsOrEmpty(points: unknown, fieldName: string): NormalizedPoint[] {
  try {
    return normalizeAllGeneratedPoints(points, fieldName);
  } catch (_error) {
    return [];
  }
}

function fillGeneratedPoints(points: NormalizedPoint[], fallbackPoints: NormalizedPoint[], count: number): NormalizedPoint[] {
  return uniqueBy([...points, ...fallbackPoints], (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`)
    .slice(0, count);
}

function contentGuardrailPoints(planSlide: GeneratedPlanSlide): NormalizedPoint[] {
  const guardrails = normalizedPointsOrEmpty(planSlide.guardrails, "guardrails");
  if (guardrails.length >= 3) {
    return guardrails.slice(0, 3);
  }

  const fallbackPoints = normalizedPointsOrEmpty(planSlide.keyPoints, "keyPoints")
    .map((point) => ({
      body: point.body,
      title: point.title
    }));
  const filled = fillGeneratedPoints(guardrails, fallbackPoints, 3);
  if (filled.length < 3) {
    throw new Error("Generated presentation plan needs 3 distinct guardrails items in the deck language.");
  }

  return filled;
}

function toCards(planSlide: GeneratedPlanSlide, prefix: string, count: number, fieldName: "guardrails" | "keyPoints" | "resources" = "keyPoints"): NormalizedPoint[] {
  return normalizeGeneratedPoints(planSlide[fieldName], count, fieldName)
    .map((point, index) => {
      const body = sentence(point.body, point.body, defaultCardBodyWordLimit);
      const rawTitle = sentence(point.title, point.title, defaultCardTitleWordLimit);
      const title = isWeakLabel(rawTitle) || isScaffoldLeak(rawTitle)
        ? sentence(body, body, defaultCardTitleWordLimit)
        : rawTitle;
      return {
        body,
        id: `${prefix}-${index + 1}`,
        title
      };
    });
}

function planFieldText(planSlide: GeneratedPlanSlide, fieldName: keyof GeneratedPlanSlide, limit: number): string {
  const text = requireVisibleText(planSlide && planSlide[fieldName], fieldName);
  if (isScaffoldLeak(text)) {
    const repaired = scaffoldFieldText(planSlide, fieldName);
    if (repaired) {
      return sentence(repaired, repaired, limit);
    }

    const fallback = fallbackPlanFieldText(planSlide, fieldName);
    if (fallback) {
      return sentence(fallback, fallback, limit);
    }

    throw new Error(`Generated presentation plan contains scaffold text in ${fieldName}.`);
  }

  return sentence(text, text, limit);
}

function fallbackPlanFieldText(planSlide: GeneratedPlanSlide, fieldName: keyof GeneratedPlanSlide): string {
  const firstPointBody = (Array.isArray(planSlide.keyPoints) ? planSlide.keyPoints : [])
    .map((item: TextPoint) => cleanText(item && item.body))
    .find((body: string) => body && !isWeakLabel(body) && !isScaffoldLeak(body) && !isAuthoringMetaText(body)) || "";
  const firstPointTitle = scaffoldFieldText(planSlide, "signalsTitle");
  const summary = cleanText(planSlide.summary);
  const title = cleanText(planSlide.title);
  const candidates = fieldName === "note"
    ? [firstPointBody, firstPointTitle, summary, title]
    : [firstPointTitle, firstPointBody, title];

  return candidates.find((candidate: string) => candidate && !isWeakLabel(candidate) && !isScaffoldLeak(candidate) && !isAuthoringMetaText(candidate)) || "";
}

function scaffoldFieldText(planSlide: GeneratedPlanSlide, fieldName: keyof GeneratedPlanSlide): string {
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
    .find((title: string) => title && !isWeakLabel(title) && !isScaffoldLeak(title) && !isAuthoringMetaText(title)) || "";
}

function planSummaryText(planSlide: GeneratedPlanSlide, limit: number): string {
  const summary = cleanText(planSlide && planSlide.summary);
  if (summary && !isGenericPlanSummary(summary) && !isScaffoldLeak(summary)) {
    return sentence(summary, summary, limit);
  }

  const fallback = fallbackPlanFieldText(planSlide, "summary");
  if (fallback) {
    return sentence(fallback, fallback, limit);
  }

  throw new Error("Generated presentation plan is missing a usable slide summary in the deck language.");
}

function toContentSlide(planSlide: GeneratedPlanSlide, index: number): SlideSpecObject {
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const secondaryPoints = contentGuardrailPoints(planSlide);

  return validateSlideSpecObject({
    eyebrow: planFieldText(planSlide, "eyebrow", 4),
    guardrails: secondaryPoints.map((point, guardrailIndex) => ({
      body: sentence(point.body, point.body, defaultCardBodyWordLimit),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point.title, point.title, defaultCardTitleWordLimit)
    })),
    guardrailsTitle: planFieldText(planSlide, "guardrailsTitle", 5),
    layout: planSlide.role === "mechanics" || planSlide.role === "example" ? "steps" : planSlide.role === "tradeoff" ? "checklist" : "standard",
    signals: toCards(planSlide, `${prefix}-signal`, 4),
    signalsTitle: planFieldText(planSlide, "signalsTitle", 4),
    summary: planSummaryText(planSlide, 14),
    title: sentence(planSlide.title, planSlide.title, 8),
    type: "content"
  });
}

function toDividerSlide(planSlide: GeneratedPlanSlide): SlideSpecObject {
  return validateSlideSpecObject({
    title: sentence(planSlide.title, planSlide.title, 8),
    type: "divider"
  });
}

function toPhotoGridSlide(planSlide: GeneratedPlanSlide, index: number, mediaItems: MaterialMedia[]): SlideSpecObject {
  return validateSlideSpecObject({
    caption: planSummaryText(planSlide, 14),
    mediaItems: mediaItems.slice(0, 3).map((media, mediaIndex) => ({
      ...media,
      caption: media.caption || sentence(planSlide.summary, planSlide.title, 14),
      title: sentence(media.alt || planSlide.title, planSlide.title, 6),
      id: media.id || `${slugPart(planSlide.title, `photo-grid-${index}`)}-${mediaIndex + 1}`
    })),
    summary: planSummaryText(planSlide, 14),
    title: sentence(planSlide.title, planSlide.title, 8),
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

    if (isFirst) {
      const media = resolvePlanSlideMedia(planSlide, materialCandidates, usedMaterialIds);
      return validateSlideSpecObject({
        cards: toCards(planSlide, `${prefix}-card`, 3),
        eyebrow: planFieldText(planSlide, "eyebrow", 4),
        layout: "focus",
        ...(media ? { media } : {}),
        note: planFieldText(planSlide, "note", 14),
        summary: planSummaryText(planSlide, 14),
        title,
        type: "cover"
      });
    }

    if (isLast) {
      const media = resolvePlanSlideMedia(planSlide, materialCandidates, usedMaterialIds);
      const generatedResources = normalizeGeneratedPoints(planSlide.resources, 2, "resources");
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
        bullets: toCards(planSlide, `${prefix}-bullet`, 3),
        eyebrow: planFieldText(planSlide, "eyebrow", 4),
        layout: "checklist",
        ...(media ? { media } : {}),
        resources: resourceItems.map((resource, resourceIndex) => ({
          body: sentence(resource.body, resource.body, 12),
          id: `${prefix}-resource-${resourceIndex + 1}`,
          title: sentence(resource.title, resource.title, 5)
        })),
        resourcesTitle: planFieldText(planSlide, "resourcesTitle", 5),
        summary: planSummaryText(planSlide, 14),
        title: sentence(planSlide.title, planSlide.title, 8),
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
