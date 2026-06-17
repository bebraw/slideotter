import { createRequire } from "node:module";
import { clientModuleLazyLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const creationOutlineRenderingSource = readClientSource("creation/creation-outline-rendering.ts");
const fileReaderActionsSource = readClientSource("core/file-reader-actions.ts");
const fileReaderSource = readClientSource("core/file-reader.ts");
const indexSource = readClientSource("index.html");
const presentationCreationWorkbenchSource = readClientSource("creation/presentation-creation-workbench.ts");
const slideEditorWorkbenchSource = readClientSource("editor/slide-editor-workbench.ts");

function validateClientFileReaderOwnership(): void {
  assert(
    /Starter image material/.test(indexSource)
      && /Find image material/.test(indexSource)
      && /Regenerate with sources\/materials/.test(indexSource)
      && /namespace StudioClientFileReader/.test(fileReaderSource)
      && /function readAsDataUrl/.test(fileReaderSource)
      && /StudioClientFileReader\.readAsDataUrl\(\{ FileReader: windowRef\.FileReader \}, file\)/.test(fileReaderActionsSource)
      && /import\("\.\/file-reader\.ts"\)/.test(fileReaderActionsSource)
      && !clientModuleLazyLoaded("core/file-reader.ts", appSource)
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
