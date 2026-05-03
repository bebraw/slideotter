import * as fs from "fs";
import { getActivePresentationPaths } from "./presentations.ts";

function getActiveDeckContextFile() {
  return getActivePresentationPaths().deckContextFile;
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
  getActiveDeckContextFile,
  readActiveDeckContext
};
