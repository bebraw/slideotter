import * as fs from "fs";
import * as path from "path";
import { stateDir } from "./paths.ts";
import { getActivePresentationPaths } from "./presentations.ts";

const legacyDeckContextFile = path.join(stateDir, "deck-context.json");

function getActiveDeckContextFile() {
  try {
    return getActivePresentationPaths().deckContextFile;
  } catch (error) {
    return legacyDeckContextFile;
  }
}

function readActiveDeckContext(fallback: unknown) {
  try {
    return JSON.parse(fs.readFileSync(getActiveDeckContextFile(), "utf8"));
  } catch (error) {
    try {
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
