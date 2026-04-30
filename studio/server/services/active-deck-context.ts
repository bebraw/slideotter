const fs = require("fs");
const path = require("path");
const { stateDir } = require("./paths.ts");

const legacyDeckContextFile = path.join(stateDir, "deck-context.json");

function getActiveDeckContextFile() {
  try {
    return require("./presentations.ts").getActivePresentationPaths().deckContextFile;
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

module.exports = {
  _test: {
    getActiveDeckContextFile
  },
  getActiveDeckContextFile,
  readActiveDeckContext
};
