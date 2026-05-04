import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const creationOutlineRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/creation-outline-rendering.ts"), "utf8");
const fileReaderActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/file-reader-actions.ts"), "utf8");
const fileReaderSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/file-reader.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const presentationCreationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-workbench.ts"), "utf8");
const slideEditorWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-editor-workbench.ts"), "utf8");

function clientModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(appSource);
}

function validateClientFileReaderOwnership(): void {
  assert(
    /Starter image material/.test(indexSource)
      && /Find image material/.test(indexSource)
      && /Regenerate with sources\/materials/.test(indexSource)
      && /namespace StudioClientFileReader/.test(fileReaderSource)
      && /function readAsDataUrl/.test(fileReaderSource)
      && /StudioClientFileReader\.readAsDataUrl\(\{ FileReader: windowRef\.FileReader \}, file\)/.test(fileReaderActionsSource)
      && /import\("\.\/file-reader\.ts"\)/.test(fileReaderActionsSource)
      && !clientModuleLazyLoaded("core/file-reader.ts")
      && !/import \{ StudioClientFileReader \} from "\.\/core\/file-reader\.ts";/.test(appSource)
      && !/StudioClientFileReaderActions\.createFileReaderActions/.test(appSource)
      && /StudioClientFileReaderActions\.createFileReaderActions/.test(presentationCreationWorkbenchSource)
      && /StudioClientFileReaderActions\.createFileReaderActions/.test(slideEditorWorkbenchSource)
      && /Image guidance/.test(creationOutlineRenderingSource)
      && /Use supplied image materials only where they help this slide/.test(creationOutlineRenderingSource),
    "Staged creation should make the image-material to per-slide guidance path visible"
  );
}

export { validateClientFileReaderOwnership };
