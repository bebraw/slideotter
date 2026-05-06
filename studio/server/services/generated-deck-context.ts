import { normalizeGeneratedSlideType } from "./generated-plan-repair.ts";
import { cleanText } from "./generated-text-hygiene.ts";
import { isDeckPlanSlide } from "./generated-deck-plan-validation.ts";
import type { DeckPlan, DeckPlanSlide } from "./generated-deck-plan-validation.ts";
import type { GeneratedPlan, GeneratedPlanSlide, GeneratedSlideSpec, JsonObject, TextPoint } from "./generated-slide-types.ts";

type DeckSequenceOptions = {
  targetIndex?: unknown;
};

function isGeneratedPlanSlide(value: unknown): value is GeneratedPlanSlide {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function slideIdForIndex(index: number): string {
  return `slide-${String(index + 1).padStart(2, "0")}`;
}

export function filterGeneratedPlanSlides(value: unknown): GeneratedPlanSlide[] {
  return Array.isArray(value) ? value.filter(isGeneratedPlanSlide) : [];
}

export function createGeneratedSlideContexts(slideSpecs: GeneratedSlideSpec[], plan: GeneratedPlan, deckPlan: DeckPlan): JsonObject {
  const planSlides = filterGeneratedPlanSlides(plan.slides);
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];

  return Object.fromEntries(slideSpecs.map((slideSpec: GeneratedSlideSpec, index: number) => {
    const planSlide = planSlides[index] || {};
    const deckPlanSlide = deckPlanSlides[index] || {};
    const keyPoints = Array.isArray(planSlide.keyPoints) ? planSlide.keyPoints : [];
    const mustInclude = keyPoints
      .map((point: TextPoint) => [point && point.title, point && point.body].filter(Boolean).join(": "))
      .filter(Boolean)
      .slice(0, 4)
      .join("\n");

    return [slideIdForIndex(index), {
      intent: cleanText(deckPlanSlide.intent || planSlide.summary || deckPlanSlide.keyMessage || slideSpec.summary || ""),
      layoutHint: cleanText(deckPlanSlide.visualNeed || `Use the ${slideSpec.type} family to keep the slide readable.`),
      mustInclude: cleanText(deckPlanSlide.keyMessage || mustInclude || planSlide.summary || slideSpec.summary || ""),
      notes: cleanText(planSlide.note || deckPlanSlide.sourceNeed || ""),
      title: cleanText(planSlide.title || slideSpec.title || deckPlanSlide.title || ""),
      value: cleanText(deckPlanSlide.value || "")
    }];
  }));
}

export function createDeckSequenceMap(deckPlan: DeckPlan, options: DeckSequenceOptions = {}): JsonObject {
  const slides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];
  const targetIndex = Number.isFinite(Number(options.targetIndex)) ? Number(options.targetIndex) : null;
  return {
    narrativeArc: cleanText(deckPlan.narrativeArc || ""),
    slideCount: slides.length,
    slides: slides.map((slide: DeckPlanSlide, index: number) => ({
      index: index + 1,
      intent: cleanText(slide.intent || ""),
      keyMessage: cleanText(slide.keyMessage || ""),
      role: cleanText(slide.role || ""),
      sourceNotes: cleanText(slide.sourceNotes || slide.sourceNeed || ""),
      target: targetIndex === index,
      title: cleanText(slide.title || ""),
      value: cleanText(slide.value || ""),
      type: normalizeGeneratedSlideType(slide.type)
    }))
  };
}

export function createSingleSlidePromptContext(fullDeckPlan: DeckPlan, slideIndex: number, slideCount: number): JsonObject {
  const slides = Array.isArray(fullDeckPlan.slides) ? fullDeckPlan.slides.filter(isDeckPlanSlide) : [];
  const previous = slideIndex > 0 ? slides[slideIndex - 1] || null : null;
  const target = slides[slideIndex] || {};
  const next = slideIndex + 1 < slides.length ? slides[slideIndex + 1] || null : null;
  const summarize = (slide: DeckPlanSlide | null, index: number) => slide
    ? {
        index: index + 1,
        intent: cleanText(slide.intent || ""),
        keyMessage: cleanText(slide.keyMessage || ""),
        role: cleanText(slide.role || ""),
        sourceNotes: cleanText(slide.sourceNotes || slide.sourceNeed || ""),
        title: cleanText(slide.title || ""),
        value: cleanText(slide.value || ""),
        type: normalizeGeneratedSlideType(slide.type)
      }
    : null;

  return {
    narrativeArc: cleanText(fullDeckPlan.narrativeArc || ""),
    next: summarize(next, slideIndex + 1),
    previous: summarize(previous, slideIndex - 1),
    sequence: createDeckSequenceMap(fullDeckPlan, { targetIndex: slideIndex }),
    target: summarize(target, slideIndex),
    totalSlides: slideCount
  };
}

export function createDraftedSlidePromptContext(slideSpecs: GeneratedSlideSpec[]): JsonObject[] {
  return slideSpecs.slice(-2).map((slideSpec: GeneratedSlideSpec, index: number) => {
    const visibleItems = [
      Array.isArray(slideSpec.cards) ? slideSpec.cards : [],
      Array.isArray(slideSpec.signals) ? slideSpec.signals : [],
      Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails : [],
      Array.isArray(slideSpec.bullets) ? slideSpec.bullets : [],
      Array.isArray(slideSpec.resources) ? slideSpec.resources : []
    ].flat()
      .filter((item: unknown): item is TextPoint => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .map((item: TextPoint) => ({
        body: cleanText(item.body || ""),
        title: cleanText(item.title || "")
      }))
      .filter((item) => item.title || item.body)
      .slice(0, 8);

    return {
      recentSlideNumber: slideSpecs.length - Math.min(slideSpecs.length, 2) + index + 1,
      summary: cleanText(slideSpec.summary || ""),
      title: cleanText(slideSpec.title || ""),
      type: normalizeGeneratedSlideType(slideSpec.type),
      visibleItems
    };
  });
}

export function createSingleSlideDeckPlan(deckPlan: DeckPlan, slideIndex: number, slideCount: number): DeckPlan {
  const slides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];
  const slide = slides[slideIndex];
  if (!slide) {
    throw new Error(`Approved deck plan is missing slide ${slideIndex + 1}.`);
  }

  return {
    ...deckPlan,
    outline: `${slideIndex + 1}. ${slide.title || `Slide ${slideIndex + 1}`}`,
    slides: [
      {
        ...slide,
        role: "opening"
      }
    ],
    thesis: deckPlan.thesis || "",
    narrativeArc: [
      deckPlan.narrativeArc,
      `Draft only slide ${slideIndex + 1} of ${slideCount}.`
    ].filter(Boolean).join(" ")
  };
}
