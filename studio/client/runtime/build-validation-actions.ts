import { StudioClientLazyWorkbench } from "../core/lazy-workbench.ts";
import type { StudioClientBuildValidationWorkbench } from "./build-validation-workbench.ts";

export namespace StudioClientBuildValidationActions {
  export type BuildValidationActionsOptions = StudioClientBuildValidationWorkbench.BuildValidationWorkbenchOptions;
  export type BuildPayload = StudioClientBuildValidationWorkbench.BuildPayload;

  export type BuildValidationActions = {
    buildDeck: () => Promise<BuildPayload>;
    saveValidationSettings: () => Promise<void>;
    validate: (includeRender: boolean) => Promise<void>;
  };

  export function createBuildValidationActions(options: BuildValidationActionsOptions): BuildValidationActions {
    const lazyWorkbench = StudioClientLazyWorkbench.createLazyWorkbench<StudioClientBuildValidationWorkbench.BuildValidationWorkbench>({
      create: async () => {
        const { StudioClientBuildValidationWorkbench } = await import("./build-validation-workbench.ts");
        return StudioClientBuildValidationWorkbench.createBuildValidationWorkbench(options);
      }
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
