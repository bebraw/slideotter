import { cleanText, hasDanglingEnding, isAuthoringMetaText, isKnownBadTranslation, isScaffoldLeak, isUnsupportedBibliographicClaim, isWeakLabel, normalizeVisibleText, repairKnownBadTranslations, sentence } from "./generated-text-hygiene.ts";
import { isJsonObject, isSlideItem } from "./generated-slide-shape-guards.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import type { GeneratedSlideSpec, JsonObject, SlideItem } from "./generated-slide-types.ts";

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
};

function validateSlideSpecObject<T extends JsonObject>(spec: T): T {
  const validated = validateSlideSpec(spec);
  return isJsonObject(validated) ? { ...spec, ...validated } : spec;
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

    const authoringMetaText = visibleText.filter(isAuthoringMetaText);
    if (authoringMetaText.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains authoring instructions as visible text: ${authoringMetaText.join(", ")}`);
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

    const badTranslations = visibleText.filter(isKnownBadTranslation);
    if (badTranslations.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains known bad translation text: ${badTranslations.join(", ")}`);
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
    .find((title) => title && !isWeakLabel(title) && !isScaffoldLeak(title) && !isAuthoringMetaText(title)) || "";
}

function repairPanelTitle(value: unknown, items: unknown): string {
  const text = cleanText(value);
  if (text && !isWeakLabel(text) && !isScaffoldLeak(text) && !isAuthoringMetaText(text)) {
    return text;
  }

  return firstUsefulItemTitle(items) || text || "";
}

function repairGeneratedVisibleText(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  let text = normalizeVisibleText(repairKnownBadTranslations(value))
    .replace(/\b(title|summary|body):\s*$/i, "")
    .trim();

  const words = text.split(/\s+/).filter(Boolean);
  while (words.length > 4) {
    if (!hasDanglingEnding(words.join(" "))) {
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

  if (typeof next.title === "string" && (isWeakLabel(next.title) || isScaffoldLeak(next.title) || isAuthoringMetaText(next.title))) {
    const bodyTitle = sentence(next.body || next.value || next.label || "", next.body || next.value || next.label || "", 4);
    if (bodyTitle && !isWeakLabel(bodyTitle) && !isScaffoldLeak(bodyTitle) && !isAuthoringMetaText(bodyTitle)) {
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
