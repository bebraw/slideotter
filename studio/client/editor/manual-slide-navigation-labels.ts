import type { ManualSlide } from "./manual-slide-model.ts";
import {
  normalizeNavigationDetours,
  orderedCoreSlideIds,
  type ManualDetourStack
} from "./manual-slide-navigation-normalization.ts";

export type SlideNavigationLabel = {
  description: string;
  label: string;
};

export function buildSlideNavigationLabels(slides: ManualSlide[], navigation: unknown): Map<string, SlideNavigationLabel> {
  const labels = new Map<string, SlideNavigationLabel>();
  const navigationRecord = navigation && typeof navigation === "object" ? navigation as {
    coreSlideIds?: unknown;
    detours?: unknown;
    mode?: unknown;
  } : {};
  const detours = normalizeNavigationDetours(slides, navigationRecord);
  const detourSlideIds = new Set(detours.flatMap((detour: ManualDetourStack) => detour.slideIds));
  const detoursByParent = new Map(detours.map((detour: ManualDetourStack) => [detour.parentId, detour.slideIds]));

  orderedCoreSlideIds(slides, navigationRecord, detourSlideIds).forEach((slideId: string, index: number) => {
    const label = String(index + 1);
    labels.set(slideId, { description: "Core slide", label });
    (detoursByParent.get(slideId) || []).forEach((detourSlideId: string, detourIndex: number) => {
      labels.set(detourSlideId, {
        description: `Subslide below ${label}`,
        label: `${label}${String.fromCharCode(97 + detourIndex)}`
      });
    });
  });

  slides.forEach((slide) => {
    if (!labels.has(slide.id)) {
      labels.set(slide.id, { description: "Outside navigation", label: String(labels.size + 1) });
    }
  });

  return labels;
}
