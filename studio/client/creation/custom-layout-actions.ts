import { StudioClientCore } from "../platform/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";
import type { StudioClientCustomLayoutWorkbench } from "./custom-layout-workbench.ts";

export namespace StudioClientCustomLayoutActions {
  type JsonRecord = StudioClientState.JsonRecord;

  export type CustomLayoutWorkbench = {
    getLivePreviewSlideSpec: (slide: StudioClientState.StudioSlide | undefined, slideSpec: JsonRecord | null) => JsonRecord | null;
    isSupported: () => boolean;
    mount: () => void;
    renderEditor: () => void;
    renderLayoutStudio: () => void;
    renderLibrary: () => void;
  };

  export type CustomLayoutActionsOptions = {
    elements: StudioClientElements.Elements;
    options: Omit<StudioClientCustomLayoutWorkbench.CustomLayoutDependencies, "createDomElement" | "request" | "setBusy">;
    state: StudioClientState.State;
  };

  export type CustomLayoutActions = CustomLayoutWorkbench & {
    getWorkbench: () => CustomLayoutWorkbench | null;
    load: () => void;
  };

  export function createCustomLayoutActions({
    elements,
    options,
    state
  }: CustomLayoutActionsOptions): CustomLayoutActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<CustomLayoutWorkbench>({
      create: async () => {
        const { StudioClientCustomLayoutWorkbench } = await import("./custom-layout-workbench.ts");
        return StudioClientCustomLayoutWorkbench.createCustomLayoutWorkbench({
          ...options,
          createDomElement: StudioClientCore.createDomElement,
          request: StudioClientCore.request,
          setBusy: StudioClientCore.setBusy
        });
      },
      mount: (workbench) => workbench.mount()
    });
    let workbench: CustomLayoutWorkbench | null = null;

    async function getLoadedWorkbench(): Promise<CustomLayoutWorkbench> {
      workbench = await lazyWorkbench.load();
      return workbench;
    }

    function load(): void {
      getLoadedWorkbench()
        .then((loadedWorkbench) => {
          loadedWorkbench.renderLibrary();
          loadedWorkbench.renderEditor();
          loadedWorkbench.renderLayoutStudio();
        })
        .catch((error: unknown) => {
          elements.customLayoutStatus.textContent = error instanceof Error ? error.message : String(error);
        });
    }

    function getLivePreviewSlideSpec(slide: StudioClientState.StudioSlide | undefined, slideSpec: JsonRecord | null): JsonRecord | null {
      return workbench?.getLivePreviewSlideSpec(slide, slideSpec) || null;
    }

    return {
      getLivePreviewSlideSpec,
      getWorkbench: () => workbench,
      isSupported: () => {
        if (workbench) {
          return workbench.isSupported();
        }
        return Boolean(state.selectedSlideSpec && ["content", "cover"].includes(String(state.selectedSlideSpec.type || "")));
      },
      load,
      mount: load,
      renderEditor: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderEditor(),
          shouldLoad: () => state.ui.layoutDrawerOpen,
          workbench
        });
      },
      renderLayoutStudio: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderLayoutStudio(),
          shouldLoad: () => state.ui.layoutDrawerOpen,
          workbench
        });
      },
      renderLibrary: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderLibrary(),
          shouldLoad: () => state.ui.layoutDrawerOpen,
          workbench
        });
      }
    };
  }
}
