import type { StudioClientState } from "../core/state";
import type { SlideNavigationLabel } from "./manual-slide-navigation-labels.ts";

export type ManualSlide = Pick<StudioClientState.StudioSlide, "id" | "index" | "title">;

export { buildSlideNavigationLabels, type SlideNavigationLabel } from "./manual-slide-navigation-labels.ts";

export type ManualDeckEditReferenceInput = {
  detourChecked: boolean;
  selectedLabel: SlideNavigationLabel | null;
  selectedSlide: ManualSlide | null;
};

export function formatManualSlideReference(slide: ManualSlide | null): string {
  return slide ? `${slide.index}. ${slide.title || slide.id}` : "Select a slide first.";
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
