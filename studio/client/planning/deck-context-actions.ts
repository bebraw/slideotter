import { StudioClientCore } from "../core/core.ts";
import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import type { StudioClientDeckContextWorkbench } from "./deck-context-workbench.ts";

export namespace StudioClientDeckContextActions {
  type DeckContextWorkbench = ReturnType<typeof StudioClientDeckContextWorkbench.createDeckContextWorkbench>;

  export type DeckContextActionsOptions = Omit<StudioClientDeckContextWorkbench.DeckContextWorkbenchOptions, "request" | "setBusy">;

  export type DeckContextActions = {
    renderDeckFields: () => void;
    saveDeckContext: () => Promise<void>;
  };

  export function createDeckContextActions(options: DeckContextActionsOptions): DeckContextActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<DeckContextWorkbench>({
      create: async () => {
        const { StudioClientDeckContextWorkbench } = await import("./deck-context-workbench.ts");
        return StudioClientDeckContextWorkbench.createDeckContextWorkbench({
          ...options,
          request: StudioClientCore.request,
          setBusy: StudioClientCore.setBusy
        });
      }
    });

    function reportError(error: unknown): void {
      options.elements.operationStatus.textContent = error instanceof Error ? error.message : String(error);
    }

    return {
      renderDeckFields: () => {
        lazyWorkbench.load().then((workbench) => workbench.renderDeckFields()).catch(reportError);
      },
      saveDeckContext: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.saveDeckContext();
      }
    };
  }
}
