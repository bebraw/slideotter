import { StudioClientCore } from "../core/core.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import type { StudioClientSlideLoadWorkbench } from "./slide-load-workbench.ts";

export namespace StudioClientSlideLoadActions {
  export type SlideLoadActionsOptions = Omit<StudioClientSlideLoadWorkbench.SlideLoadWorkbenchOptions, "request">;

  export type SlideLoadActions = {
    loadSlide: (slideId: string) => Promise<void>;
  };

  export function createSlideLoadActions(options: SlideLoadActionsOptions): SlideLoadActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<StudioClientSlideLoadWorkbench.SlideLoadWorkbench>({
      create: async () => {
        const { StudioClientSlideLoadWorkbench } = await import("./slide-load-workbench.ts");
        return StudioClientSlideLoadWorkbench.createSlideLoadWorkbench({
          ...options,
          request: StudioClientCore.request
        });
      }
    });

    return {
      loadSlide: async (slideId: string) => {
        const workbench = await lazyWorkbench.load();
        await workbench.loadSlide(slideId);
      }
    };
  }
}
