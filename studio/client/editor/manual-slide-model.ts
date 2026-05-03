import type { StudioClientState } from "../core/state";

export type ManualSlide = Pick<StudioClientState.StudioSlide, "id" | "index" | "title">;

export type SlideNavigationLabel = {
  description: string;
  label: string;
};

export type ManualDeckEditReferenceInput = {
  detourChecked: boolean;
  selectedLabel: SlideNavigationLabel | null;
  selectedSlide: ManualSlide | null;
};

export function formatManualSlideReference(slide: ManualSlide | null): string {
  return slide ? `${slide.index}. ${slide.title || slide.id}` : "Select a slide first.";
}

export function buildSlideNavigationLabels(slides: ManualSlide[], navigation: unknown): Map<string, SlideNavigationLabel> {
  const labels = new Map<string, SlideNavigationLabel>();
  const knownSlideIds = new Set(slides.map((slide) => slide.id));
  const navigationRecord = navigation && typeof navigation === "object" ? navigation as {
    coreSlideIds?: unknown;
    detours?: unknown;
    mode?: unknown;
  } : {};
  const rawDetours = Array.isArray(navigationRecord.detours) ? navigationRecord.detours : [];
  const detours = rawDetours.map((entry: unknown) => {
    const detour = entry && typeof entry === "object" ? entry as { parentId?: unknown; slideIds?: unknown } : {};
    const parentId = typeof detour.parentId === "string" && knownSlideIds.has(detour.parentId) ? detour.parentId : "";
    const slideIds = Array.isArray(detour.slideIds)
      ? detour.slideIds.filter((slideId: unknown): slideId is string => typeof slideId === "string" && knownSlideIds.has(slideId))
      : [];
    return { parentId, slideIds };
  }).filter((detour: { parentId: string; slideIds: string[] }) => detour.parentId && detour.slideIds.length);
  const detourSlideIds = new Set(detours.flatMap((detour: { slideIds: string[] }) => detour.slideIds));
  const rawCoreSlideIds = Array.isArray(navigationRecord.coreSlideIds) ? navigationRecord.coreSlideIds : [];
  const coreSlideIds = rawCoreSlideIds
    .filter((slideId: unknown): slideId is string => typeof slideId === "string" && knownSlideIds.has(slideId) && !detourSlideIds.has(slideId));
  const fallbackCoreSlideIds = slides
    .map((slide) => slide.id)
    .filter((slideId: string) => !detourSlideIds.has(slideId));
  const orderedCoreSlideIds = navigationRecord.mode === "two-dimensional" && coreSlideIds.length ? coreSlideIds : fallbackCoreSlideIds;
  const detoursByParent = new Map(detours.map((detour: { parentId: string; slideIds: string[] }) => [detour.parentId, detour.slideIds]));

  orderedCoreSlideIds.forEach((slideId: string, index: number) => {
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

export function buildManualDeckEditReference(input: ManualDeckEditReferenceInput): {
  deleteReference: string;
  systemReference: string;
} {
  const { detourChecked, selectedLabel, selectedSlide } = input;
  if (!selectedSlide) {
    return {
      deleteReference: "Select a slide before removing.",
      systemReference: "Select a slide before adding."
    };
  }

  return {
    deleteReference: `Ready to remove ${formatManualSlideReference(selectedSlide)}.`,
    systemReference: detourChecked
      ? selectedLabel?.description.startsWith("Subslide")
        ? `New subslide will be added to the same stack as ${selectedLabel.label}.`
        : `New subslide will be added below ${selectedLabel?.label || formatManualSlideReference(selectedSlide)}.`
      : `New slides are inserted after ${formatManualSlideReference(selectedSlide)}.`
  };
}
