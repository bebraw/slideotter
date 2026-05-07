import { cleanText, hasDanglingEnding, isAuthoringMetaText, isScaffoldLeak, isWeakLabel, normalizeVisibleText, repairKnownBadTranslations, sentence } from "./generated-text-hygiene.ts";
import { isJsonObject, isSlideItem } from "./generated-slide-shape-guards.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import type { GeneratedSlideSpec, JsonObject, SlideItem } from "./generated-slide-types.ts";
import {
  collectVisibleItems,
  collectVisibleTextIssues,
  visibleItemSignature
} from "./visible-text-quality.ts";

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
  repairNearbyDuplicateItems?: boolean | undefined;
};

function validateSlideSpecObject<T extends JsonObject>(spec: T): T {
  const validated = validateSlideSpec(spec);
  return isJsonObject(validated) ? { ...spec, ...validated } : spec;
}

function assertGeneratedSlideQuality(slideSpecs: GeneratedSlideSpec[]): GeneratedSlideSpec[] {
  const seenSlideSignatures = new Map<string, number>();
  const seenItemSignatures = new Map<string, number>();

  slideSpecs.forEach((slideSpec: GeneratedSlideSpec, slideIndex: number) => {
    const visibleIssues = collectVisibleTextIssues(slideSpec);
    const weakLabels = visibleIssues
      .filter((issue) => issue.code === "weak-label" || issue.code === "fallback-scaffold" || issue.code === "schema-label")
      .map((issue) => issue.text);
    if (weakLabels.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains placeholder text: ${weakLabels.join(", ")}`);
    }

    const authoringMetaText = visibleIssues
      .filter((issue) => issue.code === "authoring-meta" || issue.code === "planning-language")
      .map((issue) => issue.text);
    if (authoringMetaText.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains authoring instructions as visible text: ${authoringMetaText.join(", ")}`);
    }

    const ellipsisText = visibleIssues.filter((issue) => issue.code === "ellipsis-truncation");
    if (ellipsisText.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains ellipsis-truncated text.`);
    }

    const danglingText = visibleIssues.filter((issue) => issue.code === "dangling-fragment");
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

    const slideTitle = normalizeVisibleText(slideSpec.title).toLowerCase();
    const repeatedTitleItems = collectVisibleItems(slideSpec).filter((item: SlideItem) => {
      const itemTitle = normalizeVisibleText(item.title).toLowerCase();
      return itemTitle && slideTitle && itemTitle === slideTitle;
    });
    if (repeatedTitleItems.length) {
      throw new Error(`Generated slide ${slideIndex + 1} repeats the slide title as visible card content.`);
    }

    const fakeBibliographicClaims = visibleIssues.filter((issue) => issue.code === "unsupported-bibliographic-claim");
    if (fakeBibliographicClaims.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains unsourced bibliographic-looking claims.`);
    }

    const badTranslations = visibleIssues
      .filter((issue) => issue.code === "known-bad-translation")
      .map((issue) => issue.text);
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

    const slideItemSignatures = new Set(collectVisibleItems(slideSpec)
      .map(visibleItemSignature)
      .filter((itemSignature) => itemSignature.length > 30));

    slideItemSignatures.forEach((itemSignature: string) => {
      const previousSlideIndex = seenItemSignatures.get(itemSignature);
      if (previousSlideIndex && slideIndex + 1 - previousSlideIndex <= 2) {
        throw new Error(`Generated slide ${slideIndex + 1} repeats visible card content from slide ${previousSlideIndex}.`);
      }
    });

    slideItemSignatures.forEach((itemSignature: string) => {
      seenItemSignatures.set(itemSignature, slideIndex + 1);
    });
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

function capitalizeVisibleTitle(value: string): string {
  const text = normalizeVisibleText(value).replace(/^[,;:.\-\s]+/, "").replace(/[.:;]+$/g, "").trim();
  if (!text) {
    return "";
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function titleWithoutSlidePrefix(value: unknown, slideTitle: unknown, limit = 4): string {
  const normalizedSlideTitle = normalizeVisibleText(slideTitle);
  let text = normalizeVisibleText(value);
  if (!text) {
    return "";
  }

  if (normalizedSlideTitle && text.toLowerCase().startsWith(normalizedSlideTitle.toLowerCase())) {
    text = text.slice(normalizedSlideTitle.length).trim();
  }

  text = text.replace(/^(?:adds?|carries|covers|explains|shows|summarizes)\b\s*/i, "").trim();
  const candidate = capitalizeVisibleTitle(sentence(text, text, limit));
  return normalizeVisibleText(candidate).toLowerCase() === normalizedSlideTitle.toLowerCase() ? "" : candidate;
}

function repairItemsForSlideTitle(items: unknown, slideTitle: unknown): unknown {
  if (!Array.isArray(items)) {
    return items;
  }

  const normalizedSlideTitle = normalizeVisibleText(slideTitle).toLowerCase();
  if (!normalizedSlideTitle) {
    return items;
  }

  return items.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }

    const next = { ...(item as JsonObject) };
    const itemTitle = normalizeVisibleText(next.title).toLowerCase();
    if (itemTitle !== normalizedSlideTitle) {
      return next;
    }

    const replacementTitle = titleWithoutSlidePrefix(next.body || next.value || next.label || "", slideTitle, 4)
      || sentence(next.body || next.value || next.label || "", next.body || next.value || next.label || "", 4);
    if (replacementTitle && normalizeVisibleText(replacementTitle).toLowerCase() !== normalizedSlideTitle) {
      next.title = replacementTitle;
    }

    return next;
  });
}

