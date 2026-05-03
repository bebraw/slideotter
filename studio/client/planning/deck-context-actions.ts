import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import type { StudioClientDeckContextWorkbench } from "./deck-context-workbench.ts";

export namespace StudioClientDeckContextActions {
  type DeckContextWorkbench = ReturnType<typeof StudioClientDeckContextWorkbench.createDeckContextWorkbench>;

  export type DeckContextActionsOptions = StudioClientDeckContextWorkbench.DeckContextWorkbenchOptions;

  export type DeckContextActions = {
    renderDeckFields: () => void;
    saveDeckContext: () => Promise<void>;
  };

  export function createDeckContextActions(options: DeckContextActionsOptions): DeckContextActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<DeckContextWorkbench>({
      create: async () => {
        const { StudioClientDeckContextWorkbench } = await import("./deck-context-workbench.ts");
        return StudioClientDeckContextWorkbench.createDeckContextWorkbench(options);
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
