import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const repoRoot = getRepoRoot();
const zeroSha = "0000000000000000000000000000000000000000";
const affectedFiles = getAffectedFiles();

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
  console.log("Running affected unit test files...");
  run("node", ["--test", "--test-concurrency=1", ...nonDocumentationFiles]);
  process.exit(0);
}

if (nonDocumentationFiles.every(isPresentationRenderFile)) {
  console.log("Running render validation for presentation-output changes...");
  run("npm", ["run", "validate:render"]);
  process.exit(0);
}

console.log("Running fast quality gate for affected source or tooling changes...");
run("npm", ["run", "quality:gate:fast"]);

function getAffectedFiles() {
  const cliFiles = process.argv.slice(2).filter((arg) => arg !== "--pre-push");

  if (cliFiles.length > 0) {
    return normalizeFiles(cliFiles);
  }

  const prePushInput = process.argv.includes("--pre-push") ? readStdin() : "";
  const files = new Set();

  if (prePushInput.trim().length > 0) {
    for (const line of prePushInput.trim().split("\n")) {
      const [, localSha, , remoteSha] = line.trim().split(/\s+/);

      if (!localSha || localSha === zeroSha) {
        continue;
      }

      const changedFiles = remoteSha && remoteSha !== zeroSha
        ? gitFiles(["diff", "--name-only", "--diff-filter=ACMR", `${remoteSha}..${localSha}`])
        : gitFiles(["diff-tree", "--no-commit-id", "--name-only", "--diff-filter=ACMR", "-r", localSha]);

      for (const file of changedFiles) {
        files.add(file);
      }
    }
  }

  for (const file of getWorktreeFiles()) {
    files.add(file);
  }

  if (files.size === 0) {
    for (const file of getBranchFiles()) {
      files.add(file);
    }
  }

  return normalizeFiles([...files]);
}

function getWorktreeFiles() {
  return [
    ...gitFiles(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
    ...gitFiles(["diff", "--name-only", "--diff-filter=ACMR", "--cached"]),
    ...gitFiles(["ls-files", "--others", "--exclude-standard"])
  ];
}

function getBranchFiles() {
  const upstream = spawn("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], {
    allowFailure: true,
    encoding: "utf8"
  });

  if (upstream.status === 0) {
    return gitFiles(["diff", "--name-only", "--diff-filter=ACMR", `${upstream.stdout.trim()}...HEAD`]);
  }

  const previousCommit = spawn("git", ["rev-parse", "--verify", "HEAD~1"], {
    allowFailure: true,
    encoding: "utf8"
  });

  if (previousCommit.status === 0) {
    return gitFiles(["diff", "--name-only", "--diff-filter=ACMR", "HEAD~1..HEAD"]);
  }

  return gitFiles(["ls-files"]);
}

function gitFiles(args) {
  const result = spawn("git", args, { encoding: "utf8" });
  return result.stdout.split("\n").map((file) => file.trim()).filter(Boolean);
}

function normalizeFiles(files) {
  return [...new Set(files)].filter((file) => existsSync(file)).sort();
}

function isDocumentationFile(file) {
  return file.endsWith(".md") || file.startsWith("docs/");
}

function isUnitTestFile(file) {
  return /^tests\/.+\.test\.(?:ts|mjs|js)$/.test(file);
}

function isPresentationRenderFile(file) {
  return file.startsWith("presentations/")
    || file.startsWith("slides/")
    || file.startsWith("studio/baseline/")
    || file === "scripts/build-deck.ts"
    || file === "scripts/validate-render.ts"
    || file === "scripts/update-render-baseline.ts";
}

function getRepoRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

function readStdin() {
  try {
    return process.stdin.isTTY ? "" : readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function run(command, args) {
  const result = spawn(command, args);

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function spawn(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: options.encoding,
    env: process.env,
    stdio: options.encoding ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (!options.allowFailure && (result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}
