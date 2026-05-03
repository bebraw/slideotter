import { StudioClientCore } from "../platform/core.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import type { StudioClientSlideLoadWorkbench } from "./slide-load-workbench.ts";

export namespace StudioClientSlideLoadActions {
  export type SlideLoadActionsOptions = Omit<StudioClientSlideLoadWorkbench.SlideLoadWorkbenchOptions, "request">;

  export type SlideLoadActions = {
    loadSlide: (slideId: string) => Promise<void>;
  };

  export function createSlideLoadActions(options: SlideLoadActionsOptions): SlideLoadActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbenchModule({
      importModule: () => import("./slide-load-workbench.ts"),
      create: ({ StudioClientSlideLoadWorkbench }): StudioClientSlideLoadWorkbench.SlideLoadWorkbench => (
        StudioClientSlideLoadWorkbench.createSlideLoadWorkbench({
          ...options,
          request: StudioClientCore.request
        })
      )
    });

    return {
      loadSlide: async (slideId: string) => {
        const workbench = await lazyWorkbench.load();
        await workbench.loadSlide(slideId);
      }
    };
  }
}
