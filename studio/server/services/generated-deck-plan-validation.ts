import { isSupportedSlideType, normalizeGeneratedSlideType, normalizePlanRole, roleForIndex, supportedSlideTypes } from "./generated-plan-repair.ts";
import { cleanText, hasDanglingEnding, isKnownBadTranslation, isScaffoldLeak, isWeakLabel, normalizeVisibleText, repairKnownBadTranslations } from "./generated-text-hygiene.ts";
import { collectProvidedUrls } from "./generation-source-urls.ts";
import { isCopiedInstructionLikeText, isPromptLeakText } from "./visible-text-quarantine-rules.ts";

type JsonObject = Record<string, unknown>;

export type DeckPlanSlide = JsonObject & {
  evidence?: unknown;
  evidenceNeed?: unknown;
  image?: unknown;
  imageNeed?: unknown;
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  sourceNeed?: unknown;
  sourceNeeds?: unknown;
  source_notes?: unknown;
  sourceNotes?: unknown;
  title?: unknown;
  type?: unknown;
  value?: unknown;
  visualNeed?: unknown;
  visualNeeds?: unknown;
  visual_notes?: unknown;
  visualNotes?: unknown;
};

export type DeckPlan = JsonObject & {
  narrativeArc?: unknown;
  outline?: unknown;
  slides?: DeckPlanSlide[];
  thesis?: unknown;
  title?: unknown;
};

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

type GenerationFieldsForDeckPlan = JsonObject & {
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

export function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
    planSlide && planSlide.title,
    planSlide && planSlide.intent,
    planSlide && planSlide.keyMessage
  ].filter(Boolean).join(" | ")).toLowerCase();
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
    slide && slide.intent,
    slide && slide.keyMessage,
    slide && slide.value,
    slide && slide.title
  );
}

function deriveDeckPlanKeyMessage(slide: DeckPlanSlide): string {
  return firstVisibleDeckPlanValue(
    slide && slide.keyMessage,
    slide && slide.intent,
    slide && slide.value
  );
}

function deriveDeckPlanSourceNeed(fields: GenerationFieldsForDeckPlan, slide: DeckPlanSlide): string {
  const hasSources = collectProvidedUrls(fields).length > 0
    || Boolean(fields && fields.sourceContext && normalizeVisibleText(fields.sourceContext.promptText));
  const focus = firstVisibleDeckPlanValue(slide && slide.keyMessage, slide && slide.intent, slide && slide.title, "this slide");

  if (fields && fields.sourcingStyle === "none" && !hasSources) {
    return `Ground ${focus} in the user brief; no external source is required.`;
  }

  if (hasSources) {
    return `Use retrieved or supplied source context that supports ${focus}.`;
  }

  return `Use the user brief as the source for ${focus}; add external evidence only if supplied.`;
}

function deriveDeckPlanVisualNeed(_fields: GenerationFieldsForDeckPlan, slide: DeckPlanSlide): string {
  const focus = firstVisibleDeckPlanValue(slide && slide.keyMessage, slide && slide.intent, slide && slide.title, "this slide");
  return `Use a clear visual treatment that reinforces ${focus} without reducing readability.`;
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

  const slides = sourcePlan.slides.filter(isDeckPlanSlide).map((slide: DeckPlanSlide, index: number) => {
    const sourceNeed = firstVisibleDeckPlanValue(
      slide && slide.sourceNeed,
      slide && slide.sourceNeeds,
      slide && slide.source_notes,
      slide && slide.sourceNotes,
      slide && slide.evidenceNeed,
      slide && slide.evidence
    ) || deriveDeckPlanSourceNeed(fields, slide);
    const visualNeed = firstVisibleDeckPlanValue(
      slide && slide.visualNeed,
      slide && slide.visualNeeds,
      slide && slide.visual_notes,
      slide && slide.visualNotes,
      slide && slide.imageNeed,
      slide && slide.image
    ) || deriveDeckPlanVisualNeed(fields, slide);

    return {
      ...slide,
      intent: deckPlanText(deriveDeckPlanIntent(slide)),
      keyMessage: deckPlanText(deriveDeckPlanKeyMessage(slide)),
      role: normalizePlanRole(slide && slide.role, index, slideCount),
      sourceNeed,
      title: deckPlanText(slide && slide.title),
      type: normalizeGeneratedSlideType(slide && slide.type),
      value: firstVisibleDeckPlanValue(slide && slide.value, slide && slide.keyMessage, slide && slide.intent),
      visualNeed
    };
  });

  return {
    ...sourcePlan,
    outline: firstVisibleDeckPlanValue(repairKnownBadTranslations(sourcePlan.outline))
      || slides.map((slide: DeckPlanSlide, index: number) => `${index + 1}. ${slide.title || `Slide ${index + 1}`}`).join("\n"),
    requestedLanguage: fields.lang || fields.presentationLanguage || "",
    slides,
    title: firstVisibleDeckPlanValue(sourcePlan.title, fields.title)
  };
}

export function collectDeckPlanIssueDetails(plan: DeckPlan, slideCount: number): DeckPlanIssue[] {
  const slides = Array.isArray(plan.slides) ? plan.slides.filter(isDeckPlanSlide) : [];
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
    [
      ["title", slide && slide.title],
      ["intent", slide && slide.intent],
      ["value", slide && slide.value],
      ["keyMessage", slide && slide.keyMessage],
      ["sourceNeed", slide && slide.sourceNeed],
      ["type", slide && slide.type],
      ["visualNeed", slide && slide.visualNeed]
    ].forEach(([fieldName, value]) => {
      if (fieldName === "type") {
        if (!isSupportedSlideType(value)) {
          issues.push(deckPlanIssue("unsupported-slide-type", `deckPlan.slides[${index}].type must be one of: ${supportedSlideTypes.join(", ")}.`));
        }
      } else {
        const issue = visibleDeckPlanIssue(value, `deckPlan.slides[${index}].${fieldName}`);
        if (issue) {
          issues.push(issue);
        }
      }
    });

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
