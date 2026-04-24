const fs = require("fs");
const path = require("path");
const {
  outputDir,
  presentationsDir,
  slidesOutputDir,
  slidesDir,
  stateDir
} = require("./paths.ts");

const allowedStateFiles = new Set([
  "deck-context.json",
  "materials.json",
  "presentations.json",
  "sessions.json",
  "sources.json",
  "variants.json"
]);

function isWithinRoot(targetPath, rootPath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);

  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function isAllowedSlideFile(targetPath) {
  return /^slide-\d+\.(json|js)$/.test(path.basename(targetPath))
    && (
      isWithinRoot(targetPath, slidesDir)
      || isWithinRoot(targetPath, presentationsDir)
    );
}

function isAllowedStateFile(targetPath) {
  const baseName = path.basename(targetPath);

  if (isWithinRoot(targetPath, stateDir) && allowedStateFiles.has(baseName)) {
    return true;
  }

  return isWithinRoot(targetPath, presentationsDir)
    && (baseName === "deck-context.json" || baseName === "materials.json" || baseName === "sources.json" || baseName === "variants.json" || baseName === "presentation.json");
}

function isAllowedMaterialFile(targetPath) {
  const relative = path.relative(presentationsDir, path.resolve(targetPath));
  const parts = relative.split(path.sep);

  return parts.length >= 3 && parts[1] === "materials" && !parts.includes("..");
}

function isAllowedOutputPath(targetPath) {
  return isWithinRoot(targetPath, outputDir) || isWithinRoot(targetPath, slidesOutputDir);
}

function assertAllowedWriteTarget(targetPath, action = "write") {
  if (isAllowedSlideFile(targetPath) || isAllowedStateFile(targetPath) || isAllowedMaterialFile(targetPath) || isAllowedOutputPath(targetPath)) {
    return path.resolve(targetPath);
  }

  throw new Error(`Refused to ${action} outside the studio write boundary: ${targetPath}`);
}

function assertAllowedDirectory(targetPath, action = "create directory") {
  if (isAllowedOutputPath(targetPath) || isWithinRoot(targetPath, presentationsDir) || isWithinRoot(targetPath, stateDir) || isWithinRoot(targetPath, slidesDir)) {
    return path.resolve(targetPath);
  }

  throw new Error(`Refused to ${action} outside the studio write boundary: ${targetPath}`);
}

function ensureAllowedDir(targetPath) {
  const resolved = assertAllowedDirectory(targetPath);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function writeAllowedJson(fileName, value) {
  const resolved = assertAllowedWriteTarget(fileName);
  ensureAllowedDir(path.dirname(resolved));
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return resolved;
}

function writeAllowedText(fileName, value) {
  const resolved = assertAllowedWriteTarget(fileName);
  ensureAllowedDir(path.dirname(resolved));
  fs.writeFileSync(resolved, value, "utf8");
  return resolved;
}

function writeAllowedBinary(fileName, value) {
  const resolved = assertAllowedWriteTarget(fileName);
  ensureAllowedDir(path.dirname(resolved));
  fs.writeFileSync(resolved, value);
  return resolved;
}

function copyAllowedFile(sourcePath, targetPath) {
  const resolvedTarget = assertAllowedWriteTarget(targetPath, "copy");
  ensureAllowedDir(path.dirname(resolvedTarget));
  fs.copyFileSync(sourcePath, resolvedTarget);
  return resolvedTarget;
}

function removeAllowedPath(targetPath, options: any = {}) {
  const resolved = assertAllowedWriteTarget(targetPath, "remove");
  fs.rmSync(resolved, options);
  return resolved;
}

function describeAllowedWriteTargets() {
  return [
    "`slides/slide-*.json` and `slides/slide-*.js`",
    "`presentations/<id>/slides/slide-*.json`",
    "`presentations/<id>/materials/**`",
    "`presentations/<id>/state/deck-context.json`",
    "`presentations/<id>/state/materials.json`",
    "`presentations/<id>/state/sources.json`",
    "`presentations/<id>/state/variants.json`",
    "`presentations/<id>/presentation.json`",
    "`studio/state/deck-context.json`",
    "`studio/state/presentations.json`",
    "`studio/state/sources.json`",
    "`studio/state/variants.json`",
    "`studio/state/sessions.json`",
    "`studio/output/**`",
    "`slides/output/**`"
  ];
}

module.exports = {
  assertAllowedWriteTarget,
  copyAllowedFile,
  describeAllowedWriteTargets,
  ensureAllowedDir,
  removeAllowedPath,
  writeAllowedBinary,
  writeAllowedJson,
  writeAllowedText
};
