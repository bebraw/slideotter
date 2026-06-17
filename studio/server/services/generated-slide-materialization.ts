import { hasApprovedTypePreserved } from "./generated-plan-repair.ts";
import { completePlanSlideFields, isGenericPlanSummary, normalizePlanForMaterialization } from "./generated-slide-plan-normalization.ts";
import { resolvePhotoGridMaterialSet, resolvePlanSlideMedia } from "./generated-slide-media.ts";
import { areNearDuplicateVisibleText, cleanText, isAuthoringMetaText, isScaffoldLeak, isWeakLabel, requireVisibleText, sentence } from "./generated-text-hygiene.ts";
import { collectProvidedUrls } from "./generation-source-urls.ts";
import { validateSlideSpec } from "./validate-slide-spec.ts";
import type { MaterialCandidate } from "./generated-material-types.ts";
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
const contentCardTitleWordLimit = 5;
const contentSignalBodyWordLimit = 8;
const contentGuardrailBodyWordLimit = 9;
const coverIntents = ["agenda", "chapter", "identity", "proof", "statement"] as const;

type CoverIntent = typeof coverIntents[number];

type SlideItemLimits = {
  bodyWords?: number;
  titleWords?: number;
};

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
};

type CompositionArchetype =
  | "agenda"
  | "bullets"
  | "chapter"
  | "checklist"
  | "identity"
  | "image-split"
  | "proof"
  | "quote-pull"
  | "spotlight"
  | "statement"
  | "steps";

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

function compositionIntent(archetype: CompositionArchetype, focalPoint: string, rationale: string): JsonObject {
  return {
    archetype,
    focalPoint: sentence(focalPoint, focalPoint, 6),
    rationale: sentence(rationale, rationale, 14)
  };
}

function narrationText(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary, title: string, summary: string, points: NormalizedPoint[] = []): string {
  const speakerText = cleanText(planSlide.speakerNote || planSlide.speakerNotes);
  if (speakerText && !isWeakLabel(speakerText) && !isScaffoldLeak(speakerText) && !isAuthoringMetaText(speakerText)) {
    return sentence(speakerText, speakerText, 56);
  }

  const primary = isUsableVisibleText(summary, boundary) ? cleanText(summary) : cleanText(title);
  const support = points
    .flatMap((point) => [cleanText(point.body), cleanText(point.title)])
    .find((value) => isUsableVisibleText(value, boundary) && !areNearDuplicateVisibleText(value, primary));
  const script = [primary, support].filter(Boolean).join(". ");
  return sentence(script, primary || title, 44);
}

function narrationForSlide(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary, title: string, summary: string, points: NormalizedPoint[] = []): JsonObject {
  const script = narrationText(planSlide, boundary, title, summary, points);
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  return {
    advance: "afterSpeech",
    durationSeconds: Math.max(8, Math.min(90, Math.ceil(wordCount / 1.65))),
    script
  };
}

