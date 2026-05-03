// Staged presentation generation owns outline planning, slide drafting, local fallback
// materialization, and generation repair. Keep model output as candidate data; local
// validation and presentation write paths remain authoritative.
import { createStructuredResponse, getLlmStatus } from "./llm/client.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import { getGenerationSourceContext } from "./sources.ts";
import { getGenerationMaterialContext } from "./materials.ts";
import { contentRoles, isSupportedSlideType, normalizeGeneratedSlideType, preserveApprovedSlideTypes, supportedPlanRoles, supportedSlideTypes } from "./generated-plan-repair.ts";
import { resolveSlideMaterial, resolveSlideMaterials } from "./generated-materials.ts";
import { semanticallyRepairPlanText } from "./generated-text-repair.ts";
import { buildDeckPlanPromptRequest, buildDeckPlanRepairPromptRequest, buildSlidePlanPromptRequest } from "./generated-prompting.ts";
import type { MaterialCandidate } from "./generated-materials.ts";

const defaultSlideCount = 5;
const maximumSlideCount = 30;
type JsonObject = Record<string, unknown>;

type TextPoint = JsonObject & {
  body?: unknown;
  title?: unknown;
};

type GeneratedPlanSlide = JsonObject & {
  eyebrow?: unknown;
  guardrailTitle?: unknown;
  guardrails?: TextPoint[];
  guardrailsTitle?: unknown;
  intent?: unknown;
  keyPoints?: TextPoint[];
  keyPointsTitle?: unknown;
  label?: unknown;
  mediaMaterialId?: unknown;
  note?: unknown;
  resourceTitle?: unknown;
  resources?: TextPoint[];
  resourcesTitle?: unknown;
  role?: unknown;
  section?: unknown;
  signalsTitle?: unknown;
  speakerNote?: unknown;
  speakerNotes?: unknown;
  summary?: unknown;
  title?: unknown;
  type?: unknown;
};

type DeckPlanSlide = JsonObject & {
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

type DeckPlan = JsonObject & {
  narrativeArc?: unknown;
  outline?: unknown;
  slides?: DeckPlanSlide[];
  thesis?: unknown;
};

type GeneratedPlan = JsonObject & {
  references?: GeneratedReference[];
  slides?: GeneratedPlanSlide[];
};

type NormalizedPoint = {
  body: string;
  title: string;
};

type SlideSpecObject = JsonObject;

type SlideItem = JsonObject & {
  body?: unknown;
  label?: unknown;
  title?: unknown;
  value?: unknown;
};

type GeneratedSlideSpec = SlideSpecObject & {
  bullets?: SlideItem[];
  cards?: SlideItem[];
  context?: unknown;
  eyebrow?: unknown;
  guardrails?: SlideItem[];
  guardrailsTitle?: unknown;
  media?: JsonObject & {
    alt?: unknown;
    caption?: unknown;
  };
  mediaItems?: SlideItem[];
  note?: unknown;
  quote?: unknown;
  resources?: SlideItem[];
  resourcesTitle?: unknown;
  signals?: SlideItem[];
  signalsTitle?: unknown;
  summary?: unknown;
  title?: unknown;
  type?: unknown;
};

type RetrievalSnippet = JsonObject & {
  chunkIndex?: unknown;
  sourceId?: unknown;
  text?: unknown;
  title?: unknown;
  url?: unknown;
};

type SourceBudget = JsonObject & {
  maxPromptChars?: unknown;
  maxSnippetChars?: unknown;
  omittedSnippetCount?: unknown;
  promptCharCount?: unknown;
  retrievedSnippetCount?: unknown;
  snippetLimit?: unknown;
  truncatedSnippetCount?: unknown;
  usedSnippetCount?: unknown;
};

type SourceContextWithBudget = GenerationContext & {
  budget?: SourceBudget;
  snippets?: RetrievalSnippet[];
};

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
};

type GenerationFields = ProgressOptions & JsonObject & {
  audience?: unknown;
  constraints?: unknown;
  includeActiveMaterials?: unknown;
  includeActiveSources?: unknown;
  lockedOutlineSlides?: unknown[];
  materialCandidates?: MaterialCandidate[] | undefined;
  materialContext?: GenerationContext | undefined;
  objective?: unknown;
  outline?: unknown;
  presentationSources?: unknown;
  presentationSourceText?: unknown;
  query?: unknown;
  slideIntent?: unknown;
  slideKeyMessage?: unknown;
  slideSourceNotes?: unknown;
  slideTitle?: unknown;
  sourceContext?: GenerationContext | undefined;
  sourceSnippets?: Array<{ url?: unknown }> | undefined;
  targetCount?: unknown;
  targetSlideCount?: unknown;
};

type GenerationContext = {
  budget?: SourceBudget;
  materials?: MaterialCandidate[];
  promptText?: string;
  snippets?: RetrievalSnippet[];
};

type GenerationRuntime = {
  model?: unknown;
  provider?: unknown;
};

type GenerationOptions = ProgressOptions & {
  initialGeneratedPlanSlides?: unknown[];
  initialSlideSpecs?: unknown[];
  onSlide?: (payload: unknown) => void;
  shouldStop?: () => boolean;
  startIndex?: unknown;
  targetIndex?: unknown;
  totalSlides?: unknown;
  usedMaterialIds?: Set<string>;
};

type MaterialMedia = {
  alt: string;
  caption?: string;
  id: string;
  src: unknown;
};

type GeneratedReference = {
  title?: unknown;
  url?: unknown;
};

type DeckPlanResponse = {
  generation?: GenerationRuntime;
  materialContext?: GenerationContext;
  model?: unknown;
  plan?: DeckPlan | undefined;
  promptBudget?: unknown;
  provider?: unknown;
  responseId?: unknown;
  sourceContext?: GenerationContext;
};

type LlmPlanResponse = {
  model?: unknown;
  plan: GeneratedPlan;
  promptBudget?: unknown;
  provider?: unknown;
  responseId?: unknown;
};

