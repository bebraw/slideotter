import { contentRoles, normalizeGeneratedSlideType, supportedPlanRoles } from "./generated-plan-repair.ts";
import { resolveSlideMaterial, resolveSlideMaterials } from "./generated-materials.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import type { MaterialCandidate } from "./generated-materials.ts";

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

type GeneratedPlan = JsonObject & {
  references?: GeneratedReference[];
  slides?: GeneratedPlanSlide[];
};

type GeneratedReference = {
  title?: unknown;
  url?: unknown;
};

type SlideSpecObject = JsonObject;

type SlideItem = JsonObject & {
  body?: unknown;
  label?: unknown;
  title?: unknown;
  value?: unknown;
};

export type GeneratedSlideSpec = SlideSpecObject & {
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

type NormalizedPoint = {
  body: string;
  title: string;
};

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

type MaterialMedia = {
  alt: string;
  caption?: string;
  id: string;
  src: unknown;
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

function isGeneratedPlanSlide(value: unknown): value is GeneratedPlanSlide {
  return isJsonObject(value);
}

function isSlideItem(value: unknown): value is SlideItem {
  return isJsonObject(value);
}

function validateSlideSpecObject<T extends SlideSpecObject>(spec: T): T {
  const validated = validateSlideSpec(spec);
  return isJsonObject(validated) ? { ...spec, ...validated } : spec;
}

function normalizeVisibleText(value: unknown): string {
  return String(value || "")
    .replace(/…/g, "")
    .replace(/\.{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function planSlideSignature(planSlide: GeneratedPlanSlide): string {
  const keyPoints = Array.isArray(planSlide.keyPoints) ? planSlide.keyPoints : [];
  return normalizeVisibleText([
    planSlide && planSlide.title,
    planSlide && planSlide.summary,
    ...keyPoints.flatMap((point: TextPoint) => [point && point.title, point && point.body])
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function normalizePlanForMaterialization(_fields: GenerationFieldsForMaterialization, plan: GeneratedPlan, options: GenerationMaterializationOptions = {}): GeneratedPlan {
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

function firstVisiblePlanValue(...values: unknown[]): string {
  for (const value of values) {
    const normalized = cleanText(value);
    if (normalized && !isWeakLabel(normalized) && !isScaffoldLeak(normalized)) {
      return normalized;
    }
  }

  return "";
}

function isGenericPlanSummary(value: unknown): boolean {
  return /^(opening frame|section divider|concrete example slide|closing handoff|handoff slide|reference slide|concept slide|context slide|mechanics slide|tradeoff slide)\b/i.test(String(value || "").trim())
    || /\bslide that shows how\b/i.test(String(value || ""));
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
    next.title = firstVisiblePlanValue(
      next.summary,
      firstPointTitle,
      firstGuardrailTitle,
      firstResourceTitle,
      next.note,
      next.intent
    ) || title;
  }
  next.eyebrow = firstVisiblePlanValue(next.eyebrow, next.section, next.label, roleEyebrow(role, index, total));
  next.note = firstVisiblePlanValue(
    next.note,
    next.speakerNote,
    next.speakerNotes,
    next.summary,
    next.title
  );
  if (!cleanText(next.summary) || isGenericPlanSummary(next.summary)) {
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

export function materializePlan(fields: GenerationFieldsForMaterialization, plan: GeneratedPlan, options: GenerationMaterializationOptions = {}): GeneratedSlideSpec[] {
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

export function finalizeGeneratedSlideSpecs(slideSpecs: GeneratedSlideSpec[], options: ProgressOptions = {}): GeneratedSlideSpec[] {
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
