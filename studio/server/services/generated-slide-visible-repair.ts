import { cleanText, hasDanglingEnding, isAuthoringMetaText, isScaffoldLeak, isWeakLabel, normalizeVisibleText, repairKnownBadTranslations, sentence } from "./generated-text-hygiene.ts";
import { isJsonObject } from "./generated-slide-shape-guards.ts";
import { firstUsefulItemTitle } from "./generated-visible-item-helpers.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import type { GeneratedSlideSpec, JsonObject } from "./generated-slide-types.ts";

const textFieldsToRepair = [
  "eyebrow",
  "title",
  "summary",
  "note",
  "caption",
  "quote",
  "context"
];

const itemFieldsToRepair = [
  "cards",
  "signals",
  "guardrails",
  "bullets",
  "resources",
  "mediaItems"
];

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

function isBadGeneratedTitle(value: unknown): boolean {
  return typeof value === "string"
    && (isWeakLabel(value) || isScaffoldLeak(value) || isAuthoringMetaText(value));
}

function isUsableGeneratedTitle(value: string): boolean {
  return Boolean(value)
    && !isWeakLabel(value)
    && !isScaffoldLeak(value)
    && !isAuthoringMetaText(value);
}

function itemTitleSource(item: JsonObject): unknown {
  return item.body || item.value || item.label || "";
}

function repairGeneratedItemTitle(item: JsonObject): void {
  if (!isBadGeneratedTitle(item.title)) {
    return;
  }

  const source = itemTitleSource(item);
  const bodyTitle = sentence(source, source, 4);
  if (isUsableGeneratedTitle(bodyTitle)) {
    item.title = bodyTitle;
  }
}

function repairGeneratedItem(item: unknown): unknown {
  if (!item || typeof item !== "object") {
    return item;
  }

  const next = Object.fromEntries(Object.entries(item).map(([key, value]) => [
    key,
    typeof value === "string" ? repairGeneratedVisibleText(value) : value
  ]));

  repairGeneratedItemTitle(next);

  return next;
}

function capitalizeVisibleTitle(value: string): string {
  const text = normalizeVisibleText(value).replace(/^[,;:.\-\s]+/, "").replace(/[.:;]+$/g, "").trim();
  if (!text) {
    return "";
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function titleWithoutSlidePrefix(value: unknown, slideTitle: unknown, limit = 4): string {
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

  return items.map((item: unknown) => repairItemTitleForSlideTitle(item, slideTitle, normalizedSlideTitle));
}

function repairItemTitleForSlideTitle(item: unknown, slideTitle: unknown, normalizedSlideTitle: string): unknown {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  const next = { ...(item as JsonObject) };
  if (normalizeVisibleText(next.title).toLowerCase() !== normalizedSlideTitle) {
    return next;
  }

  const source = itemTitleSource(next);
  const replacementTitle = titleWithoutSlidePrefix(source, slideTitle, 4) || sentence(source, source, 4);
  if (replacementTitle && normalizeVisibleText(replacementTitle).toLowerCase() !== normalizedSlideTitle) {
    next.title = replacementTitle;
  }

  return next;
}

function repairPanelTitles(next: JsonObject): void {
  if (typeof next.signalsTitle === "string") {
    next.signalsTitle = repairPanelTitle(next.signalsTitle, next.signals || next.cards || next.bullets);
  }

  if (typeof next.guardrailsTitle === "string") {
    next.guardrailsTitle = repairPanelTitle(next.guardrailsTitle, next.guardrails);
  }

  if (typeof next.resourcesTitle === "string") {
    next.resourcesTitle = repairPanelTitle(next.resourcesTitle, next.resources || next.bullets);
  }
}

function repairVisibleTextFields(next: JsonObject): void {
  textFieldsToRepair.forEach((field) => {
    if (typeof next[field] === "string") {
      next[field] = repairGeneratedVisibleText(next[field]);
    }
  });
}

function repairItemFields(next: JsonObject): void {
  itemFieldsToRepair.forEach((field) => {
    if (Array.isArray(next[field])) {
      next[field] = next[field].map(repairGeneratedItem);
      next[field] = repairItemsForSlideTitle(next[field], next.title);
    }
  });
}

export function repairGeneratedSlideSpec(slideSpec: unknown): GeneratedSlideSpec {
  const next = JSON.parse(JSON.stringify(slideSpec));

  repairVisibleTextFields(next);

  if (next.media && typeof next.media === "object") {
    next.media = repairGeneratedItem(next.media);
  }

  repairItemFields(next);
  repairPanelTitles(next);

  return validateSlideSpecObject(next);
}
