import process from "node:process";
import { getAffectedFiles, getRepoRoot, normalizeFiles, run } from "./affected-file-utils.mjs";

const repoRoot = getRepoRoot();
const affectedFiles = normalizeFiles(getInputFiles());

if (affectedFiles.length === 0) {
  console.log("Affected guardrails skipped: no affected files found.");
  process.exit(0);
}

console.log(`Affected guardrails checking ${affectedFiles.length} file(s).`);

if (affectedFiles.every(isDocumentationFile)) {
  console.log("Affected guardrails skipped: documentation-only change.");
  process.exit(0);
}

const nonDocumentationFiles = affectedFiles.filter((file) => !isDocumentationFile(file));

if (nonDocumentationFiles.every(isUnitTestFile)) {
  runOxlint(nonDocumentationFiles);
  console.log("Running affected unit test files...");
  run(repoRoot, "node", ["--test", "--test-concurrency=1", ...nonDocumentationFiles]);
  process.exit(0);
}

if (nonDocumentationFiles.every(isPresentationRenderFile)) {
  runOxlint(nonDocumentationFiles);
  console.log("Running render validation for presentation-output changes...");
  run(repoRoot, "npm", ["run", "validate:render"]);
  process.exit(0);
}

console.log("Running fast quality gate for affected source or tooling changes...");
run(repoRoot, "npm", ["run", "quality:gate:fast"]);

function runOxlint(files) {
  const lintFiles = files.filter(isLintFile);

  if (lintFiles.length === 0) {
    console.log("Oxlint skipped: no affected JavaScript or TypeScript files.");
    return;
  }

  console.log("Running Oxlint for affected files...");
  run(repoRoot, "npm", ["run", "lint", "--", ...lintFiles]);
}

function getInputFiles() {
  const cliFiles = process.argv.slice(2).filter((arg) => arg !== "--pre-push");

  if (cliFiles.length > 0) {
    return cliFiles;
  }

  return getAffectedFiles(repoRoot);
}

function isDocumentationFile(file) {
  return file.endsWith(".md") || file.startsWith("docs/");
}

function isUnitTestFile(file) {
  return /^tests\/.+\.test\.(?:ts|mjs|js)$/.test(file);
}

function isLintFile(file) {
  return /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(file);
}

function isPresentationRenderFile(file) {
  return (
    file.startsWith("presentations/") ||
    file.startsWith("slides/") ||
    file.startsWith("studio/baseline/") ||
    file === "scripts/build-deck.ts" ||
    file === "scripts/validate-render.ts" ||
    file === "scripts/update-render-baseline.ts"
  );
}
