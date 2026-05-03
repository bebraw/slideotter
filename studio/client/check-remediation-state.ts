import { StudioClientState } from "./state.ts";
import { StudioClientVariantState } from "./variant-state.ts";

export namespace StudioClientCheckRemediationState {
  export type ValidationIssue = {
    slide?: string | number;
  };

  export type RemediationPayload = {
    previews?: StudioClientState.State["previews"];
    runtime?: StudioClientState.State["runtime"];
    summary?: string;
    transientVariants?: StudioClientState.VariantRecord[];
    variants?: StudioClientState.VariantRecord[];
  };

  export function getSlideIdForIssue(state: StudioClientState.State, issue: ValidationIssue): string {
    const slideNumber = Number(issue.slide);
    if (Number.isFinite(slideNumber)) {
      const matchingSlide = state.slides.find((slide) => slide.index === slideNumber);
      if (matchingSlide) {
        return matchingSlide.id;
      }
    }

    return state.selectedSlideId || "";
  }

  export function applyPayload(
    state: StudioClientState.State,
    payload: RemediationPayload,
    slideId: string
  ): string {
    state.previews = payload.previews || { pages: [] };
    state.runtime = payload.runtime || null;
    StudioClientVariantState.clearTransientVariants(state, slideId);
    state.transientVariants = [
      ...StudioClientVariantState.toVariants(payload.transientVariants || []),
      ...state.transientVariants
    ];
    state.variants = StudioClientVariantState.toVariants(payload.variants || []);
    state.selectedVariantId = null;
    state.ui.variantReviewOpen = true;
    return payload.summary || "Check remediation candidates generated.";
  }
}
