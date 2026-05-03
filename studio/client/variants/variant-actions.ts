import { StudioClientElements } from "../core/elements.ts";
import { StudioClientState } from "../core/state.ts";
import { StudioClientVariantState } from "./variant-state.ts";

export namespace StudioClientVariantActions {
  type VariantRecord = StudioClientState.VariantRecord;

  type VariantReviewWorkbench = {
    clearTransientVariants: (slideId: string) => void;
    getSelectedVariant: () => VariantRecord | null;
    openGenerationControls: () => void;
    replacePersistedVariantsForSlide: (slideId: string, variants: unknown) => void;
  };

  export type VariantActionsOptions = {
    elements: StudioClientElements.Elements;
    getVariantReviewWorkbench: () => VariantReviewWorkbench | null;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type VariantActions = {
    clearTransientVariants: (slideId: string) => void;
    getRequestedCandidateCount: () => Promise<number>;
    getSelectedVariant: () => VariantRecord | null;
    getSlideVariants: () => VariantRecord[];
    openGenerationControls: () => void;
    replacePersistedVariantsForSlide: (slideId: string, variants: VariantRecord[]) => void;
  };

  export function createVariantActions({
    elements,
    getVariantReviewWorkbench,
    state,
    windowRef
  }: VariantActionsOptions): VariantActions {
    return {
      clearTransientVariants: (slideId: string) => {
        StudioClientVariantState.clearTransientVariants(state, slideId);
        getVariantReviewWorkbench()?.clearTransientVariants(slideId);
      },
      getRequestedCandidateCount: async () => {
        const { StudioClientCandidateCount } = await import("./candidate-count.ts");
        return StudioClientCandidateCount.readNormalized(elements.ideateCandidateCount);
      },
      getSelectedVariant: () => {
        const workbench = getVariantReviewWorkbench();
        if (workbench) {
          return workbench.getSelectedVariant();
        }
        return StudioClientVariantState.getSelectedVariant(state);
      },
      getSlideVariants: () => StudioClientVariantState.getSlideVariants(state),
      openGenerationControls: () => {
        void import("./variant-generation-controls.ts")
          .then(({ StudioClientVariantGenerationControls }) => {
            StudioClientVariantGenerationControls.open(windowRef.document);
          });
        getVariantReviewWorkbench()?.openGenerationControls();
      },
      replacePersistedVariantsForSlide: (slideId: string, variants: VariantRecord[]) => {
        StudioClientVariantState.replacePersistedVariantsForSlide(state, slideId, variants);
        getVariantReviewWorkbench()?.replacePersistedVariantsForSlide(slideId, variants);
      }
    };
  }
}
