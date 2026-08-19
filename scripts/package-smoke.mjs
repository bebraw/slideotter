import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = path.resolve(import.meta.dirname, "..");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "slideotter-package-smoke-"));
const packDir = path.join(workDir, "pack");
const installDir = path.join(workDir, "install");
const dataDir = path.join(workDir, "data");

function run(command, args, options = {}) {
  process.stdout.write(`$ ${[command, ...args].join(" ")}\n`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    encoding: "utf8",
    env: {
      ...process.env,
      ...options.env
    },
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout || "");
      process.stderr.write(result.stderr || "");
    }
    throw new Error(`${command} ${args.join(" ")} failed`);
  }

  return options.capture ? result.stdout.trim() : "";
}

fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(installDir, { recursive: true });

if (process.version !== "v24.15.0") {
  throw new Error(`Package smoke requires Node v24.15.0, received ${process.version}`);
}

const npmVersion = run("npm", ["--version"], { capture: true });
if (npmVersion !== "11.12.1") {
  throw new Error(`Package smoke requires npm 11.12.1, received ${npmVersion}`);
}

run("npm", ["run", "package:build"]);
const packOutput = run("npm", [
  "pack",
  "--ignore-scripts",
  "--pack-destination",
  packDir,
  "--cache",
  path.join(workDir, "npm-cache")
], {
  capture: true
});
const tarball = path.join(packDir, packOutput.split(/\r?\n/).filter(Boolean).pop());

run("npm", ["init", "-y"], { cwd: installDir });
run("npm", ["install", tarball, "--engine-strict=true", "--cache", path.join(workDir, "npm-cache")], { cwd: installDir });

const rootLock = JSON.parse(fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf8"));
const installLock = JSON.parse(fs.readFileSync(path.join(installDir, "package-lock.json"), "utf8"));
const expectedPaperImport = rootLock.packages?.["node_modules/@kirjolab/paper-import"];
const installedPaperImport = installLock.packages?.["node_modules/@kirjolab/paper-import"];
for (const field of ["integrity", "resolved", "version"]) {
  if (!expectedPaperImport || !installedPaperImport || installedPaperImport[field] !== expectedPaperImport[field]) {
    throw new Error(`Packaged paper-import dependency changed ${field}`);
  }
}

const installedPackageRoot = path.join(installDir, "node_modules", "slideotter");
for (const setupFile of [".env.example", "DEVELOPMENT.md"]) {
  if (!fs.existsSync(path.join(installedPackageRoot, setupFile))) {
    throw new Error(`Packaged Codex gateway setup file is missing: ${setupFile}`);
  }
}

const slideotter = path.join(installDir, "node_modules", ".bin", process.platform === "win32" ? "slideotter.cmd" : "slideotter");
const gatewayHelp = run(slideotter, ["codex-gateway", "--help"], {
  capture: true,
  cwd: installDir
});
if (!gatewayHelp.includes("CODEX_GATEWAY_TOKEN")) {
  throw new Error("Packaged Codex gateway help did not load");
}
const codexSdkProbe = run(process.execPath, [
  "--input-type=module",
  "--eval",
  "import('@openai/codex-sdk').then(({ Codex }) => { new Codex(); process.stdout.write('codex-sdk-ok') })"
], {
  capture: true,
  cwd: installDir
});
if (codexSdkProbe !== "codex-sdk-ok") {
  throw new Error("Packaged Codex SDK could not resolve its native executable");
}
const paperImportAdapterUrl = pathToFileURL(path.join(
  installedPackageRoot,
  "dist",
  "studio",
  "server",
  "services",
  "paper-import",
  "index.js"
)).href;
const paperImportProbe = run(process.execPath, [
  "--input-type=module",
  "--eval",
  `import(${JSON.stringify(paperImportAdapterUrl)}).then(({ kirjolabPaperImportRelease, localPaperImportAdapter }) => process.stdout.write(kirjolabPaperImportRelease.packageVersion + ':' + kirjolabPaperImportRelease.converterVersion + ':' + typeof localPaperImportAdapter.inspectLatex))`
], {
  capture: true,
  cwd: installDir
});
if (paperImportProbe !== "0.1.3:latex-converter-v6:function") {
  throw new Error(`Packaged paper-import contract was unexpected: ${paperImportProbe}`);
}
const codex = path.join(installDir, "node_modules", ".bin", process.platform === "win32" ? "codex.cmd" : "codex");
const codexVersion = run(codex, ["--version"], {
  capture: true,
  cwd: installDir
});
if (!/^codex-cli \d+\.\d+\.\d+$/.test(codexVersion)) {
  throw new Error(`Packaged Codex native executable returned an unexpected version: ${codexVersion}`);
}
run(slideotter, ["init", "--template", "tutorial", "--data-dir", dataDir], { cwd: installDir });
run(slideotter, ["build", "--data-dir", dataDir], { cwd: installDir });
run(slideotter, ["validate", "--fast", "--data-dir", dataDir], { cwd: installDir });

process.stdout.write(`Package smoke passed in ${workDir}\n`);
