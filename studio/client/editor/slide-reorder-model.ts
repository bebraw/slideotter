import { buildSlideNavigationLabels } from "./manual-slide-model.ts";
import type { StudioClientState } from "../core/state";

export type SlideReorderEntry = {
  description: string;
  fileOrder: number;
  id: string;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  title: string;
  titleLabel: string;
};

export function reorderSlideIds(source: string[], draggedId: string, targetId: string): string[] {
  if (!draggedId || !targetId || draggedId === targetId) {
    return source;
  }
  const next = source.filter((slideId) => slideId !== draggedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex < 0) {
    return source;
  }
  next.splice(targetIndex, 0, draggedId);
  return next;
}

export function moveSlideId(source: string[], slideId: string, offset: number): string[] {
  const currentIndex = source.indexOf(slideId);
  const nextIndex = currentIndex + offset;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= source.length) {
    return source;
  }
  const next = [...source];
  next.splice(currentIndex, 1);
  next.splice(nextIndex, 0, slideId);
  return next;
}

export function buildSlideReorderEntries(params: {
  context: StudioClientState.DeckContext;
  reorderSlideIds: string[];
  selectedSlideId: string | null;
  slides: StudioClientState.StudioSlide[];
}): SlideReorderEntry[] {
  const { context, reorderSlideIds, selectedSlideId, slides } = params;
  const slidesById = new Map(slides.map((slide: StudioClientState.StudioSlide) => [slide.id, slide]));
  const navigationLabels = buildSlideNavigationLabels(slides, context.deck?.navigation);

  return reorderSlideIds.map((slideId, index) => {
    const slide = slidesById.get(slideId);
    const labelInfo = navigationLabels.get(slideId) || { description: "Slide", label: String(index + 1) };
    const title = slide?.title || `Slide ${index + 1}`;

    return {
      description: labelInfo.description,
      fileOrder: index + 1,
      id: slideId,
      isFirst: index === 0,
      isLast: index === reorderSlideIds.length - 1,
      selected: slideId === selectedSlideId,
      title,
      titleLabel: slide ? `${labelInfo.label}. ${title}` : slideId
    };
  });
}
