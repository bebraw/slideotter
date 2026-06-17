import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readClientSource, readProjectSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const artifactDownloadSource = readClientSource("exports/artifact-download.ts");
const buildValidationHandlersSource = readProjectSource("studio/server/build-validation-handlers.ts");
const commandControlsSource = readClientSource("shell/command-controls.ts");
const exportActionsSource = readClientSource("exports/export-actions.ts");
const exportMenuSource = readClientSource("shell/export-menu.ts");
const exportWorkbenchSource = readClientSource("exports/export-workbench.ts");
const indexSource = readClientSource("index.html");
const mainSource = readClientSource("main.ts");
const navigationShellSource = readClientSource("shell/navigation-shell.ts");
const presentationModeActionsSource = readClientSource("shell/presentation-mode-actions.ts");
const presentationModeControlSource = readClientSource("shell/presentation-mode-control.ts");
const presentationModeStateSource = readClientSource("shell/presentation-mode-state.ts");
const presentationModeWorkbenchSource = readClientSource("shell/presentation-mode-workbench.ts");
const startupActionsSource = readClientSource("shell/startup-actions.ts");
const eagerLoadSources = [mainSource, appSource, navigationShellSource];

function validateClientExportPresentationModeOwnership(): void {
  assert(
    /id="export-pdf-button"/.test(indexSource)
      && /id="export-pptx-button"/.test(indexSource)
      && /namespace StudioClientExportMenu/.test(exportMenuSource)
      && /function createExportMenu/.test(exportMenuSource)
      && /const exportMenu = StudioClientExportMenu\.createExportMenu\(elements\)/.test(startupActionsSource)
      && !/StudioClientExportMenu\.createExportMenu/.test(appSource)
      && /namespace StudioClientArtifactDownload/.test(artifactDownloadSource)
      && /function getFileName/.test(artifactDownloadSource)
      && /function download/.test(artifactDownloadSource)
      && /function getPdfExportStatus/.test(artifactDownloadSource)
      && /function getPptxExportStatus/.test(artifactDownloadSource)
      && /namespace StudioClientExportActions/.test(exportActionsSource)
      && /import\("\.\/export-workbench\.ts"\)/.test(exportActionsSource)
      && /namespace StudioClientExportWorkbench/.test(exportWorkbenchSource)
      && /exportPdf: async/.test(exportActionsSource)
      && !clientModuleLazyLoaded("exports/export-workbench.ts", appSource)
      && /StudioClientArtifactDownload\.download/.test(exportWorkbenchSource)
      && /StudioClientArtifactDownload\.getPdfExportStatus/.test(exportWorkbenchSource)
      && /StudioClientArtifactDownload\.getPptxExportStatus/.test(exportWorkbenchSource)
      && /elements\.exportPdfButton\.addEventListener/.test(commandControlsSource)
      && !/Exported PPTX \(\$\{slideCount\} slide/.test(appSource)
      && !/function getArtifactFileName/.test(appSource)
      && !/function setExportMenuOpen/.test(appSource)
      && !/StudioClientArtifactDownload\.download/.test(appSource)
      && !clientModuleLoaded("exports/artifact-download.ts", eagerLoadSources)
      && !clientModuleLazyLoaded("exports/artifact-download.ts", appSource)
      && /pdf:\s*\{/.test(buildValidationHandlersSource)
      && /pptx:\s*\{/.test(buildValidationHandlersSource),
    "PDF and PPTX exports should be discoverable from the main Studio header"
  );

  assert(
    /namespace StudioClientPresentationModeControl/.test(presentationModeControlSource)
      && /function openPresentationMode/.test(presentationModeControlSource)
      && /windowRef\.open\(url, "_blank"\)/.test(presentationModeControlSource)
      && /namespace StudioClientPresentationModeActions/.test(presentationModeActionsSource)
      && /import\("\.\/presentation-mode-workbench\.ts"\)/.test(presentationModeActionsSource)
      && /StudioClientPresentationModeControl\.openPresentationMode/.test(presentationModeWorkbenchSource)
      && !clientModuleLazyLoaded("shell/presentation-mode-workbench.ts", appSource)
      && !/StudioClientPresentationModeControl\.openPresentationMode/.test(appSource)
      && !/window\.open\(url, "_blank"\)/.test(appSource),
    "Presentation mode window launch behavior should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientPresentationModeState/.test(presentationModeStateSource)
      && /function getPresentationModeUrl/.test(presentationModeStateSource)
      && /function getPresentHref/.test(presentationModeStateSource)
      && /StudioClientPresentationModeState\.getPresentationModeUrl\(state, presentationId\)/.test(presentationModeWorkbenchSource)
      && !/StudioClientPresentationModeState\.getPresentationModeUrl\(state, presentationId\)/.test(appSource)
      && !/const presentHref = state\.hypermedia/.test(appSource),
    "Presentation mode URL construction should live outside the main app orchestrator"
  );
}

export { validateClientExportPresentationModeOwnership };
