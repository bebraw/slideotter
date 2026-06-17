import { normalizeGeneratedSlideType, normalizePlanRole } from "./generated-plan-repair.ts";
import { cleanText, isAuthoringMetaText, isScaffoldLeak, isWeakLabel, normalizeVisibleText } from "./generated-text-hygiene.ts";
import type { GeneratedPlan, GeneratedPlanSlide, JsonObject, SlideItem, TextPoint } from "./generated-slide-types.ts";

type GenerationMaterializationOptions = {
  startIndex?: unknown;
  totalSlides?: unknown;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isGeneratedPlanSlide(value: unknown): value is GeneratedPlanSlide {
  return isJsonObject(value);
}

function isSlideItem(value: unknown): value is SlideItem {
  return isJsonObject(value);
}

function planSlideSignature(planSlide: GeneratedPlanSlide): string {
  const keyPoints = Array.isArray(planSlide.keyPoints) ? planSlide.keyPoints : [];
  return normalizeVisibleText([
    planSlide && planSlide.title,
    planSlide && planSlide.summary,
    ...keyPoints.flatMap((point: TextPoint) => [point && point.title, point && point.body])
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function firstUsefulItemTitle(items: unknown): string {
  return (Array.isArray(items) ? items : [])
    .filter(isSlideItem)
    .map((item) => cleanText(item && item.title))
    .find((title) => title && !isWeakLabel(title) && !isScaffoldLeak(title) && !isAuthoringMetaText(title)) || "";
}

function firstUsefulItemBody(items: unknown): string {
  return (Array.isArray(items) ? items : [])
    .filter(isSlideItem)
    .map((item) => cleanText(item && item.body))
    .find((body) => body && !isWeakLabel(body) && !isScaffoldLeak(body) && !isAuthoringMetaText(body)) || "";
}

function firstVisiblePlanValue(...values: unknown[]): string {
  for (const value of values) {
    const normalized = cleanText(value);
    if (normalized && !isWeakLabel(normalized) && !isScaffoldLeak(normalized) && !isAuthoringMetaText(normalized)) {
      return normalized;
    }
  }

  return "";
}

export function isGenericPlanSummary(value: unknown): boolean {
  return /^(opening frame|section divider|concrete example slide|closing handoff|handoff slide|reference slide|concept slide|context slide|mechanics slide|tradeoff slide)\b/i.test(String(value || "").trim())
    || /\bslide that shows how\b/i.test(String(value || ""));
}

export function completePlanSlideFields(planSlide: GeneratedPlanSlide, index: number, total: number): GeneratedPlanSlide {
  const next = { ...planSlide };
  const role = normalizePlanRole(next.role, index, total);
  const firstPointTitle = firstUsefulItemTitle(next.keyPoints);
  const firstPointBody = firstUsefulItemBody(next.keyPoints);
  const firstGuardrailTitle = firstUsefulItemTitle(next.guardrails);
  const firstResourceTitle = firstUsefulItemTitle(next.resources);
  const title = cleanText(next.title);

  next.role = role;
  if (!title || isWeakLabel(title) || isScaffoldLeak(title)) {
    next.title = firstVisiblePlanValue(
      next.summary,
      firstPointTitle,
      firstGuardrailTitle,
      firstResourceTitle,
      next.note,
      next.intent
    ) || title;
  }
  next.eyebrow = firstVisiblePlanValue(next.eyebrow, next.section, next.label);
  next.note = firstVisiblePlanValue(
    next.note,
    next.speakerNote,
    next.speakerNotes,
    next.summary,
    next.title
  );
  if (!cleanText(next.summary) || isGenericPlanSummary(next.summary) || isScaffoldLeak(next.summary)) {
    next.summary = firstVisiblePlanValue(
      firstPointBody,
      next.intent,
      next.note,
      next.title
    );
  }
  next.signalsTitle = firstVisiblePlanValue(next.signalsTitle, next.keyPointsTitle, firstPointTitle, "Signals");
  next.guardrailsTitle = firstVisiblePlanValue(next.guardrailsTitle, next.guardrailTitle, firstGuardrailTitle, "Checks");
  next.resourcesTitle = firstVisiblePlanValue(next.resourcesTitle, next.resourceTitle, firstResourceTitle, "Next");
  next.mediaMaterialId = typeof next.mediaMaterialId === "string" ? next.mediaMaterialId : "";
  next.type = normalizeGeneratedSlideType(next.type);

  return next;
}

export function normalizePlanForMaterialization(plan: GeneratedPlan, options: GenerationMaterializationOptions = {}): GeneratedPlan {
  const rawSlides = Array.isArray(plan.slides) ? plan.slides.filter(isGeneratedPlanSlide) : [];
  const total = Number.isFinite(Number(options.totalSlides)) ? Number(options.totalSlides) : rawSlides.length;
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Number(options.startIndex) : 0;
  const seenSignatures = new Set<string>();
  const slides = rawSlides.map((slide: GeneratedPlanSlide, index: number) => {
    const role = normalizePlanRole(slide && slide.role, startIndex + index, total);
    const nextSlide = {
      ...slide,
      role
    };
    const signature = planSlideSignature(nextSlide);

    if (signature && seenSignatures.has(signature)) {
      throw new Error(`Generated presentation plan repeats slide ${index + 1}; retry generation instead of injecting fallback copy.`);
    }

    if (signature) {
      seenSignatures.add(signature);
    }

    return nextSlide;
  });

  return {
    ...plan,
    slides
  };
}
