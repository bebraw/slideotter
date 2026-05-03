import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientVariantReviewActions {
  type VariantRecord = StudioClientState.VariantRecord;

  type VariantReviewWorkbench = {
    clearTransientVariants: (slideId: string) => void;
    getSelectedVariant: () => VariantRecord | null;
    openGenerationControls: () => void;
    render: () => void;
    renderComparison: () => void;
    renderFlow: () => void;
    replacePersistedVariantsForSlide: (slideId: string, variants: unknown) => void;
  };

  export type VariantReviewActionsOptions<TWorkbench extends VariantReviewWorkbench> = {
    elements: StudioClientElements.Elements;
    getSelectedVariant: () => VariantRecord | null;
    getSlideVariants: () => VariantRecord[];
    lazyWorkbench: StudioClientLazyWorkbench.LazyWorkbench<TWorkbench>;
    state: StudioClientState.State;
  };

  export type VariantReviewActions<TWorkbench extends VariantReviewWorkbench> = {
    ensureWorkbench: () => Promise<TWorkbench>;
    getWorkbench: () => TWorkbench | null;
    isLoaded: () => boolean;
    load: () => void;
    openGenerationControls: () => void;
    render: () => void;
    renderComparison: () => void;
    renderFlow: () => void;
  };

  export function createVariantReviewActions<TWorkbench extends VariantReviewWorkbench>({
    elements,
    getSelectedVariant,
    getSlideVariants,
    lazyWorkbench,
    state
  }: VariantReviewActionsOptions<TWorkbench>): VariantReviewActions<TWorkbench> {
    let workbench: TWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<TWorkbench> {
      workbench = await lazyWorkbench.load();
      return workbench;
    }

    function load(): void {
      getLoadedWorkbench()
        .then((loadedWorkbench) => {
          loadedWorkbench.renderFlow();
          loadedWorkbench.render();
          loadedWorkbench.renderComparison();
        })
        .catch((error: unknown) => {
          elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
        });
    }

    return {
      ensureWorkbench: getLoadedWorkbench,
      getWorkbench: () => workbench,
      isLoaded: () => Boolean(workbench),
      load,
      openGenerationControls: () => {
        workbench?.openGenerationControls();
      },
      render: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.render(),
          shouldLoad: () => state.ui.variantReviewOpen || getSlideVariants().length > 0,
          workbench
        });
      },
      renderComparison: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderComparison(),
          shouldLoad: () => Boolean(getSelectedVariant()),
          workbench
        });
      },
      renderFlow: () => {
        workbench?.renderFlow();
      }
    };
  }
}
