import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";
import type { StudioClientVariantReviewWorkbench } from "./variant-review-workbench.ts";

export namespace StudioClientVariantReviewActions {
  type VariantRecord = StudioClientState.VariantRecord;
  type VariantReviewWorkbenchOptions = Omit<
    StudioClientVariantReviewWorkbench.VariantReviewWorkbenchOptions,
    "createDomElement" | "formatSourceCodeNodes" | "request" | "setBusy"
  >;

  export type VariantReviewWorkbench = {
    clearTransientVariants: (slideId: string) => void;
    getSelectedVariant: () => VariantRecord | null;
    mount: () => void;
    openGenerationControls: () => void;
    render: () => void;
    renderComparison: () => void;
    renderFlow: () => void;
    replacePersistedVariantsForSlide: (slideId: string, variants: unknown) => void;
  };

  export type VariantReviewActionsOptions = {
    elements: StudioClientElements.Elements;
    getSelectedVariant: () => VariantRecord | null;
    getSlideVariants: () => VariantRecord[];
    options: VariantReviewWorkbenchOptions;
    state: StudioClientState.State;
  };

  export type VariantReviewActions = {
    ensureWorkbench: () => Promise<VariantReviewWorkbench>;
    getWorkbench: () => VariantReviewWorkbench | null;
    isLoaded: () => boolean;
    load: () => void;
    openGenerationControls: () => void;
    render: () => void;
    renderComparison: () => void;
    renderFlow: () => void;
  };

  export function createVariantReviewActions({
    elements,
    getSelectedVariant,
    getSlideVariants,
    options,
    state
  }: VariantReviewActionsOptions): VariantReviewActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbenchModule({
      importModule: () => import("./variant-review-workbench.ts"),
      create: ({ StudioClientVariantReviewWorkbench }): VariantReviewWorkbench => (
        StudioClientVariantReviewWorkbench.createVariantReviewWorkbench({
          ...options,
          createDomElement: StudioClientCore.createDomElement,
          formatSourceCodeNodes: StudioClientCore.formatSourceCodeNodes,
          request: StudioClientCore.request,
          setBusy: StudioClientCore.setBusy
        })
      ),
      mount: (workbench) => workbench.mount()
    });
    let workbench: VariantReviewWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<VariantReviewWorkbench> {
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
