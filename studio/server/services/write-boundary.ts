const fs = require("fs");
const path = require("path");
const {
  archiveDir,
  baselineRootDir,
  librariesDir,
  mode,
  outputDir,
  presentationsDir,
  slidesOutputDir,
  slidesDir,
  stateDir,
  userDataRoot
} = require("./paths.ts");

const allowedStateFiles = new Set([
  "custom-visuals.json",
  "deck-context.json",
  "layouts.json",
  "materials.json",
  "outline-plans.json",
  "presentations.json",
  "runtime.json",
  "sessions.json",
  "sources.json",
  "variants.json"
]);

type RemoveOptions = {
  force?: boolean;
  recursive?: boolean;
};

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);

  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function isAllowedSlideFile(targetPath: string): boolean {
  return /^slide-\d+\.(json|js)$/.test(path.basename(targetPath))
    && (
      isWithinRoot(targetPath, slidesDir)
      || isWithinRoot(targetPath, presentationsDir)
    );
}

function isAllowedStateFile(targetPath: string): boolean {
  const baseName = path.basename(targetPath);

  if (isWithinRoot(targetPath, stateDir) && allowedStateFiles.has(baseName)) {
    return true;
  }

  return isWithinRoot(targetPath, presentationsDir)
    && (baseName === "custom-visuals.json" || baseName === "deck-context.json" || baseName === "layouts.json" || baseName === "materials.json" || baseName === "outline-plans.json" || baseName === "sources.json" || baseName === "variants.json" || baseName === "presentation.json");
}

function isAllowedMaterialFile(targetPath: string): boolean {
  const relative = path.relative(presentationsDir, path.resolve(targetPath));
  const parts = relative.split(path.sep);

  return parts.length >= 3 && parts[1] === "materials" && !parts.includes("..");
}

function isAllowedLibraryFile(targetPath: string): boolean {
  return mode === "user" && isWithinRoot(targetPath, librariesDir);
}

function isAllowedBaselinePath(targetPath: string): boolean {
  return mode === "user" && isWithinRoot(targetPath, baselineRootDir);
}

function isAllowedArchivePath(targetPath: string): boolean {
  return mode === "user"
    && isWithinRoot(targetPath, archiveDir)
    && path.extname(targetPath).toLowerCase() === ".pdf";
}

function isAllowedOutputPath(targetPath: string): boolean {
  return isWithinRoot(targetPath, outputDir) || isWithinRoot(targetPath, slidesOutputDir);
}

function assertAllowedWriteTarget(targetPath: string, action = "write"): string {
  if (isAllowedSlideFile(targetPath)
    || isAllowedStateFile(targetPath)
    || isAllowedMaterialFile(targetPath)
    || isAllowedLibraryFile(targetPath)
    || isAllowedBaselinePath(targetPath)
    || isAllowedArchivePath(targetPath)
    || isAllowedOutputPath(targetPath)) {
    return path.resolve(targetPath);
  }

  throw new Error(`Refused to ${action} outside the studio write boundary: ${targetPath}`);
}

function assertAllowedDirectory(targetPath: string, action = "create directory"): string {
  if (isAllowedOutputPath(targetPath)
    || isWithinRoot(targetPath, presentationsDir)
    || isWithinRoot(targetPath, stateDir)
    || isWithinRoot(targetPath, slidesDir)
    || (mode === "user" && (
      isWithinRoot(targetPath, userDataRoot)
      || isWithinRoot(targetPath, librariesDir)
      || isWithinRoot(targetPath, baselineRootDir)
      || isWithinRoot(targetPath, archiveDir)
    ))) {
    return path.resolve(targetPath);
  }

  throw new Error(`Refused to ${action} outside the studio write boundary: ${targetPath}`);
}

function ensureAllowedDir(targetPath: string): string {
  const resolved = assertAllowedDirectory(targetPath);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function writeAllowedJson(fileName: string, value: unknown): string {
  const resolved = assertAllowedWriteTarget(fileName);
  ensureAllowedDir(path.dirname(resolved));
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return resolved;
}

function writeAllowedText(fileName: string, value: string): string {
  const resolved = assertAllowedWriteTarget(fileName);
  ensureAllowedDir(path.dirname(resolved));
  fs.writeFileSync(resolved, value, "utf8");
  return resolved;
}

function writeAllowedBinary(fileName: string, value: string | NodeJS.ArrayBufferView): string {
  const resolved = assertAllowedWriteTarget(fileName);
  ensureAllowedDir(path.dirname(resolved));
  fs.writeFileSync(resolved, value);
  return resolved;
}

function copyAllowedFile(sourcePath: string, targetPath: string): string {
  const resolvedTarget = assertAllowedWriteTarget(targetPath, "copy");
  ensureAllowedDir(path.dirname(resolvedTarget));
  fs.copyFileSync(sourcePath, resolvedTarget);
  return resolvedTarget;
}

function removeAllowedPath(targetPath: string, options: RemoveOptions = {}): string {
  const resolved = assertAllowedWriteTarget(targetPath, "remove");
  fs.rmSync(resolved, options);
  return resolved;
}

function describeAllowedWriteTargets(): string[] {
  if (mode === "user") {
    return [
      "`~/.slideotter/presentations/<id>/slides/slide-*.json`",
      "`~/.slideotter/presentations/<id>/materials/**`",
      "`~/.slideotter/presentations/<id>/state/*.json`",
      "`~/.slideotter/presentations/<id>/presentation.json`",
      "`~/.slideotter/libraries/**`",
      "`~/.slideotter/state/*.json`",
      "`~/.slideotter/output/**`",
      "`~/.slideotter/baseline/**`",
      "`~/.slideotter/archive/*.pdf`"
    ];
  }

  return [
    "`slides/slide-*.json` and `slides/slide-*.js`",
    "`presentations/<id>/slides/slide-*.json`",
    "`presentations/<id>/materials/**`",
    "`presentations/<id>/state/deck-context.json`",
    "`presentations/<id>/state/custom-visuals.json`",
    "`presentations/<id>/state/layouts.json`",
    "`presentations/<id>/state/materials.json`",
    "`presentations/<id>/state/sources.json`",
    "`presentations/<id>/state/variants.json`",
    "`presentations/<id>/presentation.json`",
    "`studio/state/deck-context.json`",
    "`studio/state/presentations.json`",
    "`studio/state/runtime.json`",
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
