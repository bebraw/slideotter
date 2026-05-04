import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const artifactDownloadSource = fs.readFileSync(path.join(process.cwd(), "studio/client/exports/artifact-download.ts"), "utf8");
const buildValidationHandlersSource = fs.readFileSync(path.join(process.cwd(), "studio/server/build-validation-handlers.ts"), "utf8");
const commandControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/command-controls.ts"), "utf8");
const exportActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/exports/export-actions.ts"), "utf8");
const exportMenuSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/export-menu.ts"), "utf8");
const exportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/exports/export-workbench.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const presentationModeActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/presentation-mode-actions.ts"), "utf8");
const presentationModeControlSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/presentation-mode-control.ts"), "utf8");
const presentationModeStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/presentation-mode-state.ts"), "utf8");
const presentationModeWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/presentation-mode-workbench.ts"), "utf8");
const startupActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/startup-actions.ts"), "utf8");

function clientModuleLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return pattern.test(mainSource)
    || pattern.test(appSource)
    || pattern.test(navigationShellSource);
}

function clientModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(appSource);
}

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
      && !clientModuleLazyLoaded("exports/export-workbench.ts")
      && /StudioClientArtifactDownload\.download/.test(exportWorkbenchSource)
      && /StudioClientArtifactDownload\.getPdfExportStatus/.test(exportWorkbenchSource)
      && /StudioClientArtifactDownload\.getPptxExportStatus/.test(exportWorkbenchSource)
      && /elements\.exportPdfButton\.addEventListener/.test(commandControlsSource)
      && !/Exported PPTX \(\$\{slideCount\} slide/.test(appSource)
      && !/function getArtifactFileName/.test(appSource)
      && !/function setExportMenuOpen/.test(appSource)
      && !/StudioClientArtifactDownload\.download/.test(appSource)
      && !clientModuleLoaded("exports/artifact-download.ts")
      && !clientModuleLazyLoaded("exports/artifact-download.ts")
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
      && !clientModuleLazyLoaded("shell/presentation-mode-workbench.ts")
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