type LlmPlanOptions = GenerationOptions & {
  deckPlan?: unknown;
  singleSlideContext?: JsonObject | null | undefined;
  slideTarget?: JsonObject | null | undefined;
};

type ContentRunStoppedError = Error & {
  code?: string;
};

const danglingTailWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "through",
  "to",
  "when",
  "where",
  "while",
  "with",
  "within",
  "without"
]);

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTextPoint(value: unknown): value is TextPoint {
  return isJsonObject(value);
}

function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
  return isJsonObject(value);
}

function isGeneratedPlanSlide(value: unknown): value is GeneratedPlanSlide {
  return isJsonObject(value);
}

function isSlideItem(value: unknown): value is SlideItem {
  return isJsonObject(value);
}

function isGeneratedSlideSpec(value: unknown): value is GeneratedSlideSpec {
  return isJsonObject(value);
}

function isRetrievalSnippet(value: unknown): value is RetrievalSnippet {
  return isJsonObject(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateSlideSpecObject(spec: SlideSpecObject): SlideSpecObject {
  const validated = validateSlideSpec(spec);
  return isJsonObject(validated) ? validated : spec;
}

function normalizeSlideCount(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return defaultSlideCount;
  }

  return Math.min(Math.max(1, parsed), maximumSlideCount);
}

function trimWords(value: unknown, limit = 12): string {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  const trimmed = words.slice(0, limit);
  while (trimmed.length > 4) {
    const tail = String(trimmed[trimmed.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
    if (!danglingTailWords.has(tail)) {
      break;
    }

    trimmed.pop();
  }

  return trimmed.join(" ").replace(/[,:;]$/g, "");
}

function sentence(value: unknown, fallback: unknown, limit = 14): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return trimWords(normalized || fallback, limit);
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

function collectProvidedUrls(fields: GenerationFields = {}): string[] {
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

function materialToMedia(material: MaterialCandidate | null | undefined): MaterialMedia | undefined {
  if (!material) {
    return undefined;
  }

  const media: MaterialMedia = {
    alt: sentence(material.alt || material.title, material.title, 16),
    id: material.id,
    src: material.url
  };
  const sourceCaption = buildMaterialCaption(material);

  if (sourceCaption) {
    media.caption = sentence(sourceCaption, material.title, 34);
  }

  return media;
}

function normalizeCaptionPart(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^source:\s*/i, "source: ")
    .replace(/^creator:\s*/i, "creator: ")
    .replace(/^license:\s*/i, "license: ")
    .trim()
    .toLowerCase();
}

function buildMaterialCaption(material: MaterialCandidate): string {
  const structuredParts = [
    material.creator ? `Creator: ${material.creator}` : "",
    material.license ? `License: ${material.license}` : "",
    material.sourceUrl ? `Source: ${material.sourceUrl}` : ""
  ].filter(Boolean);
  const structuredKeys = new Set(structuredParts.map(normalizeCaptionPart));
  const bareSourceKey = normalizeCaptionPart(material.sourceUrl || "");
  const captionParts = String(material.caption || "")
    .split("|")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((part) => {
      const key = normalizeCaptionPart(part);
      if (structuredKeys.has(key)) {
        return false;
      }

      if (bareSourceKey && key === bareSourceKey) {
        return false;
      }

      if (/^(creator|license|source):/i.test(part)) {
        return false;
      }

      return true;
    });

  return uniqueBy([
    ...captionParts,
    ...structuredParts
  ], normalizeCaptionPart).join(" | ");
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

function isWeakLabel(value: unknown): boolean {
  return /^(summary|title:?|key point|point|item|slide|section|role|body|n\/a|none)$/i.test(String(value || "").trim());
}

function isScaffoldLeak(value: unknown): boolean {
  const text = String(value || "").trim();
  return /^(guardrails|key points|sources to verify)$/i.test(text)
    || /refine constraints before expanding the deck/i.test(text)
    || /\buse this slide as (?:the )?(?:opening frame|closing handoff|section divider|reference slide)\b/i.test(text)
    || /\bfor the presentation sequence\b/i.test(text);
}

function isUnsupportedBibliographicClaim(value: unknown): boolean {
  return /\b(et al\.|journal|proceedings|doi:|isbn)\b/i.test(String(value || "")) && !/https?:\/\//.test(String(value || ""));
}

function hasDanglingEnding(value: unknown): boolean {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    return false;
  }

  const tail = String(words[words.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
  return danglingTailWords.has(tail);
}

function normalizeVisibleText(value: unknown): string {
  return String(value || "")
    .replace(/…/g, "")
    .replace(/\.{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown): string {
  const normalized = normalizeVisibleText(value)
    .replace(/\b(title|summary|body):\s*$/i, "")
    .trim();

  return isUnsupportedBibliographicClaim(normalized) ? "" : normalized;
}

function requireVisibleText(value: unknown, fieldName: string): string {
  const text = cleanText(value);
  if (text && !isWeakLabel(text)) {
    return text;
  }

  throw new Error(`Generated presentation plan is missing usable ${fieldName}.`);
}

function pointTitleText(point: TextPoint | null | undefined, fieldName: string, index: number, body: string): string {
  const title = cleanText(point && point.title);
  if (title && !isWeakLabel(title) && !isScaffoldLeak(title)) {
    return title;
  }

  const derived = sentence(body, body, 4);
  if (derived && !isWeakLabel(derived) && !isScaffoldLeak(derived)) {
    return derived;
  }

  throw new Error(`Generated presentation plan is missing usable ${fieldName}[${index}].title.`);
}

function normalizeGeneratedPoints(points: unknown, count: number, fieldName: string): NormalizedPoint[] {
  const normalized = Array.isArray(points)
    ? points.filter(isTextPoint).map((point: TextPoint, index: number) => {
      const body = requireVisibleText(point && point.body, `${fieldName}[${index}].body`);
      const title = pointTitleText(point, fieldName, index, body);
      return { body, title };
    })
    : [];
  const unique = uniqueBy(normalized, (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`);

  if (unique.length < count) {
    throw new Error(`Generated presentation plan needs ${count} distinct ${fieldName} items in the deck language.`);
  }

  return unique.slice(0, count);
}

function resolveGeneration(_options: ProgressOptions = {}) {
  const llmStatus = getLlmStatus();

  if (!llmStatus.available) {
    throw new Error(`LLM presentation generation is required. ${llmStatus.configuredReason || "Configure OpenAI, LM Studio, or OpenRouter before generating a presentation."}`);
  }

  return {
    available: true,
    fallbackReason: null,
    mode: "llm",
    model: llmStatus.model,
    provider: llmStatus.provider
  };
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

function deriveDeckPlanSourceNeed(fields: GenerationFields, slide: DeckPlanSlide): string {
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

function deriveDeckPlanVisualNeed(_fields: GenerationFields, slide: DeckPlanSlide): string {
  const focus = firstVisibleDeckPlanValue(slide && slide.keyMessage, slide && slide.intent, slide && slide.title, "this slide");
  return `Use a clear visual treatment that reinforces ${focus} without reducing readability.`;
}

function normalizeDeckPlanForValidation(fields: GenerationFields, plan: unknown, slideCount: number): DeckPlan {
  if (!isJsonObject(plan)) {
    return { slides: [] };
  }

  if (!Array.isArray(plan.slides)) {
    return {
      ...plan,
      slides: []
    };
  }

  const slides = plan.slides.filter(isDeckPlanSlide).map((slide: DeckPlanSlide, index: number) => {
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
    ...plan,
    outline: firstVisibleDeckPlanValue(plan.outline)
      || slides.map((slide, index) => `${index + 1}. ${slide.title || `Slide ${index + 1}`}`).join("\n"),
    slides
  };
}

function collectDeckPlanIssues(plan: DeckPlan, slideCount: number): string[] {
  const slides = Array.isArray(plan.slides) ? plan.slides.filter(isDeckPlanSlide) : [];
  const issues: string[] = [];
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

function validateDeckPlan(plan: DeckPlan, slideCount: number): DeckPlan {
  const issues = collectDeckPlanIssues(plan, slideCount);
  if (issues.length) {
    throw new Error(`Generated deck plan is not usable: ${issues.join(" ")}`);
  }

  return plan;
}

function planSlideSignature(planSlide: GeneratedPlanSlide): string {
  const keyPoints = Array.isArray(planSlide.keyPoints) ? planSlide.keyPoints : [];
  return normalizeVisibleText([
    planSlide && planSlide.title,
    planSlide && planSlide.summary,
    ...keyPoints.flatMap((point: TextPoint) => [point && point.title, point && point.body])
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function isGenericPlanSummary(value: unknown): boolean {
  return /^(opening frame|section divider|concrete example slide|closing handoff|handoff slide|reference slide|concept slide|context slide|mechanics slide|tradeoff slide)\b/i.test(String(value || "").trim())
    || /\bslide that shows how\b/i.test(String(value || ""));
}

function normalizePlanForMaterialization(_fields: GenerationFields, plan: GeneratedPlan, options: GenerationOptions = {}): GeneratedPlan {
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

function roleEyebrow(role: unknown, index: number, total: number): string {
  if (index === 0 || role === "opening") {
    return "Opening";
  }

  if (index === total - 1 && total > 1 || role === "handoff") {
    return "Close";
  }

  const labelByRole: Record<string, string> = {
    concept: "Concept",
    context: "Context",
    divider: "Section",
    example: "Example",
    mechanics: "Mechanics",
    reference: "References",
    tradeoff: "Tradeoffs"
  };
  return typeof role === "string" ? labelByRole[role] || "Section" : "Section";
}

function completePlanSlideFields(planSlide: GeneratedPlanSlide, index: number, total: number): GeneratedPlanSlide {
  const next = { ...planSlide };
  const role = normalizePlanRole(next.role, index, total);
  const firstPointTitle = firstUsefulItemTitle(next.keyPoints);
  const firstPointBody = firstUsefulItemBody(next.keyPoints);
  const firstGuardrailTitle = firstUsefulItemTitle(next.guardrails);
  const firstResourceTitle = firstUsefulItemTitle(next.resources);
  const title = cleanText(next.title);

  next.role = role;
  if (!title || isWeakLabel(title) || isScaffoldLeak(title)) {
    next.title = firstVisibleDeckPlanValue(
      next.summary,
      firstPointTitle,
      firstGuardrailTitle,
      firstResourceTitle,
      next.note,
      next.intent
    ) || title;
  }
  next.eyebrow = firstVisibleDeckPlanValue(next.eyebrow, next.section, next.label, roleEyebrow(role, index, total));
  next.note = firstVisibleDeckPlanValue(
    next.note,
    next.speakerNote,
    next.speakerNotes,
    next.summary,
    next.title
  );
  if (!cleanText(next.summary) || isGenericPlanSummary(next.summary)) {
    next.summary = firstVisibleDeckPlanValue(
      firstPointBody,
      next.intent,
      next.note,
      next.title
    );
  }
  next.signalsTitle = firstVisibleDeckPlanValue(next.signalsTitle, next.keyPointsTitle, firstPointTitle, "Signals");
  next.guardrailsTitle = firstVisibleDeckPlanValue(next.guardrailsTitle, next.guardrailTitle, firstGuardrailTitle, "Checks");
  next.resourcesTitle = firstVisibleDeckPlanValue(next.resourcesTitle, next.resourceTitle, firstResourceTitle, "Next");
  next.mediaMaterialId = typeof next.mediaMaterialId === "string" ? next.mediaMaterialId : "";
  next.type = normalizeGeneratedSlideType(next.type);

  return next;
}

function toCards(planSlide: GeneratedPlanSlide, prefix: string, count: number, fieldName: "guardrails" | "keyPoints" | "resources" = "keyPoints"): NormalizedPoint[] {
  return normalizeGeneratedPoints(planSlide[fieldName], count, fieldName)
    .map((point, index) => {
      const body = sentence(point.body, point.body, 8);
      const rawTitle = sentence(point.title, point.title, 4);
      const title = isWeakLabel(rawTitle) || isScaffoldLeak(rawTitle)
        ? sentence(body, body, 4)
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
  }

  return sentence(text, text, limit);
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
    .find((title: string) => title && !isWeakLabel(title) && !isScaffoldLeak(title)) || "";
}

function planSummaryText(planSlide: GeneratedPlanSlide, limit: number): string {
  const summary = cleanText(planSlide && planSlide.summary);
  if (summary && !isGenericPlanSummary(summary)) {
    return sentence(summary, summary, limit);
  }

  throw new Error("Generated presentation plan is missing a usable slide summary in the deck language.");
}

function toContentSlide(planSlide: GeneratedPlanSlide, index: number): SlideSpecObject {
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const secondaryPoints = normalizeGeneratedPoints(planSlide.guardrails, 3, "guardrails");

  return validateSlideSpecObject({
    eyebrow: planFieldText(planSlide, "eyebrow", 4),
    guardrails: secondaryPoints.map((point, guardrailIndex) => ({
      body: sentence(point.body, point.body, 8),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point.title, point.title, 4)
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

function resolvePhotoGridMaterialSet(planSlide: GeneratedPlanSlide, materialCandidates: MaterialCandidate[]): MaterialMedia[] {
  // Photo grids are comparison sets, so they may reuse images already selected by adjacent one-up slides.
  const gridOnlyUsedMaterialIds = new Set<string>();
  return resolveSlideMaterials(planSlide, materialCandidates, gridOnlyUsedMaterialIds, 3)
    .map(materialToMedia)
    .filter((media: MaterialMedia | undefined): media is MaterialMedia => Boolean(media));
}

function materializePlan(fields: GenerationFields, plan: GeneratedPlan, options: GenerationOptions = {}): SlideSpecObject[] {
  const normalizedPlan = normalizePlanForMaterialization(fields, plan, options);
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
      const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
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
      const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
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

    const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
    return validateSlideSpecObject({
      ...toContentSlide(planSlide, slideNumber),
      ...(media ? { media } : {})
    });
  });
}

function collectVisibleText(slideSpec: GeneratedSlideSpec): unknown[] {
  const cards = Array.isArray(slideSpec.cards) ? slideSpec.cards.filter(isSlideItem) : [];
  const signals = Array.isArray(slideSpec.signals) ? slideSpec.signals.filter(isSlideItem) : [];
  const guardrails = Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails.filter(isSlideItem) : [];
  const bullets = Array.isArray(slideSpec.bullets) ? slideSpec.bullets.filter(isSlideItem) : [];
  const resources = Array.isArray(slideSpec.resources) ? slideSpec.resources.filter(isSlideItem) : [];

  return [
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle,
    slideSpec.media && slideSpec.media.alt,
    slideSpec.media && slideSpec.media.caption,
    ...cards.flatMap((item: SlideItem) => [item.title, item.body]),
    ...signals.flatMap((item: SlideItem) => [item.title, item.body]),
    ...guardrails.flatMap((item: SlideItem) => [item.title, item.body]),
    ...bullets.flatMap((item: SlideItem) => [item.title, item.body]),
    ...resources.flatMap((item: SlideItem) => [item.title, item.body])
  ].filter(Boolean);
}

function assertGeneratedSlideQuality(slideSpecs: GeneratedSlideSpec[]): GeneratedSlideSpec[] {
  const seenSlideSignatures = new Map<string, number>();

  slideSpecs.forEach((slideSpec: GeneratedSlideSpec, slideIndex: number) => {
    const visibleText = collectVisibleText(slideSpec);
    const weakLabels = visibleText.filter((value) => isWeakLabel(value) || isScaffoldLeak(value) || /\b(title|summary|body):\s*$/i.test(String(value)));
    if (weakLabels.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains placeholder text: ${weakLabels.join(", ")}`);
    }

    const ellipsisText = visibleText.filter((value) => /\.{3,}|…/.test(String(value)));
    if (ellipsisText.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains ellipsis-truncated text.`);
    }

    const danglingText = visibleText.filter(hasDanglingEnding);
    if (danglingText.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains incomplete visible text.`);
    }

    const repeatedItemGroups = [
      Array.isArray(slideSpec.cards) ? slideSpec.cards.filter(isSlideItem) : [],
      Array.isArray(slideSpec.signals) ? slideSpec.signals.filter(isSlideItem) : [],
      Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails.filter(isSlideItem) : [],
      Array.isArray(slideSpec.bullets) ? slideSpec.bullets.filter(isSlideItem) : []
    ];
    repeatedItemGroups.forEach((items: SlideItem[]) => {
      const itemBodies = items.map((item: SlideItem) => String(item.body || "").toLowerCase());
      const duplicateBodies = itemBodies.filter((body: string, index: number) => body && itemBodies.indexOf(body) !== index);
      if (duplicateBodies.length) {
        throw new Error(`Generated slide ${slideIndex + 1} repeats visible card content.`);
      }
    });

    const fakeBibliographicClaims = visibleText.filter(isUnsupportedBibliographicClaim);
    if (fakeBibliographicClaims.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains unsourced bibliographic-looking claims.`);
    }

    const slideSignature = normalizeVisibleText([
      slideSpec.type,
      slideSpec.title,
      slideSpec.summary,
      ...(Array.isArray(slideSpec.cards) ? slideSpec.cards.filter(isSlideItem).map((item: SlideItem) => item.body) : []),
      ...(Array.isArray(slideSpec.signals) ? slideSpec.signals.filter(isSlideItem).map((item: SlideItem) => item.body) : []),
      ...(Array.isArray(slideSpec.bullets) ? slideSpec.bullets.filter(isSlideItem).map((item: SlideItem) => item.body) : [])
    ].filter(Boolean).join(" | ")).toLowerCase();

    if (
      slideSignature.length > 40
      && seenSlideSignatures.has(slideSignature)
      && slideIndex + 1 - (seenSlideSignatures.get(slideSignature) || 0) <= 2
    ) {
      throw new Error(`Generated slide ${slideIndex + 1} repeats slide ${seenSlideSignatures.get(slideSignature)}.`);
    }

    if (slideSignature.length > 40) {
      seenSlideSignatures.set(slideSignature, slideIndex + 1);
    }
  });

  return slideSpecs;
}

function firstUsefulItemTitle(items: unknown): string {
  return (Array.isArray(items) ? items : [])
    .filter(isSlideItem)
    .map((item) => cleanText(item && item.title))
    .find((title) => title && !isWeakLabel(title) && !isScaffoldLeak(title)) || "";
}

function firstUsefulItemBody(items: unknown): string {
  return (Array.isArray(items) ? items : [])
    .filter(isSlideItem)
    .map((item) => cleanText(item && item.body))
    .find((body) => body && !isWeakLabel(body) && !isScaffoldLeak(body)) || "";
}

function repairPanelTitle(value: unknown, items: unknown): string {
  const text = cleanText(value);
  if (text && !isWeakLabel(text) && !isScaffoldLeak(text)) {
    return text;
  }

  return firstUsefulItemTitle(items) || text || "";
}

function repairGeneratedVisibleText(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  let text = normalizeVisibleText(value)
    .replace(/\b(title|summary|body):\s*$/i, "")
    .trim();

  const words = text.split(/\s+/).filter(Boolean);
  while (words.length > 4) {
    const tail = String(words[words.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
    if (!danglingTailWords.has(tail)) {
      break;
    }

    words.pop();
    text = words.join(" ");
  }

  return text;
}

function repairGeneratedItem(item: unknown): unknown {
  if (!item || typeof item !== "object") {
    return item;
  }

  const next = Object.fromEntries(Object.entries(item).map(([key, value]) => [
    key,
    typeof value === "string" ? repairGeneratedVisibleText(value) : value
  ]));

  if (typeof next.title === "string" && (isWeakLabel(next.title) || isScaffoldLeak(next.title))) {
    const bodyTitle = sentence(next.body || next.value || next.label || "", next.body || next.value || next.label || "", 4);
    if (bodyTitle && !isWeakLabel(bodyTitle) && !isScaffoldLeak(bodyTitle)) {
      next.title = bodyTitle;
    }
  }

  return next;
}

function repairGeneratedSlideSpec(slideSpec: unknown): GeneratedSlideSpec {
  const next = JSON.parse(JSON.stringify(slideSpec));

  [
    "eyebrow",
    "title",
    "summary",
    "note",
    "caption",
    "quote",
    "context"
  ].forEach((field) => {
    if (typeof next[field] === "string") {
      next[field] = repairGeneratedVisibleText(next[field]);
    }
  });

  if (next.media && typeof next.media === "object") {
    next.media = repairGeneratedItem(next.media);
  }

  ["cards", "signals", "guardrails", "bullets", "resources", "mediaItems"].forEach((field) => {
    if (Array.isArray(next[field])) {
      next[field] = next[field].map(repairGeneratedItem);
    }
  });

  if (typeof next.signalsTitle === "string") {
    next.signalsTitle = repairPanelTitle(next.signalsTitle, next.signals || next.cards || next.bullets);
  }

  if (typeof next.guardrailsTitle === "string") {
    next.guardrailsTitle = repairPanelTitle(next.guardrailsTitle, next.guardrails);
  }

  if (typeof next.resourcesTitle === "string") {
    next.resourcesTitle = repairPanelTitle(next.resourcesTitle, next.resources || next.bullets);
  }

  return validateSlideSpecObject(next);
}

function finalizeGeneratedSlideSpecs(slideSpecs: GeneratedSlideSpec[], options: ProgressOptions = {}): GeneratedSlideSpec[] {
  const repairedSlideSpecs = slideSpecs.map(repairGeneratedSlideSpec);
  if (typeof options.onProgress === "function") {
    const repairedFields = repairedSlideSpecs.reduce((count, slideSpec, index) => {
      return count + (JSON.stringify(slideSpec) === JSON.stringify(slideSpecs[index]) ? 0 : 1);
    }, 0);

    if (repairedFields > 0) {
      options.onProgress({
        message: `Repaired generated text on ${repairedFields} slide${repairedFields === 1 ? "" : "s"} before validation.`,
        stage: "quality-repair"
      });
    }
  }

  return assertGeneratedSlideQuality(repairedSlideSpecs);
}

function slideIdForIndex(index: number): string {
  return `slide-${String(index + 1).padStart(2, "0")}`;
}

function createGeneratedSlideContexts(slideSpecs: GeneratedSlideSpec[], plan: GeneratedPlan, deckPlan: DeckPlan): JsonObject {
  const planSlides = Array.isArray(plan.slides) ? plan.slides.filter(isGeneratedPlanSlide) : [];
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
      title: cleanText(planSlide.title || slideSpec.title || deckPlanSlide.title || "")
    }];
  }));
}

function compactJson(value: unknown): string {
  return JSON.stringify(value);
}

function createDeckSequenceMap(deckPlan: DeckPlan, options: GenerationOptions = {}): JsonObject {
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
      type: normalizeGeneratedSlideType(slide.type)
    }))
  };
}

function createSingleSlidePromptContext(fullDeckPlan: DeckPlan, slideIndex: number, slideCount: number): JsonObject {
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

function preserveApprovedOutlineSlideTypes(plan: unknown, deckPlan: DeckPlan): GeneratedPlan {
  const sourcePlan = isJsonObject(plan) ? plan : { slides: [] };
  const generatedSlides = Array.isArray(sourcePlan.slides) ? sourcePlan.slides.filter(isGeneratedPlanSlide) : [];
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];

  return {
    ...sourcePlan,
    slides: preserveApprovedSlideTypes(generatedSlides, deckPlanSlides)
  };
}

function createSlideSourceFields(fields: GenerationFields, planSlide: DeckPlanSlide): GenerationFields {
  const query = [
    planSlide && planSlide.title,
    planSlide && planSlide.intent,
    planSlide && planSlide.keyMessage,
    planSlide && (planSlide.sourceNotes || planSlide.sourceNeed)
  ].filter(Boolean).join(" ");

  return {
    ...fields,
    outline: "",
    query,
    slideIntent: planSlide && planSlide.intent || "",
    slideKeyMessage: planSlide && planSlide.keyMessage || "",
    slideSourceNotes: planSlide && (planSlide.sourceNotes || planSlide.sourceNeed) || "",
    slideTitle: planSlide && planSlide.title || "",
    workflow: "slideDrafting"
  };
}

function serializeRetrievalSnippet(snippet: RetrievalSnippet): RetrievalSnippet {
  return {
    chunkIndex: snippet.chunkIndex,
    sourceId: snippet.sourceId,
    text: snippet.text,
    title: snippet.title,
    url: snippet.url
  };
}

function dedupeRetrievalSnippets(snippets: unknown): RetrievalSnippet[] {
  const seen = new Set<string>();
  const results: RetrievalSnippet[] = [];
  (Array.isArray(snippets) ? snippets.filter(isRetrievalSnippet) : []).forEach((snippet: RetrievalSnippet) => {
    const key = [snippet.sourceId || snippet.title || "", snippet.chunkIndex, snippet.text].join(":");
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    results.push(snippet);
  });
  return results;
}

function summarizeCombinedSourceBudget(contexts: SourceContextWithBudget[]): JsonObject | null {
  const budgets = contexts.map((context: SourceContextWithBudget) => context && context.budget).filter(isJsonObject);
  if (!budgets.length) {
    return null;
  }

  return {
    maxPromptChars: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.maxPromptChars || 0), 0),
    maxSnippetChars: Math.max(...budgets.map((budget: JsonObject) => Number(budget.maxSnippetChars || 0))),
    omittedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.omittedSnippetCount || 0), 0),
    promptCharCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.promptCharCount || 0), 0),
    retrievedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.retrievedSnippetCount || 0), 0),
    snippetLimit: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.snippetLimit || 0), 0),
    sourceCount: new Set(contexts.flatMap((context: SourceContextWithBudget) => (context.snippets || []).map((snippet: RetrievalSnippet) => snippet.sourceId || snippet.title || snippet.url || "").filter(Boolean))).size,
    truncatedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.truncatedSnippetCount || 0), 0),
    usedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.usedSnippetCount || 0), 0)
  };
}

async function createLlmPlan(fields: GenerationFields, slideCount: number, options: LlmPlanOptions = {}): Promise<LlmPlanResponse> {
  const suppliedUrls = collectProvidedUrls(fields);
  const sourceContext = fields.sourceContext || { promptText: "", snippets: [] };
  const materialContext = fields.materialContext || { promptText: "", materials: [] };
  const deckPlan = validateDeckPlan(isJsonObject(options.deckPlan) ? options.deckPlan : { slides: [] }, slideCount);
  const slideTarget = options.slideTarget || null;
  const singleSlideContext = options.singleSlideContext || null;
  const result = await createStructuredResponse({
    ...buildSlidePlanPromptRequest({
      compactJson,
      deckPlan,
      fields,
      materialPromptText: materialContext.promptText || "",
      singleSlideContext,
      slideCount,
      slideTarget,
      sourcePromptText: sourceContext.promptText || "",
      suppliedUrls
    }),
    onProgress: options.onProgress,
  });

  return {
    model: result.model,
    plan: preserveApprovedOutlineSlideTypes(result.data, deckPlan),
    promptBudget: result.promptBudget || null,
    provider: result.provider,
    responseId: result.responseId
  };
}

async function createLlmDeckPlan(fields: GenerationFields, slideCount: number, options: ProgressOptions = {}): Promise<DeckPlanResponse> {
  const suppliedUrls = collectProvidedUrls(fields);
  const sourceContext = fields.sourceContext || { promptText: "", snippets: [] };
  const materialContext = fields.materialContext || { promptText: "", materials: [] };
  const lockedOutlineSlides = Array.isArray(fields.lockedOutlineSlides) ? fields.lockedOutlineSlides : [];
  const result = await createStructuredResponse({
    ...buildDeckPlanPromptRequest({
      compactJson,
      fields,
      lockedOutlineSlides,
      materialPromptText: materialContext.promptText || "",
      slideCount,
      sourcePromptText: sourceContext.promptText || "",
      suppliedUrls
    }),
    onProgress: options.onProgress,
  });

  return {
    model: result.model,
    plan: await repairDeckPlanIfNeeded(fields, result.data, slideCount, options),
    promptBudget: result.promptBudget || null,
    provider: result.provider,
    responseId: result.responseId
  };
}

async function repairDeckPlanIfNeeded(fields: GenerationFields, plan: unknown, slideCount: number, options: ProgressOptions = {}): Promise<DeckPlan> {
  const normalizedPlan = normalizeDeckPlanForValidation(fields, plan, slideCount);
  const issues = collectDeckPlanIssues(normalizedPlan, slideCount);
  if (!issues.length) {
    return validateDeckPlan(normalizedPlan, slideCount);
  }

  if (typeof options.onProgress === "function") {
    options.onProgress({
      message: `Repairing deck outline before slide drafting (${issues.length} issue${issues.length === 1 ? "" : "s"}).`,
      stage: "deck-plan-repair"
    });
  }

  const result = await createStructuredResponse({
    ...buildDeckPlanRepairPromptRequest({
      compactJson,
      fields,
      issues,
      normalizedPlan,
      slideCount
    }),
    onProgress: options.onProgress,
  });

  return validateDeckPlan(normalizeDeckPlanForValidation(fields, result.data, slideCount), slideCount);
}

async function generateInitialPresentation(fields: GenerationFields = {}) {
  const deckPlanResponse = await generateInitialDeckPlan(fields);
  const generated = await generatePresentationFromDeckPlan(fields, deckPlanResponse.plan || { slides: [] }, deckPlanResponse);

  return generated;
}

async function generateInitialDeckPlan(fields: GenerationFields = {}) {
  const slideCount = normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = resolveGeneration(fields);
  const sourceContext = getGenerationSourceContext({
    ...fields,
    workflow: "deckPlanning"
  });
  const materialContext = getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 8,
    query: [fields.title, fields.objective, fields.constraints].filter(Boolean).join(" ")
  });
  const generationFields = {
    ...fields,
    materialCandidates: materialContext.materials,
    materialContext,
    sourceContext,
    sourceSnippets: sourceContext.snippets
  };
  if (typeof fields.onProgress === "function") {
    fields.onProgress({
      message: "Planning deck structure with the LLM...",
      stage: "planning-deck"
    });
  }
  const deckPlanResponse = await createLlmDeckPlan(generationFields, slideCount, {
    onProgress: fields.onProgress
  });

  return {
    generation,
    materialContext,
    plan: deckPlanResponse.plan,
    retrieval: {
      budget: sourceContext.budget || null,
      materials: (materialContext.materials || []).map((material: MaterialCandidate) => ({
        alt: material.alt,
        caption: material.caption,
        id: material.id,
        license: material.license,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      })),
      snippets: (sourceContext.snippets || []).map((snippet: RetrievalSnippet) => ({
        chunkIndex: snippet.chunkIndex,
        sourceId: snippet.sourceId,
        text: snippet.text,
        title: snippet.title,
        url: snippet.url
      }))
    },
    responseId: deckPlanResponse.responseId,
    sourceContext,
    targetSlideCount: slideCount
  };
}

async function generatePresentationFromDeckPlan(fields: GenerationFields = {}, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse = {}) {
  const slideCount = normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = deckPlanResponse.generation || resolveGeneration(fields);
  const sourceContext = deckPlanResponse.sourceContext || getGenerationSourceContext({
    ...fields,
    workflow: "deckPlanning"
  });
  const materialContext = deckPlanResponse.materialContext || getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 8,
    query: [fields.title, fields.objective, fields.constraints].filter(Boolean).join(" ")
  });
  const generationFields = {
    ...fields,
    materialCandidates: materialContext.materials,
    materialContext,
    sourceContext,
    sourceSnippets: sourceContext.snippets
  };

  if (typeof fields.onProgress === "function") {
    fields.onProgress({
      message: "Drafting slide details from the approved deck plan...",
      stage: "drafting-slides"
    });
  }
  const response = await createLlmPlan(generationFields, slideCount, {
    deckPlan,
    onProgress: fields.onProgress
  });
  const repairedPlan = await semanticallyRepairPlanText(response.plan, {
    onProgress: fields.onProgress
  });
  const plan = preserveApprovedOutlineSlideTypes(repairedPlan, deckPlan);
  const slideSpecs = finalizeGeneratedSlideSpecs(materializePlan(generationFields, plan), {
    onProgress: fields.onProgress
  });

  return {
    generation: {
      ...generation,
      deckPlanResponseId: deckPlanResponse.responseId || null,
      model: response ? response.model : generation.model,
      provider: response ? response.provider : generation.provider,
      responseId: response ? response.responseId : null
    },
    retrieval: {
      budget: sourceContext.budget || null,
      materials: (materialContext.materials || []).map((material: MaterialCandidate) => ({
        alt: material.alt,
        caption: material.caption,
        id: material.id,
        license: material.license,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      })),
      snippets: (sourceContext.snippets || []).map((snippet: RetrievalSnippet) => ({
        chunkIndex: snippet.chunkIndex,
        sourceId: snippet.sourceId,
        text: snippet.text,
        title: snippet.title,
        url: snippet.url
      }))
    },
    deckPlan,
    outline: deckPlan.outline || plan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideContexts: createGeneratedSlideContexts(slideSpecs, plan, deckPlan),
    slideSpecs,
    summary: `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} with ${response.provider} ${response.model}.`,
    targetSlideCount: slideCount
  };
}

function createSingleSlideDeckPlan(deckPlan: DeckPlan, slideIndex: number, slideCount: number): DeckPlan {
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

function createContentRunStoppedError() {
  const error: ContentRunStoppedError = new Error("Slide generation stopped.");
  error.code = "CONTENT_RUN_STOPPED";
  return error;
}

async function generatePresentationFromDeckPlanIncremental(fields: GenerationFields = {}, deckPlan: DeckPlan, deckPlanResponse: DeckPlanResponse = {}, options: GenerationOptions = {}) {
  const deckPlanSlides = Array.isArray(deckPlan.slides) ? deckPlan.slides.filter(isDeckPlanSlide) : [];
  const slideCount = deckPlanSlides.length || normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = deckPlanResponse.generation || resolveGeneration(fields);
  const deckLevelSourceContext = deckPlanResponse.sourceContext || getGenerationSourceContext({
    ...fields,
    workflow: "deckPlanning"
  });
  const deckLevelMaterialContext = deckPlanResponse.materialContext || getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials,
    maxMaterials: 8,
    query: [fields.title, fields.objective, fields.constraints].filter(Boolean).join(" ")
  });
  const generationFields = {
    ...fields,
    materialCandidates: deckLevelMaterialContext.materials,
    materialContext: deckLevelMaterialContext,
    sourceContext: deckLevelSourceContext,
    sourceSnippets: deckLevelSourceContext.snippets
  };
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Math.max(0, Number(options.startIndex)) : 0;
  const seededSlideSpecs = Array.isArray(options.initialSlideSpecs) ? options.initialSlideSpecs.filter(isGeneratedSlideSpec) : [];
  const seededPlanSlides = Array.isArray(options.initialGeneratedPlanSlides) ? options.initialGeneratedPlanSlides.filter(isGeneratedPlanSlide) : [];
  const slideSpecs: GeneratedSlideSpec[] = startIndex > 0 ? seededSlideSpecs.slice(0, startIndex) : [];
  const generatedPlanSlides: GeneratedPlanSlide[] = startIndex > 0 ? seededPlanSlides.slice(0, startIndex) : [];
  const responses: LlmPlanResponse[] = [];
  const slideSourceContexts: SourceContextWithBudget[] = [];
  const slideMaterialContexts: GenerationContext[] = [];
  const usedMaterialIds = new Set<string>(options.usedMaterialIds instanceof Set ? Array.from(options.usedMaterialIds).filter(Boolean) : []);

  for (let slideIndex = startIndex; slideIndex < slideCount; slideIndex += 1) {
    if (typeof options.shouldStop === "function" && options.shouldStop()) {
      throw createContentRunStoppedError();
    }

    const planSlide = deckPlanSlides[slideIndex] || {};
    const slideSourceContext = getGenerationSourceContext(createSlideSourceFields(fields, planSlide));
    const slideMaterialContext = getGenerationMaterialContext({
      includeActiveMaterials: fields.includeActiveMaterials !== false,
      materials: fields.presentationMaterials,
      maxMaterials: 4,
      query: [
        planSlide.title,
        planSlide.intent,
        planSlide.keyMessage,
        planSlide.visualNeed
      ].filter(Boolean).join(" "),
      slideIntent: planSlide.intent || "",
      slideKeyMessage: planSlide.keyMessage || "",
      slideTitle: planSlide.title || ""
    });
    const slideGenerationFields = {
      ...generationFields,
      materialCandidates: slideMaterialContext.materials,
      materialContext: slideMaterialContext,
      sourceContext: slideSourceContext,
      sourceSnippets: slideSourceContext.snippets
    };
    slideSourceContexts.push(slideSourceContext);
    slideMaterialContexts.push(slideMaterialContext);
    if (typeof fields.onProgress === "function") {
      fields.onProgress({
        message: `Drafting slide ${slideIndex + 1}/${slideCount}: ${planSlide.title || `Slide ${slideIndex + 1}`}`,
        slideCount,
        slideIndex: slideIndex + 1,
        stage: "drafting-slide"
      });
    }

    const singleSlideDeckPlan = createSingleSlideDeckPlan(deckPlan, slideIndex, slideCount);
    const response = await createLlmPlan(slideGenerationFields, 1, {
      deckPlan: singleSlideDeckPlan,
      onProgress: fields.onProgress,
      singleSlideContext: createSingleSlidePromptContext(deckPlan, slideIndex, slideCount),
      slideTarget: {
        intent: planSlide.intent || "",
        keyMessage: planSlide.keyMessage || "",
        role: planSlide.role || "",
        slideCount,
        slideNumber: slideIndex + 1,
        title: planSlide.title || "",
        type: planSlide.type || "content"
      }
    });
    responses.push(response);

    const repairedPlan = await semanticallyRepairPlanText(response.plan, {
      onProgress: fields.onProgress
    });
    const plan = preserveApprovedOutlineSlideTypes(repairedPlan, singleSlideDeckPlan);
    const generatedSlides = Array.isArray(plan.slides) ? plan.slides.filter(isGeneratedPlanSlide) : [];
    if (generatedSlides.length !== 1) {
      throw new Error(`Generated slide ${slideIndex + 1} returned ${generatedSlides.length} slides instead of one.`);
    }
    const generatedSlide = generatedSlides[0];
    if (!generatedSlide) {
      throw new Error(`Generated slide ${slideIndex + 1} did not include plan data.`);
    }
    generatedPlanSlides.push(generatedSlide);

    const [slideSpec] = finalizeGeneratedSlideSpecs(materializePlan(slideGenerationFields, plan, {
      startIndex: slideIndex,
      totalSlides: slideCount,
      usedMaterialIds
    }), {
      onProgress: fields.onProgress
    });
    if (!slideSpec) {
      throw new Error(`Generated slide ${slideIndex + 1} did not produce a slide spec.`);
    }
    const nextSlideSpecs = finalizeGeneratedSlideSpecs([...slideSpecs, slideSpec], {
      onProgress: fields.onProgress
    });
    slideSpecs.splice(0, slideSpecs.length, ...nextSlideSpecs);

    if (typeof options.onSlide === "function") {
      await options.onSlide({
        outline: deckPlan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
        slideCount,
        slideContexts: createGeneratedSlideContexts(slideSpecs, { slides: generatedPlanSlides }, deckPlan),
        slideIndex: slideIndex + 1,
        slideSpec,
        slideSpecs: [...slideSpecs],
        targetSlideCount: slideCount
      });
    }

    if (typeof options.shouldStop === "function" && options.shouldStop()) {
      throw createContentRunStoppedError();
    }
  }

  const lastResponse = responses[responses.length - 1] || null;
  const retrievalSourceContexts = slideSourceContexts.length ? slideSourceContexts : [deckLevelSourceContext];
  const retrievalMaterials = (slideMaterialContexts.length ? slideMaterialContexts : [deckLevelMaterialContext])
    .flatMap((context) => context.materials || []);
  const materialMap = new Map();
  retrievalMaterials.forEach((material) => {
    if (!materialMap.has(material.id)) {
      materialMap.set(material.id, material);
    }
  });
  const retrievalSnippets = dedupeRetrievalSnippets(retrievalSourceContexts.flatMap((context) => context.snippets || []));

  return {
    generation: {
      ...generation,
      deckPlanResponseId: deckPlanResponse.responseId || null,
      model: lastResponse ? lastResponse.model : generation.model,
      provider: lastResponse ? lastResponse.provider : generation.provider,
      responseId: lastResponse ? lastResponse.responseId : null,
      slideResponseIds: responses.map((response) => response.responseId).filter(Boolean)
    },
    retrieval: {
      budget: summarizeCombinedSourceBudget(retrievalSourceContexts),
      materials: Array.from(materialMap.values()).map((material) => ({
        alt: material.alt,
        caption: material.caption,
        id: material.id,
        license: material.license,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      })),
      snippets: retrievalSnippets.map(serializeRetrievalSnippet)
    },
    deckPlan,
    outline: deckPlan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideContexts: createGeneratedSlideContexts(slideSpecs, { slides: generatedPlanSlides }, deckPlan),
    slideSpecs,
    summary: `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} one at a time with ${lastResponse ? `${lastResponse.provider} ${lastResponse.model}` : "the configured LLM"}.`,
    targetSlideCount: slideCount
  };
}

export {
  generateInitialDeckPlan,
  generateInitialPresentation,
  generatePresentationFromDeckPlan,
  generatePresentationFromDeckPlanIncremental,
  materializePlan,
  normalizeSlideCount
};
