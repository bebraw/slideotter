const path = require("path");

const repoRoot = path.join(__dirname, "..", "..", "..");
const studioDir = path.join(repoRoot, "studio");
const clientDir = path.join(studioDir, "client");
const stateDir = path.join(studioDir, "state");
const outputDir = path.join(studioDir, "output");
const previewDir = path.join(outputDir, "rendered-pages");
const contactSheetFile = path.join(outputDir, "contact-sheet.png");
const renderCheckDir = path.join(outputDir, "render-check");
const renderCheckCurrentDir = path.join(renderCheckDir, "current");
const renderCheckDiffDir = path.join(renderCheckDir, "diff");
const slidesDir = path.join(repoRoot, "slides");

module.exports = {
  clientDir,
  contactSheetFile,
  outputDir,
  previewDir,
  renderCheckCurrentDir,
  renderCheckDiffDir,
  repoRoot,
  slidesDir,
  stateDir,
  studioDir
};
