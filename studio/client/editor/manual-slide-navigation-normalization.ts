import type { ManualSlide } from "./manual-slide-model.ts";

export type ManualDetourStack = {
  parentId: string;
  slideIds: string[];
};

export function normalizeNavigationDetours(slides: ManualSlide[], navigationRecord: {
  detours?: unknown;
}): ManualDetourStack[] {
  const knownSlideIds = new Set(slides.map((slide) => slide.id));
  const rawDetours = Array.isArray(navigationRecord.detours) ? navigationRecord.detours : [];

  return rawDetours.map((entry: unknown) => {
    const detour = entry && typeof entry === "object" ? entry as { parentId?: unknown; slideIds?: unknown } : {};
    const parentId = typeof detour.parentId === "string" && knownSlideIds.has(detour.parentId) ? detour.parentId : "";
    const slideIds = Array.isArray(detour.slideIds)
      ? detour.slideIds.filter((slideId: unknown): slideId is string => typeof slideId === "string" && knownSlideIds.has(slideId))
      : [];
    return { parentId, slideIds };
  }).filter((detour: ManualDetourStack) => detour.parentId && detour.slideIds.length);
}

export function orderedCoreSlideIds(slides: ManualSlide[], navigationRecord: {
  coreSlideIds?: unknown;
  mode?: unknown;
}, detourSlideIds: Set<string>): string[] {
  const knownSlideIds = new Set(slides.map((slide) => slide.id));
  const rawCoreSlideIds = Array.isArray(navigationRecord.coreSlideIds) ? navigationRecord.coreSlideIds : [];
  const coreSlideIds = rawCoreSlideIds
    .filter((slideId: unknown): slideId is string => typeof slideId === "string" && knownSlideIds.has(slideId) && !detourSlideIds.has(slideId));
  const fallbackCoreSlideIds = slides
    .map((slide) => slide.id)
    .filter((slideId: string) => !detourSlideIds.has(slideId));

  return navigationRecord.mode === "two-dimensional" && coreSlideIds.length ? coreSlideIds : fallbackCoreSlideIds;
}
