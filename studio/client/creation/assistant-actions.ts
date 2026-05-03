import { StudioClientCore } from "../core/core.ts";
import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";
import type { StudioClientAssistantWorkbench } from "./assistant-workbench.ts";

export namespace StudioClientAssistantActions {
  type AssistantWorkbench = {
    mount: () => void;
    render: () => void;
    renderSelection: () => void;
  };

  export type AssistantActionsOptions = {
    elements: StudioClientElements.Elements;
    options: Omit<StudioClientAssistantWorkbench.AssistantWorkbenchDependencies, "createDomElement" | "postJson" | "setBusy">;
    state: StudioClientState.State;
  };

  export type AssistantActions = {
    load: () => void;
    render: () => void;
    renderSelection: () => void;
  };

  export function createAssistantActions({
    elements,
    options,
    state
  }: AssistantActionsOptions): AssistantActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<AssistantWorkbench>({
      create: async () => {
        const { StudioClientAssistantWorkbench } = await import("./assistant-workbench.ts");
        return StudioClientAssistantWorkbench.createAssistantWorkbench({
          ...options,
          createDomElement: StudioClientCore.createDomElement,
          postJson: StudioClientCore.postJson,
          setBusy: StudioClientCore.setBusy
        });
      },
      mount: (workbench) => workbench.mount()
    });
    let workbench: AssistantWorkbench | null = null;

    async function getWorkbench(): Promise<AssistantWorkbench> {
      workbench = await lazyWorkbench.load();
      return workbench;
    }

    function load(): void {
      getWorkbench()
        .then((loadedWorkbench) => {
          loadedWorkbench.render();
          loadedWorkbench.renderSelection();
        })
        .catch((error: unknown) => {
          elements.assistantLog.textContent = error instanceof Error ? error.message : String(error);
        });
    }

    return {
      load,
      render: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.render(),
          shouldLoad: () => state.ui.assistantOpen,
          workbench
        });
      },
      renderSelection: () => {
        StudioClientLazyWorkbench.renderLoadedOrLoad({
          load,
          render: (loadedWorkbench) => loadedWorkbench.renderSelection(),
          shouldLoad: () => state.ui.assistantOpen,
          workbench
        });
      }
    };
  }
}
