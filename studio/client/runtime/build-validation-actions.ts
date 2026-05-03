import { StudioClientCore } from "../platform/core.ts";
import { StudioClientLazyWorkbench } from "../platform/lazy-workbench.ts";
import type { StudioClientBuildValidationWorkbench } from "./build-validation-workbench.ts";

export namespace StudioClientBuildValidationActions {
  export type BuildValidationActionsOptions = Omit<StudioClientBuildValidationWorkbench.BuildValidationWorkbenchOptions, "request" | "setBusy">;
  export type BuildPayload = StudioClientBuildValidationWorkbench.BuildPayload;

  export type BuildValidationActions = {
    buildDeck: () => Promise<BuildPayload>;
    saveValidationSettings: () => Promise<void>;
    validate: (includeRender: boolean) => Promise<void>;
  };

  export function createBuildValidationActions(options: BuildValidationActionsOptions): BuildValidationActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbenchModule({
      importModule: () => import("./build-validation-workbench.ts"),
      create: ({ StudioClientBuildValidationWorkbench }): StudioClientBuildValidationWorkbench.BuildValidationWorkbench => (
        StudioClientBuildValidationWorkbench.createBuildValidationWorkbench({
          ...options,
          request: StudioClientCore.request,
          setBusy: StudioClientCore.setBusy
        })
      )
    });

    return {
      buildDeck: async () => {
        const workbench = await lazyWorkbench.load();
        return workbench.buildDeck();
      },
      saveValidationSettings: async () => {
        const workbench = await lazyWorkbench.load();
        await workbench.saveValidationSettings();
      },
      validate: async (includeRender: boolean) => {
        const workbench = await lazyWorkbench.load();
        await workbench.validate(includeRender);
      }
    };
  }
}
