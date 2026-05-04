import { contentRoles, isSupportedSlideType, normalizeGeneratedSlideType, supportedPlanRoles, supportedSlideTypes } from "./generated-plan-repair.ts";
import { cleanText, isScaffoldLeak, isWeakLabel, normalizeVisibleText, requireVisibleText } from "./generated-text-hygiene.ts";

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

function extractUrls(value: unknown): string[] {
  return String(value || "").match(/https?:\/\/[^\s),\]]+/g) || [];
}

function collectProvidedUrls(fields: GenerationFieldsForDeckPlan = {}): string[] {
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function roleForIndex(index: number, total: number): string {
  if (index === 0) {
    return "opening";
  }

  if (index === total - 1 && total > 1) {
    return "handoff";
  }

  return contentRoles[(index - 1) % contentRoles.length] || "concept";
}

function normalizePlanRole(role: unknown, index: number, total: number): string {
  const desired = roleForIndex(index, total);
  const normalizedRole = String(role || "").trim();

  if (index === 0 || index === total - 1 && total > 1) {
    return desired;
  }

  if (normalizedRole === "opening" || normalizedRole === "handoff") {
    return desired;
  }

  return supportedPlanRoles.includes(normalizedRole) ? normalizedRole : desired;
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
    const normalized = cleanText(value);
    if (normalized && !isWeakLabel(normalized) && !isScaffoldLeak(normalized)) {
      return normalized;
    }
  }

  return "";
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
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    return { slides: [] };
  }

  const sourcePlan = plan as JsonObject;

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
      role: normalizePlanRole(slide && slide.role, index, slideCount),
      sourceNeed,
      type: normalizeGeneratedSlideType(slide && slide.type),
      visualNeed
    };
  });

  return {
    ...sourcePlan,
    outline: firstVisibleDeckPlanValue(sourcePlan.outline)
      || slides.map((slide: DeckPlanSlide, index: number) => `${index + 1}. ${slide.title || `Slide ${index + 1}`}`).join("\n"),
    requestedLanguage: fields.lang || fields.presentationLanguage || "",
    slides
  };
}

export function collectDeckPlanIssues(plan: DeckPlan, slideCount: number): string[] {
  const slides = Array.isArray(plan.slides) ? plan.slides.filter(isDeckPlanSlide) : [];
  const issues: string[] = [];
  const requestedLanguage = normalizeLanguageName(plan.requestedLanguage || "");
  const generatedLanguage = normalizeLanguageName(plan.language || "");
  if (requestedLanguage && generatedLanguage && generatedLanguage !== requestedLanguage) {
    issues.push(`Plan language is "${plan.language}" but the requested target language is "${plan.requestedLanguage}".`);
  }
  if (slides.length !== slideCount) {
    issues.push(`Plan has ${slides.length} slides but needs exactly ${slideCount}.`);
  }

  const seenSignatures = new Set<string>();
  slides.forEach((slide: DeckPlanSlide, index: number) => {
    [
      ["title", slide && slide.title],
      ["intent", slide && slide.intent],
      ["keyMessage", slide && slide.keyMessage],
      ["sourceNeed", slide && slide.sourceNeed],
      ["type", slide && slide.type],
      ["visualNeed", slide && slide.visualNeed]
    ].forEach(([fieldName, value]) => {
      try {
        if (fieldName === "type") {
          if (!isSupportedSlideType(value)) {
            throw new Error(`deckPlan.slides[${index}].type must be one of: ${supportedSlideTypes.join(", ")}.`);
          }
        } else {
          requireVisibleText(value, `deckPlan.slides[${index}].${fieldName}`);
        }
      } catch (error) {
        issues.push(errorMessage(error));
      }
    });

    const desiredRole = roleForIndex(index, slideCount);
    if ((index === 0 || index === slideCount - 1 && slideCount > 1) && slide.role !== desiredRole) {
      issues.push(`Slide ${index + 1} must use role "${desiredRole}".`);
    }

    const signature = deckPlanSlideSignature(slide);
    if (signature && seenSignatures.has(signature)) {
      issues.push(`Slide ${index + 1} repeats an earlier slide title, intent, and key message.`);
    }

    seenSignatures.add(signature);
  });

  return issues;
}

export function validateDeckPlan(plan: DeckPlan, slideCount: number): DeckPlan {
  const issues = collectDeckPlanIssues(plan, slideCount);
  if (issues.length) {
    throw new Error(`Generated deck plan is not usable: ${issues.join(" ")}`);
  }

  return plan;
}
