import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert, readClientCss } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app-composition.ts"), "utf8");
const appFoundationSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app-foundation.ts"), "utf8");
const appCallbacksSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/app-callbacks.ts"), "utf8");
const domPreviewStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/dom-preview-state.ts"), "utf8");
const domPreviewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/dom-preview-workbench.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const previewActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/preview-actions.ts"), "utf8");
const previewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/preview-workbench.ts"), "utf8");
const slidePreviewSource = fs.readFileSync(path.join(process.cwd(), "studio/client/preview/slide-preview.ts"), "utf8");

const stylesSource = readClientCss();

function clientModuleLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return pattern.test(mainSource)
    || pattern.test(appSource)
    || pattern.test(appFoundationSource)
    || pattern.test(navigationShellSource);
}

function clientModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(appSource);
}

function validateClientPreviewOwnership(): void {
  assert(
    /namespace StudioClientDomPreviewState/.test(domPreviewStateSource)
      && /function getCurrentTheme/.test(domPreviewStateSource)
      && /function getVariantVisualTheme/.test(domPreviewStateSource)
      && /function getWindowCurrentTheme/.test(domPreviewStateSource)
      && /function getWindowVariantVisualTheme/.test(domPreviewStateSource)
      && /function setFromPayload/.test(domPreviewStateSource)
      && /function patchSlideSpec/.test(domPreviewStateSource)
      && /function getSlideSpec/.test(domPreviewStateSource)
      && clientModuleLoaded("preview/dom-preview-workbench.ts")
      && /from "\.\/dom-preview-state\.ts"/.test(domPreviewWorkbenchSource)
      && /StudioClientDomPreviewState\.getWindowCurrentTheme\(state, windowRef\)/.test(domPreviewWorkbenchSource)
      && /StudioClientDomPreviewState\.getWindowVariantVisualTheme\(state, windowRef, variant\)/.test(domPreviewWorkbenchSource)
      && !/StudioClientDomPreviewState\.getWindowCurrentTheme\(state, window\)/.test(appSource)
      && !/StudioClientDomPreviewState\.getWindowVariantVisualTheme\(state, window, variant\)/.test(appSource)
      && !/type SlideDomWindow/.test(appSource)
      && !/const domPreview = isJsonRecord\(payload\.domPreview\)/.test(appSource),
    "DOM preview payload and theme shaping should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientSlidePreview/.test(slidePreviewSource)
      && /function createSlidePreview/.test(slidePreviewSource)
      && /function renderDomSlide/.test(slidePreviewSource)
      && /function renderImagePreview/.test(slidePreviewSource)
      && clientModuleLoaded("preview/dom-preview-workbench.ts")
      && /from "\.\/slide-preview\.ts"/.test(domPreviewWorkbenchSource)
      && /const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(domPreviewWorkbenchSource)
      && !/const slidePreview = StudioClientSlidePreview\.createSlidePreview/.test(appSource),
    "Shared slide preview rendering should live in a feature script"
  );
  assert(
    /namespace StudioClientPreviewWorkbench/.test(previewWorkbenchSource)
      && /function createPreviewWorkbench/.test(previewWorkbenchSource)
      && /function getThumbnailStacks\(\)/.test(previewWorkbenchSource)
      && /thumb-stack/.test(previewWorkbenchSource)
      && /thumb-detour/.test(stylesSource)
      && /function render\(\)/.test(previewWorkbenchSource)
      && /function renderLiveThumbnailPlaceholder/.test(previewWorkbenchSource)
      && /thumb-live-placeholder/.test(stylesSource)
      && /getLiveStudioContentRun/.test(previewWorkbenchSource)
      && /getLivePreviewSlideSpec/.test(previewWorkbenchSource)
      && /selectSlideByIndex\(slide\.index\)/.test(previewWorkbenchSource)
      && /namespace StudioClientPreviewActions/.test(previewActionsSource)
      && /import\("\.\/preview-workbench\.ts"\)/.test(previewActionsSource)
      && /const lazyWorkbench = StudioClientLazyWorkbench\.createLazyWorkbench/.test(previewActionsSource)
      && /const previewActions = StudioClientPreviewActions\.createPreviewActions/.test(appSource)
      && /getPreviewActions: registry\.getPreviewActions/.test(appSource)
      && /getPreviewActions\(\)\.render\(\)/.test(appCallbacksSource)
      && !clientModuleLoaded("preview/preview-workbench.ts")
      && !clientModuleLazyLoaded("preview/preview-workbench.ts")
      && !/const thumbRailScrollLeft = elements\.thumbRail\.scrollLeft/.test(appSource),
    "Active preview and thumbnail rail rendering should live behind the preview action split point"
  );
}

export { validateClientPreviewOwnership };
