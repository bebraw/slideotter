import * as fs from "fs";
import { getActivePresentationPathsFromRuntime } from "./presentation-paths.ts";

function getActiveDeckContextFile() {
  return getActivePresentationPathsFromRuntime().deckContextFile;
}

function readActiveDeckContext(fallback: unknown) {
  try {
    return JSON.parse(fs.readFileSync(getActiveDeckContextFile(), "utf8"));
  } catch (error) {
    return fallback;
  }
}

const _test = {
  getActiveDeckContextFile
};

export {
  _test,
  readActiveDeckContext
};
