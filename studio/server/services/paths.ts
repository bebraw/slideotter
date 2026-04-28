const path = require("path");
const { getRuntimeConfig } = require("./runtime-config.ts");

const config = getRuntimeConfig();
const repoRoot = config.appRoot;
const archiveDir = config.archiveDir;
const studioDir = config.studioDir;
const clientDir = config.clientDir;
const stateDir = config.stateDir;
const baselineRootDir = config.baselineRootDir;
const baselineDir = baselineRootDir;
const outputDir = config.outputDir;
const logsDir = config.logsDir;
const renderCheckDir = config.renderCheckDir;
const renderCheckCurrentDir = path.join(renderCheckDir, "current");
const renderCheckDiffDir = path.join(renderCheckDir, "diff");
const slidesDir = config.slidesDir;
const slidesOutputDir = config.slidesOutputDir;
const presentationsDir = config.presentationsDir;

module.exports = {
  archiveDir,
  baselineDir,
  baselineRootDir,
  clientDir,
  librariesDir: config.librariesDir,
  logsDir,
  mode: config.mode,
  outputDir,
  presentationsDir,
  renderCheckCurrentDir,
  renderCheckDiffDir,
  renderCheckDir,
  repoRoot,
  slidesOutputDir,
  slidesDir,
  stateDir,
  studioDir,
  userDataRoot: config.userDataRoot
};
