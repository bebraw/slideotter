const fs = require("fs");
const os = require("os");
const path = require("path");

const appRoot = path.join(__dirname, "..", "..", "..");
const defaultUserDataRoot = path.join(os.homedir(), ".slideotter");

function resolvePath(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }

  if (raw.startsWith("~/")) {
    return path.resolve(os.homedir(), raw.slice(2));
  }

  return path.resolve(raw);
}

function createRepoConfig() {
  const studioDir = path.join(appRoot, "studio");
  const slidesDir = path.join(appRoot, "slides");
  const outputDir = path.join(studioDir, "output");

  return {
    appRoot,
    archiveDir: path.join(appRoot, "archive"),
    baselineRootDir: path.join(studioDir, "baseline"),
    clientDir: path.join(studioDir, "client"),
    clientDistDir: path.join(studioDir, "client-dist"),
    envDir: appRoot,
    librariesDir: path.join(appRoot, "libraries"),
    logsDir: path.join(outputDir, "logs"),
    mode: "repo",
    outputDir,
    presentationsDir: path.join(appRoot, "presentations"),
    renderCheckDir: path.join(outputDir, "render-check"),
    slidesDir,
    slidesOutputDir: path.join(slidesDir, "output"),
    stateDir: path.join(studioDir, "state"),
    studioDir,
    userDataRoot: appRoot
  };
}

function createUserDataConfig(userDataRootInput) {
  const userDataRoot = resolvePath(userDataRootInput, defaultUserDataRoot);
  const outputDir = path.join(userDataRoot, "output");
  const studioDir = path.join(appRoot, "studio");

  return {
    appRoot,
    archiveDir: path.join(userDataRoot, "archive"),
    baselineRootDir: path.join(userDataRoot, "baseline"),
    clientDir: path.join(studioDir, "client"),
    clientDistDir: path.join(studioDir, "client-dist"),
    envDir: userDataRoot,
    librariesDir: path.join(userDataRoot, "libraries"),
    logsDir: path.join(userDataRoot, "logs"),
    mode: "user",
    outputDir,
    presentationsDir: path.join(userDataRoot, "presentations"),
    renderCheckDir: path.join(outputDir, "render-check"),
    slidesDir: path.join(appRoot, "slides"),
    slidesOutputDir: outputDir,
    stateDir: path.join(userDataRoot, "state"),
    studioDir,
    userDataRoot
  };
}

function resolveRuntimeConfig() {
  const configuredHome = process.env.SLIDEOTTER_HOME || process.env.SLIDEOTTER_DATA_DIR || "";
  if (configuredHome) {
    return createUserDataConfig(configuredHome);
  }

  return createRepoConfig();
}

function getRuntimeConfig() {
  return resolveRuntimeConfig();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonIfMissing(fileName, value) {
  if (fs.existsSync(fileName)) {
    return;
  }

  ensureDir(path.dirname(fileName));
  fs.writeFileSync(fileName, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }
  if (fs.existsSync(targetDir)) {
    return;
  }

  ensureDir(targetDir);
  fs.cpSync(sourceDir, targetDir, {
    force: false,
    recursive: true
  });
}

function hasSlideFiles(presentationDir) {
  const slidesDir = path.join(presentationDir, "slides");
  return fs.existsSync(slidesDir)
    && fs.readdirSync(slidesDir).some((fileName) => /^slide-\d+\.json$/.test(fileName));
}

function ensureTutorialPresentation(config) {
  const sourcePresentationDir = path.join(appRoot, "presentations", "slideotter");
  const targetPresentationDir = path.join(config.presentationsDir, "slideotter");

  if (hasSlideFiles(targetPresentationDir)) {
    return;
  }

  fs.rmSync(targetPresentationDir, {
    force: true,
    recursive: true
  });
  copyDirectory(sourcePresentationDir, targetPresentationDir);
}

function initializeUserData(options: any = {}) {
  const config = createUserDataConfig(options.userDataRoot || process.env.SLIDEOTTER_HOME || process.env.SLIDEOTTER_DATA_DIR);
  [
    config.userDataRoot,
    config.presentationsDir,
    path.join(config.librariesDir, "layouts"),
    path.join(config.librariesDir, "themes"),
    config.logsDir,
    config.stateDir,
    config.outputDir,
    config.baselineRootDir,
    config.archiveDir
  ].forEach(ensureDir);

  writeJsonIfMissing(path.join(config.userDataRoot, "config.json"), {
    userData: {
      archiveDir: "archive",
      baselineDir: "baseline",
      librariesDir: "libraries",
      outputDir: "output",
      presentationsDir: "presentations",
      stateDir: "state"
    },
    version: 1
  });

  ensureTutorialPresentation(config);
  writeJsonIfMissing(path.join(config.stateDir, "presentations.json"), {
    presentations: [
      {
        id: "slideotter",
        title: "slideotter"
      }
    ]
  });

  return config;
}

function isUserDataMode() {
  return getRuntimeConfig().mode === "user";
}

module.exports = {
  appRoot,
  defaultUserDataRoot,
  getRuntimeConfig,
  initializeUserData,
  isUserDataMode
};
