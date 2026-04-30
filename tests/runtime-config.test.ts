const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.join(__dirname, "..");

type RunNodeOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

function createTempDir(name: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `slideotter-${name}-`));
}

function runNode(args: string[], options: RunNodeOptions = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `node ${args.join(" ")} failed`);
  }

  return result;
}

test("slideotter init creates user data layout and optional tutorial copy", () => {
  const dataDir = createTempDir("home");
  const result = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "init",
    "--data-dir",
    dataDir,
    "--template",
    "tutorial"
  ]);

  assert.match(result.stdout, new RegExp(dataDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(fs.existsSync(path.join(dataDir, "config.json")), "init should write config.json");
  assert.ok(fs.existsSync(path.join(dataDir, "presentations", "slideotter", "presentation.json")), "tutorial template should be copied into user presentations");
  assert.ok(fs.existsSync(path.join(dataDir, "libraries", "layouts")), "layout library directory should exist");
  assert.ok(fs.existsSync(path.join(dataDir, "libraries", "themes")), "theme library directory should exist");
  assert.ok(fs.existsSync(path.join(dataDir, "state", "presentations.json")), "global registry should exist under user state");
  assert.ok(fs.existsSync(path.join(dataDir, "output")), "output directory should exist under user data");
});

test("slideotter init repairs an incomplete default demo presentation", () => {
  const dataDir = createTempDir("repair-demo");
  const partialPresentationDir = path.join(dataDir, "presentations", "slideotter");
  fs.mkdirSync(partialPresentationDir, { recursive: true });
  fs.writeFileSync(path.join(partialPresentationDir, "presentation.json"), JSON.stringify({
    id: "slideotter",
    title: "slideotter"
  }), "utf8");

  runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "init",
    "--data-dir",
    dataDir
  ]);

  const slideFiles = fs.readdirSync(path.join(partialPresentationDir, "slides"))
    .filter((fileName: string) => /^slide-\d+\.json$/.test(fileName));
  assert.ok(slideFiles.length > 0, "init should copy demo slide files when the default demo is incomplete");
  assert.ok(fs.existsSync(path.join(partialPresentationDir, "state", "deck-context.json")), "init should copy demo deck state when repairing");
});

test("SLIDEOTTER_HOME drives runtime paths, env loading, and write boundary", () => {
  const dataDir = createTempDir("paths");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, ".env"), "SLIDEOTTER_TEST_VALUE=from_env\n", "utf8");
  fs.writeFileSync(path.join(dataDir, ".env.local"), "SLIDEOTTER_TEST_VALUE=from_local\n", "utf8");

  const script = `
    const path = require("node:path");
    const { loadEnvFiles } = require("./studio/server/services/env.ts");
    const paths = require("./studio/server/services/paths.ts");
    const { assertAllowedWriteTarget, describeAllowedWriteTargets } = require("./studio/server/services/write-boundary.ts");
    loadEnvFiles();
    const appWrite = (() => {
      try {
        assertAllowedWriteTarget(path.join(paths.repoRoot, "studio", "client", "index.html"));
        return true;
      } catch (error) {
        return false;
      }
    })();
    const userWrite = assertAllowedWriteTarget(path.join(paths.presentationsDir, "example", "slides", "slide-01.json"));
    process.stdout.write(JSON.stringify({
      appWrite,
      envValue: process.env.SLIDEOTTER_TEST_VALUE,
      mode: paths.mode,
      outputDir: paths.outputDir,
      presentationsDir: paths.presentationsDir,
      stateDir: paths.stateDir,
      targets: describeAllowedWriteTargets(),
      userDataRoot: paths.userDataRoot,
      userWrite
    }));
  `;
  const result = runNode(["-e", script], {
    env: {
      SLIDEOTTER_HOME: dataDir
    }
  });
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.mode, "user");
  assert.equal(payload.userDataRoot, dataDir);
  assert.equal(payload.presentationsDir, path.join(dataDir, "presentations"));
  assert.equal(payload.stateDir, path.join(dataDir, "state"));
  assert.equal(payload.outputDir, path.join(dataDir, "output"));
  assert.equal(payload.envValue, "from_local");
  assert.equal(payload.appWrite, false, "user-data mode should not allow writes into installed app assets");
  assert.equal(payload.userWrite, path.join(dataDir, "presentations", "example", "slides", "slide-01.json"));
  assert.ok(payload.targets.some((target: string) => target.includes("~/.slideotter/output")), "write-boundary docs should describe user data output");
});

test("slideotter data-dir and paths print resolved user data paths", () => {
  const dataDir = createTempDir("print-paths");
  const dataDirResult = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "data-dir",
    "--data-dir",
    dataDir
  ]);
  assert.equal(dataDirResult.stdout.trim(), dataDir);

  const pathsResult = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "paths",
    "--data-dir",
    dataDir
  ]);
  const payload = JSON.parse(pathsResult.stdout);

  assert.equal(payload.mode, "user");
  assert.equal(payload.userDataRoot, dataDir);
  assert.equal(payload.presentationsDir, path.join(dataDir, "presentations"));
  assert.equal(payload.outputDir, path.join(dataDir, "output"));
  assert.equal(payload.archiveDir, path.join(dataDir, "archive"));
  assert.equal(payload.exists.userDataRoot, true, "test temp root exists before ensure");
  assert.equal(payload.exists.presentationsDir, false, "paths should not create data directories by default");

  const ensuredDataDir = createTempDir("print-paths-ensure");
  const ensuredResult = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "paths",
    "--data-dir",
    ensuredDataDir,
    "--ensure"
  ]);
  const ensuredPayload = JSON.parse(ensuredResult.stdout);

  assert.equal(ensuredPayload.userDataRoot, ensuredDataDir);
  assert.equal(ensuredPayload.exists.userDataRoot, true);
  assert.equal(ensuredPayload.exists.presentationsDir, true);
  assert.ok(fs.existsSync(path.join(ensuredDataDir, "config.json")), "--ensure should initialize the data root");
});

test("slideotter help explains basic commands", () => {
  const result = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "help"
  ]);

  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /slideotter init --template tutorial/);
  assert.match(result.stdout, /data-dir/);
  assert.match(result.stdout, /paths --ensure/);
  assert.match(result.stdout, /llm lmstudio --model/);

  const flagResult = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "--help"
  ]);
  assert.equal(flagResult.stdout, result.stdout);
});

test("slideotter llm lmstudio writes user data env config", () => {
  const dataDir = createTempDir("llm-lmstudio");
  const result = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "llm",
    "lmstudio",
    "--data-dir",
    dataDir,
    "--model",
    "qwen/qwen3.5-9b",
    "--base-url",
    "http://127.0.0.1:1234"
  ]);

  const envFile = path.join(dataDir, ".env.local");
  const envText = fs.readFileSync(envFile, "utf8");
  assert.match(result.stdout, new RegExp(envFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(envText, /^STUDIO_LLM_PROVIDER=lmstudio$/m);
  assert.match(envText, /^LMSTUDIO_MODEL=qwen\/qwen3\.5-9b$/m);
  assert.match(envText, /^LMSTUDIO_BASE_URL=http:\/\/127\.0\.0\.1:1234$/m);

  const status = runNode([
    path.join(repoRoot, "bin", "slideotter.mjs"),
    "llm",
    "status",
    "--data-dir",
    dataDir
  ]);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.provider, "lmstudio");
  assert.equal(payload.model, "qwen/qwen3.5-9b");
  assert.equal(payload.baseUrl, "http://127.0.0.1:1234/v1");
  assert.equal(payload.available, true);
});
