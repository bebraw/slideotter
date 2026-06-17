import { normalizeGeneratedSlideType, normalizePlanRole } from "./generated-plan-repair.ts";
import {
  cleanText,
  isScaffoldLeak,
  isWeakLabel,
  normalizeVisibleText,
  repairKnownBadTranslations
} from "./generated-text-hygiene.ts";
import { collectProvidedUrls } from "./generation-source-urls.ts";
import { isCopiedInstructionLikeText, isPromptLeakText } from "./visible-text-quarantine-rules.ts";
import type { DeckPlan, DeckPlanSlide, JsonObject } from "./generated-deck-plan-types.ts";

export type GenerationFieldsForDeckPlan = JsonObject & {
  audience?: unknown;
  constraints?: unknown;
  lang?: unknown;
  objective?: unknown;
  outline?: unknown;
  presentationLanguage?: unknown;
  sourceContext?: {
    promptText?: string;
  } | undefined;
  sourceSnippets?: Array<{ url?: unknown }> | undefined;
  sourcingStyle?: unknown;
  themeBrief?: unknown;
  title?: unknown;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function firstVisibleDeckPlanValue(...values: unknown[]): string {
  for (const value of values) {
    const normalized = cleanText(repairKnownBadTranslations(value));
    if (normalized && !isWeakLabel(normalized) && !isScaffoldLeak(normalized) && !isPromptLeakText(normalized) && !isCopiedInstructionLikeText(normalized)) {
      return normalized;
    }
  }

  return "";
}

function deckPlanText(value: unknown): string {
  return cleanText(repairKnownBadTranslations(value));
}

function deriveDeckPlanIntent(slide: DeckPlanSlide): string {
  return firstVisibleDeckPlanValue(
    slide.intent,
    slide.keyMessage,
    slide.value,
    slide.title
  );
}

function deriveDeckPlanKeyMessage(slide: DeckPlanSlide): string {
  return firstVisibleDeckPlanValue(
    slide.keyMessage,
    slide.intent,
    slide.value
  );
}

function deriveDeckPlanSourceNeed(fields: GenerationFieldsForDeckPlan, slide: DeckPlanSlide): string {
  const hasSources = collectProvidedUrls(fields).length > 0
    || Boolean(fields && fields.sourceContext && normalizeVisibleText(fields.sourceContext.promptText));
  const focus = firstVisibleDeckPlanValue(slide.keyMessage, slide.intent, slide.title, "this slide");

  if (fields && fields.sourcingStyle === "none" && !hasSources) {
    return `Ground ${focus} in the user brief; no external source is required.`;
  }

  if (hasSources) {
    return `Use retrieved or supplied source context that supports ${focus}.`;
  }

  return `Use the user brief as the source for ${focus}; add external evidence only if supplied.`;
}

function deriveDeckPlanVisualNeed(_fields: GenerationFieldsForDeckPlan, slide: DeckPlanSlide): string {
  const focus = firstVisibleDeckPlanValue(slide.keyMessage, slide.intent, slide.title, "this slide");
  return `Use a clear visual treatment that reinforces ${focus} without reducing readability.`;
}

function normalizeDeckPlanSlide(
  fields: GenerationFieldsForDeckPlan,
  slide: DeckPlanSlide,
  index: number,
  slideCount: number
): DeckPlanSlide {
  const sourceNeed = firstVisibleDeckPlanValue(
    slide.sourceNeed,
    slide.sourceNeeds,
    slide.source_notes,
    slide.sourceNotes,
    slide.evidenceNeed,
    slide.evidence
  ) || deriveDeckPlanSourceNeed(fields, slide);
  const visualNeed = firstVisibleDeckPlanValue(
    slide.visualNeed,
    slide.visualNeeds,
    slide.visual_notes,
    slide.visualNotes,
    slide.imageNeed,
    slide.image
  ) || deriveDeckPlanVisualNeed(fields, slide);

  return {
    ...slide,
    intent: deckPlanText(deriveDeckPlanIntent(slide)),
    keyMessage: deckPlanText(deriveDeckPlanKeyMessage(slide)),
    role: normalizePlanRole(slide.role, index, slideCount),
    sourceNeed,
    title: deckPlanText(slide.title),
    type: normalizeGeneratedSlideType(slide.type),
    value: firstVisibleDeckPlanValue(slide.value, slide.keyMessage, slide.intent),
    visualNeed
  };
}

export function normalizeDeckPlanForValidation(fields: GenerationFieldsForDeckPlan, plan: unknown, slideCount: number): DeckPlan {
  if (!isJsonObject(plan)) {
    return { slides: [] };
  }

  const sourcePlan = plan;

  if (!Array.isArray(sourcePlan.slides)) {
    return {
      ...sourcePlan,
      slides: []
    };
  }

  const slides = sourcePlan.slides
    .filter(isDeckPlanSlide)
    .map((slide: DeckPlanSlide, index: number) => normalizeDeckPlanSlide(fields, slide, index, slideCount));

  return {
    ...sourcePlan,
    outline: firstVisibleDeckPlanValue(repairKnownBadTranslations(sourcePlan.outline))
      || slides.map((slide: DeckPlanSlide, index: number) => `${index + 1}. ${slide.title || `Slide ${index + 1}`}`).join("\n"),
    requestedLanguage: fields.lang || fields.presentationLanguage || "",
    slides,
    title: firstVisibleDeckPlanValue(sourcePlan.title, fields.title)
  };
}
