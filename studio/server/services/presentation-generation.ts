// Staged presentation generation owns outline planning, slide drafting, local fallback
// materialization, and generation repair. Keep model output as candidate data; local
// validation and presentation write paths remain authoritative.
import { createStructuredResponse, getLlmStatus } from "./llm/client.ts";
import { getGenerationSourceContext } from "./sources.ts";
import { getGenerationMaterialContext } from "./materials.ts";
import { contentRoles, isSupportedSlideType, normalizeGeneratedSlideType, preserveApprovedSlideTypes, supportedPlanRoles, supportedSlideTypes } from "./generated-plan-repair.ts";
import { semanticallyRepairPlanText } from "./generated-text-repair.ts";
import { buildDeckPlanPromptRequest, buildDeckPlanRepairPromptRequest, buildSlidePlanPromptRequest } from "./generated-prompting.ts";
import { finalizeGeneratedSlideSpecs, materializePlan } from "./generated-slide-materialization.ts";
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

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDeckPlanSlide(value: unknown): value is DeckPlanSlide {
  return isJsonObject(value);
}

function isGeneratedPlanSlide(value: unknown): value is GeneratedPlanSlide {
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

function normalizeSlideCount(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return defaultSlideCount;
  }

  return Math.min(Math.max(1, parsed), maximumSlideCount);
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
