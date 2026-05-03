import * as fs from "fs";
import * as path from "path";
import { stateDir } from "./paths.ts";
import { getActivePresentationPaths } from "./presentations.ts";

const legacyDeckContextFile = path.join(stateDir, "deck-context.json");

function getActiveDeckContextFile() {
  try {
    return getActivePresentationPaths().deckContextFile;
  } catch (error) {
    // Compatibility path for pre-presentation-scoped installs that only have studio/state/deck-context.json.
    // Remove with the legacy global deck-context reader after user-data migration no longer supports that state shape.
    return legacyDeckContextFile;
  }
}

function readActiveDeckContext(fallback: unknown) {
  try {
    return JSON.parse(fs.readFileSync(getActiveDeckContextFile(), "utf8"));
  } catch (error) {
    try {
      // Keep the old global deck context readable while existing user data migrates to presentations/<id>/state.
      // Remove when all active deck readers require presentation-scoped deck-context files.
      return JSON.parse(fs.readFileSync(legacyDeckContextFile, "utf8"));
    } catch (legacyError) {
      return fallback;
    }
  }
}

const _test = {
  getActiveDeckContextFile
};

export {
  _test,
  getActiveDeckContextFile,
  readActiveDeckContext
};
