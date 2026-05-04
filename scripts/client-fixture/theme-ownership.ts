import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const appThemeSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/app-theme.ts"), "utf8");
const commandControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/command-controls.ts"), "utf8");
const creationThemeStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/creation-theme-state.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const startupActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/startup-actions.ts"), "utf8");
const themeActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-actions.ts"), "utf8");
const themeCandidateStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-candidate-state.ts"), "utf8");
const themeFieldStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-field-state.ts"), "utf8");
const themeWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/theme-workbench.ts"), "utf8");

function clientModuleLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return pattern.test(mainSource)
    || pattern.test(appSource)
    || pattern.test(navigationShellSource);
}

function startupModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(startupActionsSource);
}

function validateClientThemeOwnership(): void {
  assert(
    /namespace StudioClientAppTheme/.test(appThemeSource)
      && /function createAppTheme/.test(appThemeSource)
      && /function mount\(\)/.test(appThemeSource)
      && !clientModuleLoaded("shell/app-theme.ts")
      && startupModuleLazyLoaded("app-theme.ts")
      && /StudioClientAppTheme\.createAppTheme/.test(startupActionsSource)
      && !/const appTheme = StudioClientAppTheme\.createAppTheme/.test(appSource)
      && /appTheme\.mount\(\);/.test(commandControlsSource),
    "App theme behavior should live in a feature script with its own mount behind shell startup"
  );
  assert(
    /namespace StudioClientThemeFieldState/.test(themeFieldStateSource)
      && /function read/.test(themeFieldStateSource)
      && /function apply/.test(themeFieldStateSource)
      && /function setBrief/.test(themeFieldStateSource)
      && /function getBrief/.test(themeFieldStateSource)
      && /StudioClientThemeFieldState\.read\(elements\)/.test(themeActionsSource)
      && /StudioClientThemeFieldState\.apply\(windowRef\.document, elements, theme\)/.test(themeActionsSource)
      && !/StudioClientThemeFieldState\.read\(elements\)/.test(appSource)
      && !/StudioClientThemeFieldState\.apply\(window\.document, elements, theme\)/.test(appSource)
      && !/function toColorInputValue/.test(appSource)
      && !/function toFontSelectValue/.test(appSource),
    "Theme field normalization and DOM field mapping should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientThemeCandidateState/.test(themeCandidateStateSource)
      && /function resetCandidates/.test(themeCandidateStateSource)
      && /StudioClientThemeCandidateState\.resetCandidates\(state\)/.test(themeActionsSource)
      && /StudioClientThemeCandidateState\.resetCandidates\(state\)/.test(themeWorkbenchSource)
      && !/StudioClientThemeCandidateState\.resetCandidates\(state\)/.test(appSource)
      && !/state\.ui\.themeCandidateRefreshIndex = 0;/.test(appSource),
    "Theme candidate reset rules should be shared across app and theme workbench"
  );
  assert(
    /namespace StudioClientCreationThemeState/.test(creationThemeStateSource)
      && /function getSavedThemeFields/.test(creationThemeStateSource)
      && /function getSelectedThemeVariant/.test(creationThemeStateSource)
      && /function applyThemeSavePayload/.test(creationThemeStateSource)
      && /StudioClientCreationThemeState\.getSavedThemeFields\(state\.savedThemes, themeId\)/.test(themeActionsSource)
      && /StudioClientCreationThemeState\.getSelectedThemeVariant/.test(themeActionsSource)
      && /StudioClientCreationThemeState\.applyThemeSavePayload\(state, payload\)/.test(themeActionsSource)
      && !/StudioClientCreationThemeState\.getSavedThemeFields\(state\.savedThemes, themeId\)/.test(appSource)
      && !/StudioClientCreationThemeState\.getSelectedThemeVariant/.test(appSource)
      && !/StudioClientCreationThemeState\.applyThemeSavePayload\(state, payload\)/.test(appSource)
      && !/state\.savedThemes\.find\(\(theme\) => theme\.id === themeId\)/.test(appSource),
    "Creation theme saved-theme lookup, save payload merging, and fallback variant shaping should live outside the main app orchestrator"
  );
  assert(
    /function mountThemeInputs\(\)/.test(themeWorkbenchSource)
      && /mountThemeInputs\(\);/.test(themeWorkbenchSource)
      && !/function mountThemeInputs\(\)/.test(appSource),
    "Theme field event bindings should live in the theme workbench"
  );
}

export { validateClientThemeOwnership };
