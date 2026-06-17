import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readProjectSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);

const { assert } = require("../fixture-helpers.ts");

export function validateClientModuleBoundaries(): void {
  const indexSource = readProjectSource("studio/client/index.html");
  const appSource = readProjectSource("studio/client/app-composition.ts");
  const mainSource = readProjectSource("studio/client/main.ts");
  const navigationShellSource = readProjectSource("studio/client/shell/navigation-shell.ts");
  const lazyWorkbenchSource = readProjectSource("studio/client/platform/lazy-workbench.ts");
  const deckPlanningActionsSource = readProjectSource("studio/client/planning/deck-planning-actions.ts");
  const assistantActionsSource = readProjectSource("studio/client/creation/assistant-actions.ts");
  const themePanelActionsSource = readProjectSource("studio/client/creation/theme-panel-actions.ts");
  const customLayoutActionsSource = readProjectSource("studio/client/creation/custom-layout-actions.ts");
  const variantReviewActionsSource = readProjectSource("studio/client/variants/variant-review-actions.ts");
  const featureActionSources = deckPlanningActionsSource
    + assistantActionsSource
    + themePanelActionsSource
    + customLayoutActionsSource
    + variantReviewActionsSource;

  assert(
    /<script type="module" src="\/main\.ts"><\/script>/.test(indexSource)
      && clientModuleLazyLoaded("preview/slide-dom.ts", mainSource)
      && clientModuleLazyLoaded("app.ts", mainSource)
      && !clientModuleLoaded("app.ts", [mainSource, appSource, navigationShellSource]),
    "Studio client should load through the Vite module entrypoint after the DOM slide renderer split point"
  );

  assert(
    /namespace StudioClientLazyWorkbench/.test(lazyWorkbenchSource)
      && /function createLazyWorkbench/.test(lazyWorkbenchSource)
      && /function createLazyWorkbenchModule/.test(lazyWorkbenchSource)
      && /function renderLoadedOrLoad/.test(lazyWorkbenchSource)
      && /loadPromise/.test(lazyWorkbenchSource)
      && /mounted/.test(lazyWorkbenchSource)
      && /StudioClientLazyWorkbench\.createLazyWorkbenchModule/.test(featureActionSources)
      && !/StudioClientLazyWorkbench\.createLazyWorkbench/.test(appSource)
      && /StudioClientLazyWorkbench\.renderLoadedOrLoad/.test(featureActionSources)
      && /import \{ StudioClientLazyWorkbench \} from "\.\.\/platform\/lazy-workbench\.ts";/.test(featureActionSources),
    "Lazy workbench loading and render-gateway behavior should live in the shared lazy workbench helper"
  );
}
