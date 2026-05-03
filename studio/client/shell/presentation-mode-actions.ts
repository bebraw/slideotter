import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientPresentationModeActions {
  type PresentationModeWorkbench = {
    openPresentationMode: () => void;
  };

  export type PresentationModeActionsOptions = {
    getPresentationId: () => string | null | undefined;
    state: StudioClientState.State;
    windowRef: Window;
  };

  export type PresentationModeActions = {
    open: () => void;
  };

  export function createPresentationModeActions({
    getPresentationId,
    state,
    windowRef
  }: PresentationModeActionsOptions): PresentationModeActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<PresentationModeWorkbench>({
      create: async () => {
        const { StudioClientPresentationModeWorkbench } = await import("./presentation-mode-workbench.ts");
        return StudioClientPresentationModeWorkbench.createPresentationModeWorkbench({
          getPresentationId,
          state,
          windowRef
        });
      }
    });

    return {
      open: () => {
        void lazyWorkbench.load().then((workbench) => workbench.openPresentationMode());
      }
    };
  }
}
