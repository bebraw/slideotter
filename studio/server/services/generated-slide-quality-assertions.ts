import { normalizeVisibleText } from "./generated-text-hygiene.ts";
import { isSlideItem } from "./generated-slide-shape-guards.ts";
import type { GeneratedSlideSpec, SlideItem } from "./generated-slide-types.ts";
import {
  assertVisibleSlideTextQuality,
  collectVisibleItems,
  visibleItemSignature
} from "./visible-text-quality.ts";

function repeatedItemGroups(slideSpec: GeneratedSlideSpec): SlideItem[][] {
  return [
    Array.isArray(slideSpec.cards) ? slideSpec.cards.filter(isSlideItem) : [],
    Array.isArray(slideSpec.signals) ? slideSpec.signals.filter(isSlideItem) : [],
    Array.isArray(slideSpec.guardrails) ? slideSpec.guardrails.filter(isSlideItem) : [],
    Array.isArray(slideSpec.bullets) ? slideSpec.bullets.filter(isSlideItem) : []
  ];
}

function slideSignature(slideSpec: GeneratedSlideSpec): string {
  return normalizeVisibleText([
    slideSpec.type,
    slideSpec.title,
    slideSpec.summary,
    ...(Array.isArray(slideSpec.cards) ? slideSpec.cards.filter(isSlideItem).map((item: SlideItem) => item.body) : []),
    ...(Array.isArray(slideSpec.signals) ? slideSpec.signals.filter(isSlideItem).map((item: SlideItem) => item.body) : []),
    ...(Array.isArray(slideSpec.bullets) ? slideSpec.bullets.filter(isSlideItem).map((item: SlideItem) => item.body) : [])
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function assertNoRepeatedItemBodies(slideSpec: GeneratedSlideSpec, slideIndex: number): void {
  repeatedItemGroups(slideSpec).forEach((items: SlideItem[]) => {
    const itemBodies = items.map((item: SlideItem) => String(item.body || "").toLowerCase());
    const duplicateBodies = itemBodies.filter((body: string, index: number) => body && itemBodies.indexOf(body) !== index);
    if (duplicateBodies.length) {
      throw new Error(`Generated slide ${slideIndex + 1} repeats visible card content.`);
    }
  });
}

function assertNoRepeatedSlideTitleItems(slideSpec: GeneratedSlideSpec, slideIndex: number): void {
  const slideTitle = normalizeVisibleText(slideSpec.title).toLowerCase();
  const repeatedTitleItems = collectVisibleItems(slideSpec).filter((item: SlideItem) => {
    const itemTitle = normalizeVisibleText(item.title).toLowerCase();
    return itemTitle && slideTitle && itemTitle === slideTitle;
  });
  if (repeatedTitleItems.length) {
    throw new Error(`Generated slide ${slideIndex + 1} repeats the slide title as visible card content.`);
  }
}

function assertNoNearbyRepeatedSlide(
  signature: string,
  slideIndex: number,
  seenSlideSignatures: Map<string, number>
): void {
  if (
    signature.length > 40
    && seenSlideSignatures.has(signature)
    && slideIndex + 1 - (seenSlideSignatures.get(signature) || 0) <= 2
  ) {
    throw new Error(`Generated slide ${slideIndex + 1} repeats slide ${seenSlideSignatures.get(signature)}.`);
  }
}

function assertNoNearbyRepeatedItems(
  slideSpec: GeneratedSlideSpec,
  slideIndex: number,
  seenItemSignatures: Map<string, number>
): Set<string> {
  const slideItemSignatures = new Set(collectVisibleItems(slideSpec)
    .map(visibleItemSignature)
    .filter((itemSignature) => itemSignature.length > 30));

  slideItemSignatures.forEach((itemSignature: string) => {
    const previousSlideIndex = seenItemSignatures.get(itemSignature);
    if (previousSlideIndex && slideIndex + 1 - previousSlideIndex <= 2) {
      throw new Error(`Generated slide ${slideIndex + 1} repeats visible card content from slide ${previousSlideIndex}.`);
    }
  });

  return slideItemSignatures;
}

export function assertGeneratedSlideQuality(slideSpecs: GeneratedSlideSpec[]): GeneratedSlideSpec[] {
  const seenSlideSignatures = new Map<string, number>();
  const seenItemSignatures = new Map<string, number>();

  slideSpecs.forEach((slideSpec: GeneratedSlideSpec, slideIndex: number) => {
    assertVisibleSlideTextQuality(slideSpec, `generated slide ${slideIndex + 1}`);
    assertNoRepeatedItemBodies(slideSpec, slideIndex);
    assertNoRepeatedSlideTitleItems(slideSpec, slideIndex);

    const signature = slideSignature(slideSpec);
    assertNoNearbyRepeatedSlide(signature, slideIndex, seenSlideSignatures);
    if (signature.length > 40) {
      seenSlideSignatures.set(signature, slideIndex + 1);
    }

    assertNoNearbyRepeatedItems(slideSpec, slideIndex, seenItemSignatures).forEach((itemSignature: string) => {
      seenItemSignatures.set(itemSignature, slideIndex + 1);
    });
  });

  return slideSpecs;
}