function slugPart(value: unknown, fallback = "item"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return slug || fallback;
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

function distinctVisibleBodyPoints(points: NormalizedPoint[]): NormalizedPoint[] {
  return uniqueBy(points, (point) => point.body.toLowerCase());
}

function normalizedPointsOrEmpty(points: unknown, fieldName: string, boundary: VisibleTextBoundary): NormalizedPoint[] {
  try {
    return normalizeAllGeneratedPoints(points, fieldName, boundary);
  } catch (_error) {
    return [];
  }
}

function fillGeneratedPoints(points: NormalizedPoint[], fallbackPoints: NormalizedPoint[], count: number): NormalizedPoint[] {
  return distinctVisibleBodyPoints([...points, ...fallbackPoints])
    .slice(0, count);
}

function fallbackGuardrailPoints(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): NormalizedPoint[] {
  const keyPoints = normalizedPointsOrEmpty(planSlide.keyPoints, "keyPoints", boundary);
  const summary = cleanText(planSlide.summary);
  const slideTitle = cleanText(planSlide.title);

  return keyPoints.slice(0, 3).map((point, index) => {
    const anchor = sentence(point.title || point.body, point.body, 6);
    const fallbackBody = sentence(point.body, summary || slideTitle || point.body, defaultCardBodyWordLimit);

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

function contentSignalPoints(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): NormalizedPoint[] {
  const anchors = [planSlide.title, planSlide.summary]
    .map((value) => cleanText(value))
    .filter(Boolean);
  const fallbackDistinctPoints = (points: NormalizedPoint[]) => distinctVisibleBodyPoints(points)
    .filter((point) => !anchors.some((anchor) => areNearDuplicateVisibleText(point.body, anchor)));
  const keyPoints = normalizedPointsOrEmpty(planSlide.keyPoints, "keyPoints", boundary);
  const distinctKeyPoints = fallbackDistinctPoints(keyPoints);
  if (distinctKeyPoints.length >= 3) {
    return distinctKeyPoints.slice(0, 3);
  }

  const rawFallbackPoints = [
    ...normalizedPointsOrEmpty(planSlide.guardrails, "guardrails", boundary).map((point) => ({
      body: sentence(`${point.title}: ${point.body}`, point.body, defaultCardBodyWordLimit),
      title: point.title
    })),
    ...normalizedPointsOrEmpty(planSlide.resources, "resources", boundary)
  ];
  const fallbackPoints = fallbackDistinctPoints(rawFallbackPoints);
  const filled = fillGeneratedPoints(distinctKeyPoints, fallbackPoints, 3);
  if (filled.length < 3) {
    const emergencyFilled = fillGeneratedPoints(keyPoints, rawFallbackPoints, 3);
    if (emergencyFilled.length >= 3) {
      return emergencyFilled;
    }

    throw new Error("Generated presentation plan needs 3 distinct keyPoints items that do not repeat the slide title or summary.");
  }

  return filled;
}

function summaryBulletPoints(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): NormalizedPoint[] {
  const keyPoints = normalizedPointsOrEmpty(planSlide.keyPoints, "keyPoints", boundary);
  if (keyPoints.length >= 3) {
    return keyPoints.slice(0, 3);
  }

  const filled = fillGeneratedPoints(keyPoints, fallbackPointsForField(planSlide, boundary, "keyPoints"), 3);
  if (filled.length < 3) {
    throw new Error("Generated presentation plan needs 3 distinct keyPoints items in the deck language.");
  }

  return filled;
}

function hasRejectedResourceText(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): boolean {
  return Array.isArray(planSlide.resources) && planSlide.resources.filter(isTextPoint).some((point: TextPoint) => {
    const visibleValues = [point.title, point.body].map(cleanText).filter(Boolean);
    return visibleValues.some((value) => isScaffoldLeak(value) || isAuthoringMetaText(value) || isInternalPlanningText(value, boundary));
  });
}

function hasUnrepairableRejectedResourceText(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): boolean {
  return Array.isArray(planSlide.resources) && planSlide.resources.filter(isTextPoint).some((point: TextPoint) => {
    const visibleValues = [point.title, point.body].map(cleanText).filter(Boolean);
    return visibleValues.some((value) => isScaffoldLeak(value) || isInternalPlanningText(value, boundary));
  });
}

function summaryResourcePoints(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary, bulletPoints: NormalizedPoint[]): NormalizedPoint[] {
  const bulletAnchors = bulletPoints.flatMap((point) => [point.title, point.body]).filter(Boolean);
  const resourcePoints = distinctPointsAwayFromAnchors(
    normalizeAllGeneratedPoints(planSlide.resources, "resources", boundary),
    bulletAnchors
  );
  const fallbackPoints = distinctPointsAwayFromAnchors(
    fallbackPointsForField(planSlide, boundary, "resources"),
    bulletAnchors
  );
  const filled = fillGeneratedPoints(resourcePoints, fallbackPoints, 2);

  if (
    filled.length < 2
    || hasUnrepairableRejectedResourceText(planSlide, boundary)
    || (hasRejectedResourceText(planSlide, boundary) && resourcePoints.length === 0)
  ) {
    throw new Error("Generated presentation plan needs 2 distinct resources items that do not repeat summary bullets.");
  }

  return filled;
}

function toSlideItems(points: NormalizedPoint[], prefix: string, limits: SlideItemLimits = {}): NormalizedPoint[] {
  const bodyLimit = limits.bodyWords || defaultCardBodyWordLimit;
  const titleLimit = limits.titleWords || defaultCardTitleWordLimit;
  return points.map((point, index) => {
    const body = sentence(point.body, point.body, bodyLimit);
    const rawTitle = sentence(point.title, point.title, titleLimit);
    const title = isWeakLabel(rawTitle) || isScaffoldLeak(rawTitle) || isAuthoringMetaText(rawTitle)
      ? sentence(body, body, titleLimit)
      : rawTitle;
    return {
      body,
      id: `${prefix}-${index + 1}`,
      title
    };
  });
}

function panelTitleText(planSlide: GeneratedPlanSlide, fieldName: "guardrailsTitle" | "signalsTitle", limit: number, boundary: VisibleTextBoundary): string {
  return planFieldText(planSlide, fieldName, limit, boundary);
}

function fallbackPointsForField(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary, fieldName: "guardrails" | "keyPoints" | "resources"): NormalizedPoint[] {
  return (["keyPoints", "guardrails", "resources"] as const)
    .filter((candidateFieldName) => candidateFieldName !== fieldName)
    .flatMap((candidateFieldName) => normalizedPointsOrEmpty(planSlide[candidateFieldName], candidateFieldName, boundary));
}

function pointRepeatsAnyAnchor(point: NormalizedPoint, anchors: string[]): boolean {
  return anchors.some((anchor) => areNearDuplicateVisibleText(point.body, anchor) || areNearDuplicateVisibleText(point.title, anchor));
}

function distinctPointsAwayFromAnchors(points: NormalizedPoint[], anchors: string[]): NormalizedPoint[] {
  return distinctVisibleBodyPoints(points)
    .filter((point) => !pointRepeatsAnyAnchor(point, anchors));
}

function coverCardPointsInRange(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary, minCount: number, maxCount: number): NormalizedPoint[] {
  if (maxCount <= 0) {
    return [];
  }

  const visibleCandidates = normalizeAllGeneratedPoints(planSlide.keyPoints, "keyPoints", boundary);
  const anchors = [
    cleanText(planSlide.summary),
    cleanText(planSlide.note),
    cleanText(planSlide.title)
  ].filter(Boolean);
  const distinctCandidates = distinctPointsAwayFromAnchors(visibleCandidates, anchors);
  const fallbackPoints = distinctPointsAwayFromAnchors(fallbackPointsForField(planSlide, boundary, "keyPoints"), anchors);
  const filled = fillGeneratedPoints(distinctCandidates, fallbackPoints, maxCount);

  return filled.length >= minCount ? filled : [];
}

function normalizeCoverIntent(value: unknown): CoverIntent | "" {
  const text = cleanText(value).toLowerCase();
  return coverIntents.includes(text as CoverIntent) ? text as CoverIntent : "";
}

function deriveCoverIntent(planSlide: GeneratedPlanSlide, media: MaterialMedia | undefined): CoverIntent {
  const requestedIntent = normalizeCoverIntent(planSlide.coverIntent);
  if (requestedIntent) {
    return requestedIntent;
  }

  const guidance = [
    planSlide.intent,
    planSlide.value,
    planSlide.visualNeed,
    planSlide.visualNeeds,
    planSlide.sourceNeed,
    planSlide.sourceNeeds,
    planSlide.summary
  ].map((value) => cleanText(value).toLowerCase()).join(" ");

  if (/\b(agenda|question|questions|promise|promises|preview)\b/.test(guidance)) {
    return "agenda";
  }

  if (/\b(proof|evidence|metric|data|source|citation|screenshot|demo)\b/.test(guidance)) {
    return "proof";
  }

  if (/\b(chapter|section|part|topic)\b/.test(guidance)) {
    return "chapter";
  }

  if (media) {
    return "identity";
  }

  return "statement";
}

function coverMediaTreatment(media: MaterialMedia | undefined): MaterialMedia | undefined {
  return media
    ? {
        ...media,
        fit: "cover",
        focalPoint: media.focalPoint || "center"
      }
    : undefined;
}

function coverCardsForIntent(intent: CoverIntent, planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary, media: MaterialMedia | undefined): NormalizedPoint[] {
  if (intent === "agenda") {
    return coverCardPointsInRange(planSlide, boundary, 2, 3);
  }

  if (intent === "proof" && !media) {
    return coverCardPointsInRange(planSlide, boundary, 1, 1);
  }

  return [];
}

function coverNoteText(planSlide: GeneratedPlanSlide, summary: string, cards: NormalizedPoint[], boundary: VisibleTextBoundary): string {
  const note = planFieldText(planSlide, "note", 14, boundary);
  const anchors = [
    summary,
    cleanText(planSlide.title)
  ].filter(Boolean);
  if (!anchors.some((anchor) => areNearDuplicateVisibleText(note, anchor))) {
    return note;
  }

  const replacement = [
    ...cards.map((card) => card.body),
    ...cards.map((card) => card.title),
    ...fallbackPointsForField(planSlide, boundary, "keyPoints").map((point) => point.body)
  ].find((candidate) => isUsableVisibleText(candidate, boundary) && !anchors.some((anchor) => areNearDuplicateVisibleText(candidate, anchor)));

  if (!replacement) {
    throw new Error("Generated presentation plan repeats the cover summary as the cover note.");
  }

  return sentence(replacement, replacement, 14);
}

function planFieldText(planSlide: GeneratedPlanSlide, fieldName: keyof GeneratedPlanSlide, limit: number, boundary: VisibleTextBoundary): string {
  const text = requireVisibleText(planSlide && planSlide[fieldName], fieldName);
  if (isWeakLabel(text) || isScaffoldLeak(text) || isAuthoringMetaText(text) || isInternalPlanningText(text, boundary)) {
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

function optionalEyebrow(planSlide: GeneratedPlanSlide, boundary: VisibleTextBoundary): JsonObject {
  const text = cleanText(planSlide && planSlide.eyebrow);
  if (!text || isWeakLabel(text) || isScaffoldLeak(text) || isAuthoringMetaText(text) || isInternalPlanningText(text, boundary)) {
    return {};
  }

  const anchors = [planSlide.title, planSlide.summary]
    .map((value) => cleanText(value))
    .filter(Boolean);
  if (anchors.some((anchor) => areNearDuplicateVisibleText(text, anchor))) {
    return {};
  }

  return {
    eyebrow: sentence(text, text, 4)
  };
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

function contentSlideLayout(planSlide: GeneratedPlanSlide): string {
  if (planSlide.role === "mechanics") {
    return "spotlight";
  }
  if (planSlide.role === "concept" || planSlide.role === "context") {
    return "statement";
  }
  return planSlide.role !== "tradeoff" ? "bullets" : "checklist";
}

function contentSlideArchetype(layout: string, media?: MaterialMedia): CompositionArchetype {
  if (media) {
    return "image-split";
  }
  if (layout === "spotlight" || layout === "statement" || layout === "bullets") {
    return layout;
  }
  return "checklist";
}

function contentSlideFocus(layout: string, media?: MaterialMedia): string {
  if (media) {
    return "image and claim";
  }
  if (layout === "spotlight") {
    return "keyword";
  }
  if (layout === "statement") {
    return "claim";
  }
  return "bullets";
}

function contentSlideRationale(layout: string, media?: MaterialMedia): string {
  if (media) {
    return "Available material can carry the slide beside concise support.";
  }
  if (layout === "spotlight") {
    return "Mechanics slides benefit from one dominant keyword.";
  }
  if (layout === "statement") {
    return "Context slides read best as one claim with support.";
  }
  return "Plain bullets are the readable fallback for dense detail.";
}

function toContentSlide(planSlide: GeneratedPlanSlide, index: number, media?: MaterialMedia): SlideSpecObject {
  const boundary = createVisibleTextBoundary(planSlide);
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const secondaryPoints = contentGuardrailPoints(planSlide, boundary);
  const signalPoints = contentSignalPoints(planSlide, boundary);
  const summary = planSummaryText(planSlide, 14, boundary);
  const title = planTitleText(planSlide, 8, boundary);
  const usePlainBullets = planSlide.role !== "tradeoff";
  const layout = contentSlideLayout(planSlide);

  return validateSlideSpecObject({
    compositionIntent: compositionIntent(
      contentSlideArchetype(layout, media),
      contentSlideFocus(layout, media),
      contentSlideRationale(layout, media)
    ),
    ...optionalEyebrow(planSlide, boundary),
    guardrails: secondaryPoints.map((point, guardrailIndex) => ({
      body: sentence(point.body, point.body, contentGuardrailBodyWordLimit),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point.title, point.title, contentCardTitleWordLimit)
    })),
    guardrailsTitle: usePlainBullets
      ? sentence(secondaryPoints[0]?.title, secondaryPoints[0]?.body || planSlide.summary, contentCardTitleWordLimit)
      : panelTitleText(planSlide, "guardrailsTitle", 5, boundary),
    layout,
    narration: narrationForSlide(planSlide, boundary, title, summary, signalPoints),
    signals: toSlideItems(signalPoints, `${prefix}-signal`, { bodyWords: contentSignalBodyWordLimit, titleWords: contentCardTitleWordLimit }),
    signalsTitle: usePlainBullets
      ? sentence(signalPoints[0]?.title, signalPoints[0]?.body || planSlide.summary, contentCardTitleWordLimit)
      : panelTitleText(planSlide, "signalsTitle", 4, boundary),
    summary,
    title,
    type: "content"
  });
}

function toDividerSlide(planSlide: GeneratedPlanSlide): SlideSpecObject {
  const boundary = createVisibleTextBoundary(planSlide);
  const title = planTitleText(planSlide, 8, boundary);
  return validateSlideSpecObject({
    compositionIntent: compositionIntent("chapter", "section title", "Divider slide creates narrative rhythm."),
    narration: narrationForSlide(planSlide, boundary, title, title),
    title,
    type: "divider"
  });
}

function toPhotoGridSlide(planSlide: GeneratedPlanSlide, index: number, mediaItems: MaterialMedia[]): SlideSpecObject {
  const boundary = createVisibleTextBoundary(planSlide);
  const summary = planSummaryText(planSlide, 14, boundary);
  const title = planTitleText(planSlide, 8, boundary);
  return validateSlideSpecObject({
    caption: summary,
    compositionIntent: compositionIntent("image-split", "image set", "Multiple materials should be large enough to compare visually."),
    mediaItems: mediaItems.slice(0, 3).map((media, mediaIndex) => ({
      ...media,
      caption: media.caption || sentence(summary, title, 14),
      title: sentence(media.alt || title, title, 6),
      id: media.id || `${slugPart(planSlide.title, `photo-grid-${index}`)}-${mediaIndex + 1}`
    })),
    narration: narrationForSlide(planSlide, boundary, title, summary),
    summary,
    title,
    type: "photoGrid"
  });
}

function toCoverSlide(params: {
  boundary: VisibleTextBoundary;
  materialCandidates: MaterialCandidate[];
  planSlide: GeneratedPlanSlide;
  prefix: string;
  title: string;
  usedMaterialIds: Set<string>;
}): SlideSpecObject {
  const media = coverMediaTreatment(resolvePlanSlideMedia(params.planSlide, params.materialCandidates, params.usedMaterialIds));
  const summary = planSummaryText(params.planSlide, 14, params.boundary);
  let coverIntent = deriveCoverIntent(params.planSlide, media);
  let cards = coverCardsForIntent(coverIntent, params.planSlide, params.boundary, media);
  if (coverIntent === "agenda" && cards.length < 2) {
    coverIntent = "statement";
    cards = [];
  }
  const note = coverIntent === "agenda" || coverIntent === "proof"
    ? coverNoteText(params.planSlide, summary, cards, params.boundary)
    : "";
  return validateSlideSpecObject({
    ...(cards.length ? { cards: toSlideItems(cards, `${params.prefix}-card`) } : {}),
    compositionIntent: compositionIntent(coverIntent, coverIntent === "identity" ? "brand" : coverIntent, "Opening slide uses a constrained cover archetype."),
    coverIntent,
    ...optionalEyebrow(params.planSlide, params.boundary),
    layout: coverIntent,
    ...(media ? { media } : {}),
    ...(note ? { note } : {}),
    narration: narrationForSlide(params.planSlide, params.boundary, params.title, summary, cards),
    summary,
    title: params.title,
    type: "cover"
  });
}

function toSummarySlide(params: {
  boundary: VisibleTextBoundary;
  materialCandidates: MaterialCandidate[];
  planSlide: GeneratedPlanSlide;
  prefix: string;
  references: GeneratedReference[];
  usedMaterialIds: Set<string>;
}): SlideSpecObject {
  const media = resolvePlanSlideMedia(params.planSlide, params.materialCandidates, params.usedMaterialIds);
  const bulletPoints = summaryBulletPoints(params.planSlide, params.boundary);
  const generatedResources = summaryResourcePoints(params.planSlide, params.boundary, bulletPoints);
  const referenceByUrl: Map<string, GeneratedReference> = new Map(params.references.map((reference: GeneratedReference) => [String(reference.url || "").trim(), reference]));
  const resourceItems = generatedResources.map((resource, resourceIndex) => {
    const matchingReference = referenceByUrl.get(String(resource.body || "").trim());

    return {
      body: matchingReference ? matchingReference.url : sentence(resource.body, resource.body, 18),
      id: `${params.prefix}-resource-${resourceIndex + 1}`,
      title: sentence(resource.title, matchingReference && matchingReference.title || resource.title, 5)
    };
  });
  const title = planTitleText(params.planSlide, 8, params.boundary);
  const summary = planSummaryText(params.planSlide, 14, params.boundary);

  return validateSlideSpecObject({
    bullets: toSlideItems(bulletPoints, `${params.prefix}-bullet`),
    compositionIntent: compositionIntent("checklist", "takeaway", "Summary slide closes with a compact action list."),
    ...optionalEyebrow(params.planSlide, params.boundary),
    layout: "checklist",
    ...(media ? { media } : {}),
    resources: resourceItems.map((resource, resourceIndex) => ({
      body: sentence(resource.body, resource.body, 12),
      id: `${params.prefix}-resource-${resourceIndex + 1}`,
      title: sentence(resource.title, resource.title, 5)
    })),
    resourcesTitle: planFieldText(params.planSlide, "resourcesTitle", 5, params.boundary),
    narration: narrationForSlide(params.planSlide, params.boundary, title, summary, bulletPoints),
    summary,
    title,
    type: "summary"
  });
}

function toPhotoGridSlideIfReady(planSlide: GeneratedPlanSlide, slideNumber: number, materialCandidates: MaterialCandidate[]): SlideSpecObject | null {
  if (planSlide.type !== "photoGrid") {
    return null;
  }
  const mediaItems = resolvePhotoGridMaterialSet(planSlide, materialCandidates);
  return mediaItems.length >= 2 ? toPhotoGridSlide(planSlide, slideNumber, mediaItems) : null;
}

function shouldUseSummarySlide(planSlide: GeneratedPlanSlide, isLast: boolean, approvedTypePreserved: boolean, requestedType: string): boolean {
  return isLast && (planSlide.type === "summary" || !approvedTypePreserved || !requestedType);
}

function materializePlanSlide(params: {
  approvedTypePreserved: boolean;
  boundary: VisibleTextBoundary;
  isFirst: boolean;
  isLast: boolean;
  materialCandidates: MaterialCandidate[];
  planSlide: GeneratedPlanSlide;
  prefix: string;
  references: GeneratedReference[];
  requestedType: string;
  slideNumber: number;
  title: string;
  usedMaterialIds: Set<string>;
}): SlideSpecObject {
  if (params.isFirst) {
    return toCoverSlide(params);
  }
  if (shouldUseSummarySlide(params.planSlide, params.isLast, params.approvedTypePreserved, params.requestedType)) {
    return toSummarySlide(params);
  }
  if (params.planSlide.role === "divider") {
    return toDividerSlide(params.planSlide);
  }

  const photoGridSlide = toPhotoGridSlideIfReady(params.planSlide, params.slideNumber, params.materialCandidates);
  if (photoGridSlide) {
    return photoGridSlide;
  }

  const media = resolvePlanSlideMedia(params.planSlide, params.materialCandidates, params.usedMaterialIds);
  return validateSlideSpecObject({
    ...toContentSlide(params.planSlide, params.slideNumber, media),
    ...(media ? { media } : {})
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
    const rawPlanSlide = rawSlides[index];
    const requestedType = cleanText(rawPlanSlide && rawPlanSlide.type);
    const approvedTypePreserved = hasApprovedTypePreserved(rawPlanSlide);
    const slideNumber = startIndex + index + 1;
    const isFirst = slideNumber === 1;
    const isLast = slideNumber === total && total > 1;
    const prefix = slugPart(planSlide.title, `slide-${slideNumber}`);
    const boundary = createVisibleTextBoundary(planSlide);
    return materializePlanSlide({
      approvedTypePreserved,
      boundary,
      isFirst,
      isLast,
      materialCandidates,
      planSlide,
      prefix,
      references,
      requestedType,
      slideNumber,
      title,
      usedMaterialIds
    });
  });
}
