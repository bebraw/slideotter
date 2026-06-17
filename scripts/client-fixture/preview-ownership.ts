import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert, readClientCss } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const appFoundationSource = readClientSource("app-foundation.ts");
const appCallbacksSource = readClientSource("core/app-callbacks.ts");
const domPreviewRecordSource = readClientSource("preview/dom-preview-record.ts");
const domPreviewSlidesSource = readClientSource("preview/dom-preview-slides.ts");
const domPreviewThemeSource = readClientSource("preview/dom-preview-theme.ts");
const domPreviewWorkbenchSource = readClientSource("preview/dom-preview-workbench.ts");
const mainSource = readClientSource("main.ts");
const navigationShellSource = readClientSource("shell/navigation-shell.ts");
const previewActionsSource = readClientSource("preview/preview-actions.ts");
const previewWorkbenchSource = readClientSource("preview/preview-workbench.ts");
const slidePreviewSource = readClientSource("preview/slide-preview.ts");

const stylesSource = readClientCss();
const eagerLoadSources = [mainSource, appSource, appFoundationSource, navigationShellSource];

function all(checks: boolean[]): boolean {
  return checks.every(Boolean);
}

function validateDomPreviewOwnership(): void {
  assert(
    all([
      /function isJsonRecord/.test(domPreviewRecordSource),
      /function getCurrentTheme/.test(domPreviewThemeSource),
      /function getVariantVisualTheme/.test(domPreviewThemeSource),
      /function getWindowCurrentTheme/.test(domPreviewThemeSource),
      /function getWindowVariantVisualTheme/.test(domPreviewThemeSource),
      /function setFromPayload/.test(domPreviewSlidesSource),
      /function patchSlideSpec/.test(domPreviewSlidesSource),
      /function getSlideSpec/.test(domPreviewSlidesSource),
      clientModuleLoaded("preview/dom-preview-workbench.ts", eagerLoadSources),
      /from "\.\/dom-preview-slides\.ts"/.test(domPreviewWorkbenchSource),
      /from "\.\/dom-preview-theme\.ts"/.test(domPreviewWorkbenchSource),
      /getWindowCurrentTheme\(state, windowRef\)/.test(domPreviewWorkbenchSource),
      /getWindowVariantVisualTheme\(state, windowRef, variant\)/.test(domPreviewWorkbenchSource),
      !/getWindowCurrentTheme\(state, window\)/.test(appSource),
      !/getWindowVariantVisualTheme\(state, window, variant\)/.test(appSource),
      !/type SlideDomWindow/.test(appSource),
      !/const domPreview = isJsonRecord\(payload\.domPreview\)/.test(appSource)
    ]),
    "DOM preview payload and theme shaping should live outside the main app orchestrator"
  );
}

function validateSlidePreviewOwnership(): void {
  assert(
    all([
      /namespace StudioClientSlidePreview/.test(slidePreviewSource),
      /function createSlidePreview/.test(slidePreviewSource),
      /function renderDomSlide/.test(slidePreviewSource),
      /function renderImagePreview/.test(slidePreviewSource),
      clientModuleLoaded("preview/dom-preview-workbench.ts", eagerLoadSources),
      /from "\.\/slide-preview\.ts"/.test(domPreviewWorkbenchSource),
      /const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(domPreviewWorkbenchSource),
      !/const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(appSource)
    ]),
    "Shared slide preview rendering should live in a feature script"
  );
}

function validatePreviewWorkbenchOwnership(): void {
  assert(
    all([
      /namespace StudioClientPreviewWorkbench/.test(previewWorkbenchSource),
      /function createPreviewWorkbench/.test(previewWorkbenchSource),
      /function getThumbnailStacks\(\)/.test(previewWorkbenchSource),
      /thumb-stack/.test(previewWorkbenchSource),
      /thumb-detour/.test(stylesSource),
      /function render\(\)/.test(previewWorkbenchSource),
      /function renderLiveThumbnailPlaceholder/.test(previewWorkbenchSource),
      /thumb-live-placeholder/.test(stylesSource),
      /getLiveStudioContentRun/.test(previewWorkbenchSource),
      /getLivePreviewSlideSpec/.test(previewWorkbenchSource),
      /selectSlideByIndex\(slide\.index\)/.test(previewWorkbenchSource),
      /namespace StudioClientPreviewActions/.test(previewActionsSource),
      /import\("\.\/preview-workbench\.ts"\)/.test(previewActionsSource),
      /const lazyWorkbench = StudioClientLazyWorkbench\.createLazyWorkbench/.test(previewActionsSource),
      /const previewActions = StudioClientPreviewActions\.createPreviewActions/.test(appSource),
      /getPreviewActions: registry\.getPreviewActions/.test(appSource),
      /getPreviewActions\(\)\.render\(\)/.test(appCallbacksSource),
      !clientModuleLoaded("preview/preview-workbench.ts", eagerLoadSources),
      !clientModuleLazyLoaded("preview/preview-workbench.ts", appSource),
      !/const thumbRailScrollLeft = elements\.thumbRail\.scrollLeft/.test(appSource)
    ]),
    "Active preview and thumbnail rail rendering should live behind the preview action split point"
  );
}

function validateClientPreviewOwnership(): void {
  validateDomPreviewOwnership();
  validateSlidePreviewOwnership();
  validatePreviewWorkbenchOwnership();
}

export { validateClientPreviewOwnership };
