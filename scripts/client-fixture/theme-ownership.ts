import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const appThemeSource = readClientSource("shell/app-theme.ts");
const commandControlsSource = readClientSource("shell/command-controls.ts");
const creationThemeStateSource = readClientSource("creation/creation-theme-state.ts");
const mainSource = readClientSource("main.ts");
const navigationShellSource = readClientSource("shell/navigation-shell.ts");
const startupActionsSource = readClientSource("shell/startup-actions.ts");
const themeActionsSource = readClientSource("creation/theme-actions.ts");
const themeCandidateStateSource = readClientSource("creation/theme-candidate-state.ts");
const themeFieldStateSource = readClientSource("creation/theme-field-state.ts");
const themeWorkbenchSource = readClientSource("creation/theme-workbench.ts");
const eagerLoadSources = [mainSource, appSource, navigationShellSource];

function validateClientThemeOwnership(): void {
  assert(
    /namespace StudioClientAppTheme/.test(appThemeSource)
      && /function createAppTheme/.test(appThemeSource)
      && /function mount\(\)/.test(appThemeSource)
      && !clientModuleLoaded("shell/app-theme.ts", eagerLoadSources)
      && clientModuleLazyLoaded("app-theme.ts", startupActionsSource)
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
