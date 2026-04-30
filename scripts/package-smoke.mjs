import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

const packOutput = run("npm", ["pack", "--pack-destination", packDir, "--cache", path.join(workDir, "npm-cache")], {
  capture: true
});
const tarball = path.join(packDir, packOutput.split(/\r?\n/).filter(Boolean).pop());

run("npm", ["init", "-y"], { cwd: installDir });
run("npm", ["install", tarball, "--engine-strict=false", "--cache", path.join(workDir, "npm-cache")], { cwd: installDir });

const slideotter = path.join(installDir, "node_modules", ".bin", process.platform === "win32" ? "slideotter.cmd" : "slideotter");
run(slideotter, ["init", "--template", "tutorial", "--data-dir", dataDir], { cwd: installDir });
run(slideotter, ["build", "--data-dir", dataDir], { cwd: installDir });
run(slideotter, ["validate", "--fast", "--data-dir", dataDir], { cwd: installDir });

process.stdout.write(`Package smoke passed in ${workDir}\n`);
