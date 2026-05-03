import { StudioClientState } from "../state.ts";

export namespace StudioClientSlideLoadState {
  type JsonRecord = StudioClientState.JsonRecord;
  type VariantRecord = StudioClientState.VariantRecord;

  export type SlidePayload = JsonRecord & {
    slide: StudioClientState.StudioSlide;
    slideSpec?: JsonRecord | null;
    slideSpecError?: unknown;
    source?: string;
    structured?: boolean;
    variants?: VariantRecord[];
    variantStorage?: unknown;
  };

  export function applySlidePayload(state: StudioClientState.State, slideId: string, payload: SlidePayload): void {
    state.selectedSlideId = slideId;
    state.selectedSlideIndex = payload.slide.index;
    state.selectedSlideSpec = payload.slideSpec || null;
    state.selectedSlideSpecDraftError = null;
    state.selectedSlideSpecError = payload.slideSpecError || null;
    state.selectedSlideStructured = payload.structured === true;
    state.selectedSlideSource = payload.source || "";
    state.variantStorage = payload.variantStorage || state.variantStorage;
    state.selectedVariantId = null;
    state.ui.customLayoutDefinitionPreviewActive = false;
    state.ui.customLayoutMainPreviewActive = false;
    state.ui.variantReviewOpen = Boolean((payload.variants || []).length);
  }
}
