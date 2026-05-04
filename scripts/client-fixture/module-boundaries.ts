import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { assert } = require("../fixture-helpers.ts");

function readSource(filePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

function clientModuleLoaded(fileName: string, sources: readonly string[]): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return sources.some((source) => pattern.test(source));
}

function mainModuleLazyLoaded(fileName: string, mainSource: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(mainSource);
}

export function validateClientModuleBoundaries(): void {
  const indexSource = readSource("studio/client/index.html");
  const appSource = readSource("studio/client/app.ts");
  const mainSource = readSource("studio/client/main.ts");
  const navigationShellSource = readSource("studio/client/shell/navigation-shell.ts");
  const lazyWorkbenchSource = readSource("studio/client/platform/lazy-workbench.ts");
  const deckPlanningActionsSource = readSource("studio/client/planning/deck-planning-actions.ts");
  const assistantActionsSource = readSource("studio/client/creation/assistant-actions.ts");
  const themePanelActionsSource = readSource("studio/client/creation/theme-panel-actions.ts");
  const customLayoutActionsSource = readSource("studio/client/creation/custom-layout-actions.ts");
  const variantReviewActionsSource = readSource("studio/client/variants/variant-review-actions.ts");
  const featureActionSources = deckPlanningActionsSource
    + assistantActionsSource
    + themePanelActionsSource
    + customLayoutActionsSource
    + variantReviewActionsSource;

  assert(
    /<script type="module" src="\/main\.ts"><\/script>/.test(indexSource)
      && mainModuleLazyLoaded("preview/slide-dom.ts", mainSource)
      && mainModuleLazyLoaded("app.ts", mainSource)
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
