import { StudioClientElements } from "../core/elements.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import { StudioClientState } from "../core/state.ts";

export namespace StudioClientAssistantActions {
  type AssistantWorkbench = {
    render: () => void;
    renderSelection: () => void;
  };

  export type AssistantActionsOptions = {
    elements: StudioClientElements.Elements;
    lazyWorkbench: StudioClientLazyWorkbench.LazyWorkbench<AssistantWorkbench>;
    state: StudioClientState.State;
  };

  export type AssistantActions = {
    load: () => void;
    render: () => void;
    renderSelection: () => void;
  };

  export function createAssistantActions({
    elements,
    lazyWorkbench,
    state
  }: AssistantActionsOptions): AssistantActions {
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
