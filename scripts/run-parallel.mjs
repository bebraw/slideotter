import { spawn } from "node:child_process";

const scripts = process.argv.slice(2);

if (!scripts.length) {
  process.stderr.write("Usage: node scripts/run-parallel.mjs <npm-script> [...npm-script]\n");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn(npmCommand, ["run", script], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      resolve({
        error,
        script,
        stderr,
        stdout,
        status: 1
      });
    });

    child.on("close", (status, signal) => {
      resolve({
        script,
        signal,
        stderr,
        stdout,
        status: status ?? 1
      });
    });
  });
}

const startedAt = Date.now();
process.stdout.write(`Running ${scripts.length} scripts in parallel: ${scripts.join(", ")}\n`);

const results = await Promise.all(scripts.map(runScript));

for (const result of results) {
  process.stdout.write(`\n--- ${result.script} ${result.status === 0 ? "passed" : "failed"} ---\n`);
  if (result.stdout) {
    process.stdout.write(result.stdout);
    if (!result.stdout.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
    if (!result.stderr.endsWith("\n")) {
      process.stderr.write("\n");
    }
  }
  if (result.error) {
    process.stderr.write(`${result.error.stack || result.error}\n`);
  }
  if (result.signal) {
    process.stderr.write(`${result.script} terminated by signal ${result.signal}\n`);
  }
}

const failed = results.filter((result) => result.status !== 0 || result.signal);
const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

if (failed.length) {
  process.stderr.write(`Parallel scripts failed after ${elapsedSeconds}s: ${failed.map((result) => result.script).join(", ")}\n`);
  process.exit(1);
}

process.stdout.write(`Parallel scripts passed in ${elapsedSeconds}s.\n`);
