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

function clientModuleLazyLoaded(fileName: string, appSource: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(appSource);
}

export function validateClientEndpointOwnership(): void {
  const appSource = readSource("studio/client/app-composition.ts");
  const customLayoutWorkbenchSource = readSource("studio/client/creation/custom-layout-workbench.ts");
  const mainSource = readSource("studio/client/main.ts");
  const navigationShellSource = readSource("studio/client/shell/navigation-shell.ts");
  const stateSource = readSource("studio/client/core/state.ts");
  const themePanelActionsSource = readSource("studio/client/creation/theme-panel-actions.ts");
  const themeWorkbenchSource = readSource("studio/client/creation/theme-workbench.ts");

  assert(
    /namespace StudioClientThemeWorkbench/.test(themeWorkbenchSource)
      && /function createThemeWorkbench/.test(themeWorkbenchSource)
      && /function renderSavedThemes/.test(themeWorkbenchSource)
      && /function renderFavorites/.test(themeWorkbenchSource)
      && /function renderStage/.test(themeWorkbenchSource)
      && /function renderReview/.test(themeWorkbenchSource)
      && /function getSelectedPreviewEntry/.test(themeWorkbenchSource)
      && /creation-theme-preview-current/.test(themeWorkbenchSource)
      && !/creation-theme-preview-card/.test(themeWorkbenchSource)
      && /function mount\(\)/.test(themeWorkbenchSource)
      && /async function generateFromBrief/.test(themeWorkbenchSource)
      && /request(?:<[^>]+>)?\("\/api\/v1\/themes\/generate"/.test(themeWorkbenchSource)
      && /request(?:<[^>]+>)?\("\/api\/v1\/themes\/candidates"/.test(themeWorkbenchSource)
      && /themeCandidates: \[\]/.test(stateSource)
      && /import\("\.\/theme-workbench\.ts"\)/.test(themePanelActionsSource)
      && !clientModuleLazyLoaded("creation/theme-workbench.ts", appSource)
      && /async function getLoadedWorkbench/.test(themePanelActionsSource)
      && !/async function getThemeWorkbench/.test(appSource)
      && !/function loadThemeWorkbench/.test(appSource)
      && /mount: \(workbench\) => workbench\.mount\(\)/.test(themePanelActionsSource)
      && !clientModuleLoaded("creation/theme-workbench.ts", [mainSource, appSource, navigationShellSource])
      && !/request\("\/api\/themes\/generate"/.test(appSource)
      && !/function generateThemeFromBriefText/.test(appSource)
      && !/async function generateThemeFromBrief/.test(appSource)
      && !/async function generateThemeCandidates/.test(appSource)
      && !/function hashTextToIndex/.test(appSource)
      && !/function renderCreationThemeReview/.test(appSource)
      && !/function getThemeTokenSummary/.test(appSource)
      && !/const candidateSets/.test(appSource)
      && !/const candidateSets/.test(themeWorkbenchSource),
    "Theme generation and candidate construction should rely on server endpoints instead of browser-side fallback tokens"
  );

  assert(
    /request\("\/api\/v1\/layouts\/custom\/draft"/.test(customLayoutWorkbenchSource)
      && !/function createCustomLayoutSlots/.test(appSource)
      && !/function createCoverLayoutRegions/.test(appSource)
      && !/function createContentLayoutRegions/.test(appSource)
      && !/function createCustomLayoutDefinitionFromControls/.test(appSource)
      && !/function createLayoutStudioDefinitionFromControls/.test(appSource),
    "Custom layout draft slot and region construction should be server-owned"
  );
}
