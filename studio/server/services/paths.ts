const path = require("path");

const repoRoot = path.join(__dirname, "..", "..", "..");
const archiveDir = path.join(repoRoot, "archive");
const studioDir = path.join(repoRoot, "studio");
const clientDir = path.join(studioDir, "client");
const stateDir = path.join(studioDir, "state");
const baselineRootDir = path.join(studioDir, "baseline");
const baselineDir = baselineRootDir;
const outputDir = path.join(studioDir, "output");
const renderCheckDir = path.join(outputDir, "render-check");
const renderCheckCurrentDir = path.join(renderCheckDir, "current");
const renderCheckDiffDir = path.join(renderCheckDir, "diff");
const slidesDir = path.join(repoRoot, "slides");
const slidesOutputDir = path.join(slidesDir, "output");
const presentationsDir = path.join(repoRoot, "presentations");

module.exports = {
  archiveDir,
  baselineDir,
  baselineRootDir,
  clientDir,
  outputDir,
  presentationsDir,
  renderCheckCurrentDir,
  renderCheckDiffDir,
  repoRoot,
  slidesOutputDir,
  slidesDir,
  stateDir,
  studioDir
};
