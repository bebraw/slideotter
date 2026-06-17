import { isSlideItem } from "./generated-slide-shape-guards.ts";
import { normalizeVisibleText } from "./generated-visible-text-normalization.ts";
import type { GeneratedSlideSpec } from "./generated-slide-types.ts";
import { titleWithoutSlidePrefix } from "./generated-slide-visible-repair.ts";
import {
  collectVisibleItems,
  visibleItemSignature
} from "./visible-text-quality.ts";

const repeatCheckedItemFields = [
  "cards",
  "signals",
  "guardrails",
  "bullets",
  "resources"
];

function repairRepeatedItem(item: unknown, slideTitle: string, slideSummary: string, previousSlideIndex: number | null, slideIndex: number): unknown {
  if (!isSlideItem(item) || !previousSlideIndex || slideIndex + 1 - previousSlideIndex > 2) {
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
}

function repairRepeatedItemsOnSlide(next: GeneratedSlideSpec, seenItemSignatures: Map<string, number>, slideIndex: number): void {
  const slideTitle = normalizeVisibleText(next.title);
  const slideSummary = normalizeVisibleText(next.summary);

  repeatCheckedItemFields.forEach((field) => {
    if (!Array.isArray(next[field])) {
      return;
    }

    next[field] = next[field].map((item: unknown) => {
      const itemSignature = isSlideItem(item) ? visibleItemSignature(item) : "";
      const previousSlideIndex = itemSignature.length > 30 ? seenItemSignatures.get(itemSignature) ?? null : null;
      return repairRepeatedItem(item, slideTitle, slideSummary, previousSlideIndex, slideIndex);
    });
  });
}

function rememberSlideItemSignatures(next: GeneratedSlideSpec, seenItemSignatures: Map<string, number>, slideIndex: number): void {
  const slideItemSignatures = new Set(collectVisibleItems(next)
    .map(visibleItemSignature)
    .filter((itemSignature) => itemSignature.length > 30));

  slideItemSignatures.forEach((itemSignature: string) => {
    seenItemSignatures.set(itemSignature, slideIndex + 1);
  });
}

export function repairNearbyDuplicateItems(slideSpecs: GeneratedSlideSpec[]): GeneratedSlideSpec[] {
  const seenItemSignatures = new Map<string, number>();

  return slideSpecs.map((slideSpec: GeneratedSlideSpec, slideIndex: number) => {
    const next = JSON.parse(JSON.stringify(slideSpec));

    repairRepeatedItemsOnSlide(next, seenItemSignatures, slideIndex);
    rememberSlideItemSignatures(next, seenItemSignatures, slideIndex);

    return next;
  });
}
