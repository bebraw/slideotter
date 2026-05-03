import { StudioClientState } from "../core/state.ts";
import { StudioClientVariantState } from "./variant-state.ts";

export namespace StudioClientVariantActions {
  type VariantRecord = StudioClientState.VariantRecord;

  type VariantReviewWorkbench = {
    clearTransientVariants: (slideId: string) => void;
    getSelectedVariant: () => VariantRecord | null;
    replacePersistedVariantsForSlide: (slideId: string, variants: unknown) => void;
  };

  export type VariantActionsOptions = {
    getVariantReviewWorkbench: () => VariantReviewWorkbench | null;
    state: StudioClientState.State;
  };

  export type VariantActions = {
    clearTransientVariants: (slideId: string) => void;
    getSelectedVariant: () => VariantRecord | null;
    getSlideVariants: () => VariantRecord[];
    replacePersistedVariantsForSlide: (slideId: string, variants: VariantRecord[]) => void;
  };

  export function createVariantActions({
    getVariantReviewWorkbench,
    state
  }: VariantActionsOptions): VariantActions {
    return {
      clearTransientVariants: (slideId: string) => {
        StudioClientVariantState.clearTransientVariants(state, slideId);
        getVariantReviewWorkbench()?.clearTransientVariants(slideId);
      },
      getSelectedVariant: () => {
        const workbench = getVariantReviewWorkbench();
        if (workbench) {
          return workbench.getSelectedVariant();
        }
        return StudioClientVariantState.getSelectedVariant(state);
      },
      getSlideVariants: () => StudioClientVariantState.getSlideVariants(state),
      replacePersistedVariantsForSlide: (slideId: string, variants: VariantRecord[]) => {
        StudioClientVariantState.replacePersistedVariantsForSlide(state, slideId, variants);
        getVariantReviewWorkbench()?.replacePersistedVariantsForSlide(slideId, variants);
      }
    };
  }
}
