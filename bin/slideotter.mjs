#!/usr/bin/env node
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0] && !args[0].startsWith("-") ? args.shift() : "studio";
  const options = {
    command,
    flags: new Map()
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    if (inlineValue !== undefined) {
      options.flags.set(rawKey, inlineValue);
      continue;
    }

    if (nextValue && !nextValue.startsWith("--")) {
      options.flags.set(rawKey, nextValue);
      index += 1;
      continue;
    }

    options.flags.set(rawKey, true);
  }

  return options;
}

function configureDataRoot(flags) {
  const dataDir = flags.get("data-dir") || process.env.SLIDEOTTER_HOME || process.env.SLIDEOTTER_DATA_DIR;
  if (dataDir) {
    process.env.SLIDEOTTER_HOME = resolve(String(dataDir));
  }
}

function ensureDefaultDataRoot() {
  if (!process.env.SLIDEOTTER_HOME && !process.env.SLIDEOTTER_DATA_DIR) {
    process.env.SLIDEOTTER_HOME = resolve(process.env.HOME || appRoot, ".slideotter");
  }
}

function openBrowser(url) {
  const opener = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(opener, args, {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

function printHelp() {
  process.stdout.write(`slideotter

Usage:
  slideotter [command] [options]

Commands:
  studio              Start the local browser studio. This is the default.
  init                Create or repair the user data directory.
  data-dir            Print the resolved user data directory.
  paths               Print resolved runtime paths and whether they exist.
  build               Build the active presentation PDF.
  export pptx         Export the active presentation as a PowerPoint file.
  validate            Build and validate the active presentation.
  archive             Copy the active output PDF into the archive directory.
  llm lmstudio        Configure LM Studio in the user data env file.
  llm status          Print the resolved LLM provider status.
  help                Show this help.

Options:
  --data-dir <path>   Use a custom user data directory.
  --host <host>       Studio host, default 127.0.0.1.
  --port <port>       Studio port, default 4173.
  --open              Open the studio URL in a browser.
  --template tutorial Seed the bundled tutorial during init.
  --ensure            Create data directories for data-dir or paths.
  --model <id>        Model id for llm lmstudio.
  --base-url <url>    LM Studio base URL, default http://127.0.0.1:1234.
  --fast              Skip render validation for validate.
  --render            Include render validation for validate.

Examples:
  slideotter
  slideotter init --template tutorial
  slideotter paths --ensure
  slideotter llm lmstudio --model qwen/qwen3.5-9b
  slideotter studio --port 4174 --open
  slideotter build
  slideotter export pptx
`);
}

function serializeEnvValue(value) {
  const text = String(value || "");
  if (/^[A-Za-z0-9_./:@-]+$/.test(text)) {
    return text;
  }

  return JSON.stringify(text);
}

function upsertEnvFile(fileName, values) {
  const existing = existsSync(fileName)
    ? readFileSync(fileName, "utf8").split(/\r?\n/)
    : [];
  const pending = new Map(Object.entries(values));
  const nextLines = existing.map((line) => {
    const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=).*$/);
    if (!match || !pending.has(match[2])) {
      return line;
    }

    const value = pending.get(match[2]);
    pending.delete(match[2]);
    return `${match[1]}${match[2]}${match[3]}${serializeEnvValue(value)}`;
  }).filter((line, index, lines) => line || index < lines.length - 1);

  if (pending.size) {
    if (nextLines.length && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    pending.forEach((value, key) => {
      nextLines.push(`${key}=${serializeEnvValue(value)}`);
    });
  }

  mkdirSync(dirname(fileName), { recursive: true });
  writeFileSync(fileName, `${nextLines.join("\n").replace(/\n*$/u, "")}\n`, "utf8");
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  configureDataRoot(flags);

  if (command === "help" || flags.get("help")) {
    printHelp();
    return;
  }

  if (command === "init") {
    const { initializeUserData } = require("../studio/server/services/runtime-config.ts");
    const config = initializeUserData({
      template: flags.get("template") || "",
      userDataRoot: process.env.SLIDEOTTER_HOME
    });
    process.stdout.write(`Initialized slideotter data at ${config.userDataRoot}\n`);
    return;
  }

  ensureDefaultDataRoot();

  if (command === "data-dir" || command === "paths") {
    const { getRuntimeConfig, initializeUserData } = require("../studio/server/services/runtime-config.ts");
    const config = flags.get("ensure")
      ? initializeUserData({ userDataRoot: process.env.SLIDEOTTER_HOME || process.env.SLIDEOTTER_DATA_DIR })
      : getRuntimeConfig();
    if (command === "data-dir") {
      process.stdout.write(`${config.userDataRoot}\n`);
      return;
    }

    process.stdout.write(`${JSON.stringify({
      archiveDir: config.archiveDir,
      baselineRootDir: config.baselineRootDir,
      exists: {
        archiveDir: existsSync(config.archiveDir),
        baselineRootDir: existsSync(config.baselineRootDir),
        librariesDir: existsSync(config.librariesDir),
        outputDir: existsSync(config.outputDir),
        presentationsDir: existsSync(config.presentationsDir),
        stateDir: existsSync(config.stateDir),
        userDataRoot: existsSync(config.userDataRoot)
      },
      librariesDir: config.librariesDir,
      mode: config.mode,
      outputDir: config.outputDir,
      presentationsDir: config.presentationsDir,
      stateDir: config.stateDir,
      userDataRoot: config.userDataRoot
    }, null, 2)}\n`);
    return;
  }

  const { initializeUserData } = require("../studio/server/services/runtime-config.ts");
  initializeUserData({
    userDataRoot: process.env.SLIDEOTTER_HOME
  });

  if (command === "llm") {
    const subcommand = process.argv.slice(3).find((arg) => !arg.startsWith("-")) || "status";
    if (subcommand === "lmstudio") {
      const model = flags.get("model");
      if (!model) {
        process.stderr.write("Set the LM Studio model id with --model <id>.\n");
        process.stderr.write("Example: slideotter llm lmstudio --model qwen/qwen3.5-9b\n");
        process.exitCode = 1;
        return;
      }

      const { getRuntimeConfig } = require("../studio/server/services/runtime-config.ts");
      const config = getRuntimeConfig();
      const envFile = resolve(config.userDataRoot, ".env.local");
      upsertEnvFile(envFile, {
        LMSTUDIO_BASE_URL: flags.get("base-url") || "http://127.0.0.1:1234",
        LMSTUDIO_MODEL: model,
        STUDIO_LLM_PROVIDER: "lmstudio"
      });
      process.stdout.write(`Configured LM Studio in ${envFile}\n`);
      process.stdout.write(`Model: ${model}\n`);
      return;
    }

    if (subcommand === "status") {
      const { getLlmStatus } = require("../studio/server/services/llm/client.ts");
      process.stdout.write(`${JSON.stringify(getLlmStatus(), null, 2)}\n`);
      return;
    }

    process.stderr.write(`Unknown llm command: ${subcommand}\n`);
    process.exitCode = 1;
    return;
  }

  if (command === "studio") {
    const { startServer } = require("../studio/server/index.ts");
    const host = flags.get("host") || process.env.HOST || "127.0.0.1";
    const port = flags.get("port") || process.env.PORT || 4173;
    startServer({ host, port });
    if (flags.get("open")) {
      openBrowser(`http://${host}:${port}`);
    }
    return;
  }

  if (command === "build") {
    const { buildDeck } = require("../studio/server/services/build.ts");
    const result = await buildDeck();
    process.stdout.write(`${result.pdfFile}\n`);
    return;
  }

  if (command === "export") {
    const subcommand = process.argv.slice(3).find((arg) => !arg.startsWith("-")) || "";
    if (subcommand === "pptx") {
      const { exportDeckPptx } = require("../studio/server/services/build.ts");
      const result = await exportDeckPptx();
      process.stdout.write(`${result.pptxFile}\n`);
      return;
    }

    process.stderr.write("Unknown export command. Use: slideotter export pptx\n");
    process.exitCode = 1;
    return;
  }

  if (command === "validate") {
    const { validateDeck } = require("../studio/server/services/validate.ts");
    const result = await validateDeck({
      includeRender: flags.get("render") === true && flags.get("fast") !== true
    });
    process.stdout.write(`${JSON.stringify({
      geometry: result.geometry.ok,
      ok: result.ok,
      render: result.render.ok,
      text: result.text.ok
    }, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "archive") {
    const { getOutputConfig } = require("../studio/server/services/output-config.ts");
    const { copyAllowedFile } = require("../studio/server/services/write-boundary.ts");
    const { archiveFile, pdfFile } = getOutputConfig();
    copyAllowedFile(pdfFile, archiveFile);
    process.stdout.write(`${archiveFile}\n`);
    return;
  }

  process.stderr.write(`Unknown slideotter command: ${command}\n`);
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
