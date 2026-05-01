const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const cloudDir = path.join(repoRoot, "cloud");
const wranglerConfigFile = path.join(cloudDir, "wrangler.toml");
const workerFile = path.join(cloudDir, "worker.ts");

function readText(fileName: string): string {
  return fs.readFileSync(fileName, "utf8");
}

function assertIncludes(source: string, expected: string, label: string): void {
  if (!source.includes(expected)) {
    throw new Error(`${label} must include ${expected}`);
  }
}

function validateWranglerConfig(): void {
  const source = readText(wranglerConfigFile);

  assertIncludes(source, "main = \"./worker.ts\"", "cloud wrangler config");
  assertIncludes(source, "directory = \"../studio/client-dist\"", "cloud wrangler config");
  assertIncludes(source, "not_found_handling = \"single-page-application\"", "cloud wrangler config");
  assertIncludes(source, "run_worker_first = [\"/api/*\"]", "cloud wrangler config");

  if (source.includes("pages_build_output_dir") || source.includes("bucket =")) {
    throw new Error("cloud wrangler config must use Workers Static Assets rather than Pages or Workers Sites settings");
  }
}

function validateWorkerShell(): void {
  const source = readText(workerFile);

  assertIncludes(source, "/api/cloud/health", "cloud worker");
  assertIncludes(source, "env.ASSETS.fetch(request)", "cloud worker");
  assertIncludes(source, "deployment: \"cloudflare-workers\"", "cloud worker");
}

function main(): void {
  validateWranglerConfig();
  validateWorkerShell();
  process.stdout.write("Cloud hosting validation passed.\n");
}

main();
