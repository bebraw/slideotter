import { isSupportedSlideType, roleForIndex, supportedSlideTypes } from "./generated-plan-repair.ts";
import {
  cleanText,
  hasDanglingEnding,
  isKnownBadTranslation,
  isWeakLabel,
  normalizeVisibleText
} from "./generated-text-hygiene.ts";
import { isCopiedInstructionLikeText, isPromptLeakText } from "./visible-text-quarantine-rules.ts";
import type { DeckPlan, DeckPlanSlide } from "./generated-deck-plan-types.ts";
import { isDeckPlanSlide } from "./generated-deck-plan-normalization.ts";

export type DeckPlanIssueCode =
  | "dangling-fragment"
  | "duplicate-slide"
  | "known-bad-translation"
  | "language-mismatch"
  | "missing-visible-text"
  | "prompt-leak"
  | "role-mismatch"
  | "slide-count"
  | "unsupported-slide-type";

export type DeckPlanIssue = {
  code: DeckPlanIssueCode;
  message: string;
};

function deckPlanIssue(code: DeckPlanIssueCode, message: string): DeckPlanIssue {
  return { code, message };
}

function visibleDeckPlanIssue(value: unknown, fieldName: string): DeckPlanIssue | null {
  const text = cleanText(value);
  if (!text || isWeakLabel(text)) {
    return deckPlanIssue("missing-visible-text", `Generated presentation plan is missing usable ${fieldName}.`);
  }
  if (isKnownBadTranslation(value)) {
    return deckPlanIssue("known-bad-translation", `${fieldName} contains a known bad translation.`);
  }
  if (hasDanglingEnding(value)) {
    return deckPlanIssue("dangling-fragment", `${fieldName} appears incomplete.`);
  }
  if (isPromptLeakText(value) || isCopiedInstructionLikeText(value)) {
    return deckPlanIssue("prompt-leak", `${fieldName} contains prompt-like or copied instruction text.`);
  }
  return null;
}

function normalizeLanguageName(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    en: "english",
    "en-gb": "english",
    "en-us": "english",
    english: "english",
    fi: "finnish",
    finnish: "finnish",
    suomi: "finnish",
    sv: "swedish",
    svenska: "swedish",
    swedish: "swedish"
  };
  return aliases[raw] || raw;
}

function deckPlanSlideSignature(planSlide: DeckPlanSlide): string {
  return normalizeVisibleText([
    planSlide.title,
    planSlide.intent,
    planSlide.keyMessage
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function collectDeckPlanSlideFieldIssues(slide: DeckPlanSlide, index: number): DeckPlanIssue[] {
  return [
    ["title", slide.title],
    ["intent", slide.intent],
    ["value", slide.value],
    ["keyMessage", slide.keyMessage],
    ["sourceNeed", slide.sourceNeed],
    ["type", slide.type],
    ["visualNeed", slide.visualNeed]
  ].flatMap(([fieldName, value]) => {
    if (fieldName === "type") {
      return isSupportedSlideType(value)
        ? []
        : [deckPlanIssue("unsupported-slide-type", `deckPlan.slides[${index}].type must be one of: ${supportedSlideTypes.join(", ")}.`)];
    }

    const issue = visibleDeckPlanIssue(value, `deckPlan.slides[${index}].${fieldName}`);
    return issue ? [issue] : [];
  });
}

function collectDeckPlanFrameIssues(plan: DeckPlan, slides: DeckPlanSlide[], slideCount: number): DeckPlanIssue[] {
  const issues: DeckPlanIssue[] = [];
  const requestedLanguage = normalizeLanguageName(plan.requestedLanguage || "");
  const generatedLanguage = normalizeLanguageName(plan.language || "");
  if (requestedLanguage && generatedLanguage && generatedLanguage !== requestedLanguage) {
    issues.push(deckPlanIssue("language-mismatch", `Plan language is "${plan.language}" but the requested target language is "${plan.requestedLanguage}".`));
  }
  if (slides.length !== slideCount) {
    issues.push(deckPlanIssue("slide-count", `Plan has ${slides.length} slides but needs exactly ${slideCount}.`));
  }
  const titleIssue = visibleDeckPlanIssue(plan.title, "deckPlan.title");
  if (titleIssue) {
    issues.push(titleIssue);
  }

  return issues;
}

export function collectDeckPlanIssueDetails(plan: DeckPlan, slideCount: number): DeckPlanIssue[] {
  const slides = Array.isArray(plan.slides) ? plan.slides.filter(isDeckPlanSlide) : [];
  const issues = collectDeckPlanFrameIssues(plan, slides, slideCount);

  [
    ["deckPlan.outline", plan.outline],
    ["deckPlan.thesis", plan.thesis],
    ["deckPlan.narrativeArc", plan.narrativeArc]
  ].forEach(([fieldName, value]) => {
    if (isPromptLeakText(value) || isCopiedInstructionLikeText(value)) {
      issues.push(deckPlanIssue("prompt-leak", `${fieldName} contains prompt-like or copied instruction text.`));
    }
  });

  const seenSignatures = new Set<string>();
  slides.forEach((slide: DeckPlanSlide, index: number) => {
    issues.push(...collectDeckPlanSlideFieldIssues(slide, index));

    const desiredRole = roleForIndex(index, slideCount);
    if ((index === 0 || index === slideCount - 1 && slideCount > 1) && slide.role !== desiredRole) {
      issues.push(deckPlanIssue("role-mismatch", `Slide ${index + 1} must use role "${desiredRole}".`));
    }

    const signature = deckPlanSlideSignature(slide);
    if (signature && seenSignatures.has(signature)) {
      issues.push(deckPlanIssue("duplicate-slide", `Slide ${index + 1} repeats an earlier slide title, intent, and key message.`));
    }

    seenSignatures.add(signature);
  });

  return issues;
}

export function collectDeckPlanIssues(plan: DeckPlan, slideCount: number): string[] {
  return collectDeckPlanIssueDetails(plan, slideCount).map((issue) => issue.message);
}

export function validateDeckPlan(plan: DeckPlan, slideCount: number): DeckPlan {
  const issues = collectDeckPlanIssues(plan, slideCount);
  if (issues.length) {
    throw new Error(`Generated deck plan is not usable: ${issues.join(" ")}`);
  }

  return plan;
}