function repairNearbyDuplicateItems(slideSpecs: GeneratedSlideSpec[]): GeneratedSlideSpec[] {
  const seenItemSignatures = new Map<string, number>();

  return slideSpecs.map((slideSpec: GeneratedSlideSpec, slideIndex: number) => {
    const next = JSON.parse(JSON.stringify(slideSpec));
    const slideTitle = normalizeVisibleText(next.title);
    const slideSummary = normalizeVisibleText(next.summary);

    ["cards", "signals", "guardrails", "bullets", "resources"].forEach((field) => {
      if (!Array.isArray(next[field])) {
        return;
      }

      next[field] = next[field].map((item: unknown) => {
        if (!isSlideItem(item)) {
          return item;
        }

        const itemSignature = visibleItemSignature(item);
        const previousSlideIndex = itemSignature.length > 30 ? seenItemSignatures.get(itemSignature) : null;
        if (!previousSlideIndex || slideIndex + 1 - previousSlideIndex > 2) {
          return item;
        }

        const repairedTitle = titleWithoutSlidePrefix(item.body, slideTitle, 4)
          || titleWithoutSlidePrefix(slideSummary, slideTitle, 4)
          || item.title;
        const repairedBody = [
          slideSummary && normalizeVisibleText(item.body).toLowerCase() !== slideSummary.toLowerCase() ? slideSummary : "",
          item.body
        ].filter(Boolean).join(" ");

        return {
          ...item,
          body: repairedBody || item.body,
          title: repairedTitle
        };
      });
    });

    const slideItemSignatures = new Set(collectVisibleItems(next)
      .map(visibleItemSignature)
      .filter((itemSignature) => itemSignature.length > 30));
    slideItemSignatures.forEach((itemSignature: string) => {
      seenItemSignatures.set(itemSignature, slideIndex + 1);
    });

    return next;
  });
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
      next[field] = repairItemsForSlideTitle(next[field], next.title);
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
  const repairedSlideSpecs = (options.repairNearbyDuplicateItems
    ? repairNearbyDuplicateItems(slideSpecs)
    : slideSpecs
  ).map(repairGeneratedSlideSpec);
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
