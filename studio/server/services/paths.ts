import * as path from "path";
import { getRuntimeConfig } from "./runtime-config.ts";

const config = getRuntimeConfig();
const repoRoot = config.appRoot;
const archiveDir = config.archiveDir;
const studioDir = config.studioDir;
const clientDir = config.clientDir;
const clientDistDir = config.clientDistDir;
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
const librariesDir = config.librariesDir;
const mode = config.mode;
const userDataRoot = config.userDataRoot;

export {
  archiveDir,
  baselineDir,
  baselineRootDir,
  clientDir,
  clientDistDir,
  librariesDir,
  logsDir,
  mode,
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
  userDataRoot
};
