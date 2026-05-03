import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientValidationReportActions {
  type ValidationReportWorkbench = {
    render: () => void;
  };

  export type ValidationReportActionsOptions = {
    elements: StudioClientElements.Elements;
    loadSlide: (slideId: string) => Promise<void>;
    openVariantGenerationControls: () => void;
    renderPreviews: () => void;
    renderStatus: () => void;
    renderVariants: () => void;
    state: StudioClientState.State;
  };

  export type ValidationReportActions = {
    render: () => void;
  };

  export function createValidationReportActions({
    elements,
    loadSlide,
    openVariantGenerationControls,
    renderPreviews,
    renderStatus,
    renderVariants,
    state
  }: ValidationReportActionsOptions): ValidationReportActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<ValidationReportWorkbench>({
      create: async () => {
        const { StudioClientValidationReportWorkbench } = await import("./validation-report-workbench.ts");
        return StudioClientValidationReportWorkbench.createValidationReportWorkbench({
          createDomElement: StudioClientCore.createDomElement,
          elements,
          loadSlide,
          openVariantGenerationControls,
          renderPreviews,
          renderStatus,
          renderVariants,
          request: StudioClientCore.request,
          state
        });
      }
    });

    return {
      render: () => {
        lazyWorkbench.load().then((workbench) => workbench.render()).catch((error: unknown) => {
          elements.reportBox.textContent = StudioClientCore.errorMessage(error);
        });
      }
    };
  }
}
