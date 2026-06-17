import { cleanText, hasDanglingEnding, isAuthoringMetaText, isScaffoldLeak, isWeakLabel, normalizeVisibleText, repairKnownBadTranslations, sentence } from "./generated-text-hygiene.ts";
import { isJsonObject, isSlideItem } from "./generated-slide-shape-guards.ts";
import { firstUsefulItemTitle } from "./generated-visible-item-helpers.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import type { GeneratedSlideSpec, JsonObject } from "./generated-slide-types.ts";
import {
  collectVisibleItems,
  visibleItemSignature
} from "./visible-text-quality.ts";

function validateSlideSpecObject<T extends JsonObject>(spec: T): T {
  const validated = validateSlideSpec(spec);
  return isJsonObject(validated) ? { ...spec, ...validated } : spec;
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

export function repairNearbyDuplicateItems(slideSpecs: GeneratedSlideSpec[]): GeneratedSlideSpec[] {
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

export function repairGeneratedSlideSpec(slideSpec: unknown): GeneratedSlideSpec {
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
