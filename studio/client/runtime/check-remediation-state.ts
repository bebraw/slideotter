import { StudioClientState } from "../core/state.ts";
import { toVariants } from "../variants/variant-normalization.ts";
import { clearTransientVariants } from "../variants/variant-selection.ts";

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

  function payloadPreviews(payload: RemediationPayload): StudioClientState.State["previews"] {
    return payload.previews || { pages: [] };
  }

  function payloadRuntime(payload: RemediationPayload): StudioClientState.State["runtime"] | null {
    return payload.runtime || null;
  }

  function payloadSummary(payload: RemediationPayload): string {
    return payload.summary || "Check remediation candidates generated.";
  }

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
    state.previews = payloadPreviews(payload);
    state.runtime = payloadRuntime(payload);
    clearTransientVariants(state, slideId);
    state.transientVariants = [
      ...toVariants(payload.transientVariants || []),
      ...state.transientVariants
    ];
    state.variants = toVariants(payload.variants || []);
    state.selectedVariantId = null;
    state.ui.variantReviewOpen = true;
    return payloadSummary(payload);
  }
}
