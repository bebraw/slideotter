const path = require("path");

const repoRoot = path.join(__dirname, "..", "..", "..");
const studioDir = path.join(repoRoot, "studio");
const clientDir = path.join(studioDir, "client");
const stateDir = path.join(studioDir, "state");
const baselineDir = path.join(studioDir, "baseline");
const outputDir = path.join(studioDir, "output");
const previewDir = path.join(outputDir, "rendered-pages");
const deckStructurePreviewDir = path.join(outputDir, "deck-structure-previews");
const variantPreviewDir = path.join(outputDir, "variant-previews");
const contactSheetFile = path.join(outputDir, "contact-sheet.png");
const renderCheckDir = path.join(outputDir, "render-check");
const renderCheckCurrentDir = path.join(renderCheckDir, "current");
const renderCheckDiffDir = path.join(renderCheckDir, "diff");
const slidesDir = path.join(repoRoot, "slides");
const presentationsDir = path.join(repoRoot, "presentations");

module.exports = {
  baselineDir,
  clientDir,
  contactSheetFile,
  deckStructurePreviewDir,
  outputDir,
  previewDir,
  presentationsDir,
  renderCheckCurrentDir,
  renderCheckDiffDir,
  repoRoot,
  slidesDir,
  stateDir,
  studioDir,
  variantPreviewDir
};
