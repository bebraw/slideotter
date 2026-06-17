#!/usr/bin/env node
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readCommand(args) {
  return args[0] && !args[0].startsWith("-") ? args.shift() : "studio";
}

function parseFlagValue(args, index, inlineValue) {
  const nextValue = args[index + 1];
  if (inlineValue !== undefined) {
    return { nextIndex: index, value: inlineValue };
  }

  if (nextValue && !nextValue.startsWith("--")) {
    return { nextIndex: index + 1, value: nextValue };
  }

  return { nextIndex: index, value: true };
}

function parseFlagArg(args, index, flags) {
  const [rawKey, inlineValue] = args[index].slice(2).split("=", 2);
  const parsed = parseFlagValue(args, index, inlineValue);
  flags.set(rawKey, parsed.value);
  return parsed.nextIndex;
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    command: readCommand(args),
    flags: new Map()
  };

  for (let index = 0; index < args.length; index += 1) {
    index = args[index].startsWith("--")
      ? parseFlagArg(args, index, options.flags)
      : index;
  }

  return options;
}

function updateEnvLine(line, pending) {
  const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=).*$/);
  if (!match || !pending.has(match[2])) {
    return line;
  }

  const value = pending.get(match[2]);
  pending.delete(match[2]);
  return `${match[1]}${match[2]}${match[3]}${serializeEnvValue(value)}`;
}

function appendPendingEnvValues(nextLines, pending) {
  if (nextLines.length && nextLines[nextLines.length - 1] !== "") {
    nextLines.push("");
  }
  pending.forEach((value, key) => {
    nextLines.push(`${key}=${serializeEnvValue(value)}`);
  });
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
  tts voices          List bundled Piper voice download targets.
  tts install <id>    Download a Piper voice and use it for narration.
  tts default <id>    Select an installed Piper voice for narration.
  tts status          Print the resolved local narration status.
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
  --bin <path>        Piper executable path for tts install/default.
  --fast              Skip render validation for validate.
  --render            Include render validation for validate.

Examples:
  slideotter
  slideotter init --template tutorial
  slideotter paths --ensure
  slideotter llm lmstudio --model qwen/qwen3.5-9b
  slideotter tts install fi_FI-harri-medium --bin /opt/homebrew/bin/piper
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
  const nextLines = existing
    .map((line) => updateEnvLine(line, pending))
    .filter((line, index, lines) => line || index < lines.length - 1);

  if (pending.size) {
    appendPendingEnvValues(nextLines, pending);
  }

  mkdirSync(dirname(fileName), { recursive: true });
  writeFileSync(fileName, `${nextLines.join("\n").replace(/\n*$/u, "")}\n`, "utf8");
}

function firstSubcommand(argv, fallback = "") {
  return argv.find((arg) => !arg.startsWith("-")) || fallback;
}

function requireUserDataRoot() {
  const { initializeUserData } = require("../studio/server/services/runtime-config.ts");
  initializeUserData({
    userDataRoot: process.env.SLIDEOTTER_HOME
  });
}

function handleInit(flags) {
  const { initializeUserData } = require("../studio/server/services/runtime-config.ts");
  const config = initializeUserData({
    template: flags.get("template") || "",
    userDataRoot: process.env.SLIDEOTTER_HOME
  });
  process.stdout.write(`Initialized slideotter data at ${config.userDataRoot}\n`);
}

function printRuntimePaths(config) {
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
}

function handleRuntimePathCommand(command, flags) {
  const { getRuntimeConfig, initializeUserData } = require("../studio/server/services/runtime-config.ts");
  const config = flags.get("ensure")
    ? initializeUserData({ userDataRoot: process.env.SLIDEOTTER_HOME || process.env.SLIDEOTTER_DATA_DIR })
    : getRuntimeConfig();
  if (command === "data-dir") {
    process.stdout.write(`${config.userDataRoot}\n`);
    return;
  }

  printRuntimePaths(config);
}

function configureLmStudio(flags) {
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
}

function handleLlmCommand(argv, flags) {
  const subcommand = firstSubcommand(argv, "status");
  if (subcommand === "lmstudio") {
    configureLmStudio(flags);
    return;
  }

  if (subcommand === "status") {
    const { getLlmStatus } = require("../studio/server/services/llm/client.ts");
    process.stdout.write(`${JSON.stringify(getLlmStatus(), null, 2)}\n`);
    return;
  }

  process.stderr.write(`Unknown llm command: ${subcommand}\n`);
  process.exitCode = 1;
}

function createTtsContext() {
  const {
    getTtsStatus,
    installPiperVoice,
    listPiperVoices,
    setDefaultPiperVoice
  } = require("../studio/server/services/tts.ts");
  const { getRuntimeConfig } = require("../studio/server/services/runtime-config.ts");
  const config = getRuntimeConfig();
  return {
    envFile: resolve(config.userDataRoot, ".env.local"),
    getTtsStatus,
    installPiperVoice,
    listPiperVoices,
    setDefaultPiperVoice
  };
}

function printPiperVoices(listPiperVoices) {
  const voices = listPiperVoices();
  process.stdout.write(`Piper voice directory: ${voices.storeDir}\n`);
  process.stdout.write("Supported downloads:\n");
  voices.catalog.forEach((voice) => {
    const installed = voices.installed.some((candidate) => candidate.id === voice.id) ? " installed" : "";
    process.stdout.write(`  ${voice.id}  ${voice.label} (${voice.quality}, ${voice.language})${installed}\n`);
  });
}

function printTtsStatus(context) {
  process.stdout.write(`${JSON.stringify({
    piper: context.listPiperVoices(),
    tts: context.getTtsStatus()
  }, null, 2)}\n`);
}

function getRequiredVoiceId(argv, action, example) {
  const voiceId = firstSubcommand(argv);
  if (voiceId) {
    return voiceId;
  }

  process.stderr.write(`Set the Piper voice id to ${action}.\n`);
  process.stderr.write(`Example: ${example}\n`);
  process.exitCode = 1;
  return "";
}

function ttsEnvValues(flags, values) {
  return {
    ...(flags.get("bin") ? { SLIDEOTTER_PIPER_BIN: flags.get("bin") } : {}),
    ...values,
    SLIDEOTTER_TTS_PROVIDER: "piper"
  };
}

async function installPiperVoiceCommand(argv, flags, context) {
  const voiceId = getRequiredVoiceId(argv, "install", "slideotter tts install en_US-amy-medium");
  if (!voiceId) {
    return;
  }

  const installed = await context.installPiperVoice(voiceId);
  context.setDefaultPiperVoice(installed.id);
  upsertEnvFile(context.envFile, ttsEnvValues(flags, {
    SLIDEOTTER_PIPER_VOICE: installed.id
  }));
  process.stdout.write(`Installed Piper voice ${installed.id}\n`);
  process.stdout.write(`Model: ${installed.modelPath}\n`);
  process.stdout.write(`Configured narration in ${context.envFile}\n`);
}

function setDefaultPiperVoiceCommand(argv, flags, context) {
  const voiceId = getRequiredVoiceId(argv, "use", "slideotter tts default en_US-amy-medium");
  if (!voiceId) {
    return;
  }

  const selected = context.setDefaultPiperVoice(voiceId);
  upsertEnvFile(context.envFile, ttsEnvValues(flags, {
    SLIDEOTTER_PIPER_VOICE: selected.id
  }));
  process.stdout.write(`Using Piper voice ${selected.id}\n`);
  process.stdout.write(`Configured narration in ${context.envFile}\n`);
}

function configurePiperCommand(flags, context) {
  upsertEnvFile(context.envFile, ttsEnvValues(flags, {
    ...(flags.get("model") ? { SLIDEOTTER_PIPER_MODEL: flags.get("model") } : {}),
    ...(flags.get("voice") ? { SLIDEOTTER_PIPER_VOICE: flags.get("voice") } : {})
  }));
  process.stdout.write(`Configured Piper narration in ${context.envFile}\n`);
}

async function handleTtsCommand(argv, flags) {
  const subcommand = firstSubcommand(argv, "status");
  const context = createTtsContext();
  const handlers = {
    configure: () => configurePiperCommand(flags, context),
    default: () => setDefaultPiperVoiceCommand(argv.slice(1), flags, context),
    install: () => installPiperVoiceCommand(argv.slice(1), flags, context),
    list: () => printPiperVoices(context.listPiperVoices),
    status: () => printTtsStatus(context),
    voices: () => printPiperVoices(context.listPiperVoices)
  };
  const handler = handlers[subcommand] || (() => {
    process.stderr.write(`Unknown tts command: ${subcommand}\n`);
    process.exitCode = 1;
  });
  await handler();
}

function openStudioIfRequested(flags, host, port) {
  if (flags.get("open")) {
    openBrowser(`http://${host}:${port}`);
  }
}

function resolveFlagEnvValue(flags, flagName, envName, fallback) {
  return flags.get(flagName) || process.env[envName] || fallback;
}

function handleStudioCommand(flags) {
  const { startServer } = require("../studio/server/index.ts");
  const host = resolveFlagEnvValue(flags, "host", "HOST", "127.0.0.1");
  const port = resolveFlagEnvValue(flags, "port", "PORT", 4173);
  startServer({ host, port });
  openStudioIfRequested(flags, host, port);
}

async function handleBuildCommand() {
  const { buildDeck } = require("../studio/server/services/build.ts");
  const result = await buildDeck();
  process.stdout.write(`${result.pdfFile}\n`);
}

async function handleExportCommand(argv) {
  const subcommand = firstSubcommand(argv);
  if (subcommand === "pptx") {
    const { exportDeckPptx } = require("../studio/server/services/build.ts");
    const result = await exportDeckPptx();
    process.stdout.write(`${result.pptxFile}\n`);
    return;
  }

  process.stderr.write("Unknown export command. Use: slideotter export pptx\n");
  process.exitCode = 1;
}

async function handleValidateCommand(flags) {
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
}

function handleArchiveCommand() {
  const { getOutputConfig } = require("../studio/server/services/output-config.ts");
  const { copyAllowedFile } = require("../studio/server/services/write-boundary.ts");
  const { archiveFile, pdfFile } = getOutputConfig();
  copyAllowedFile(pdfFile, archiveFile);
  process.stdout.write(`${archiveFile}\n`);
}

async function dispatchCommand(command, argv, flags) {
  const handlers = {
    archive: () => handleArchiveCommand(),
    build: () => handleBuildCommand(),
    export: () => handleExportCommand(argv),
    llm: () => handleLlmCommand(argv, flags),
    studio: () => handleStudioCommand(flags),
    tts: () => handleTtsCommand(argv, flags),
    validate: () => handleValidateCommand(flags)
  };
  const handler = handlers[command];
  if (handler) {
    await handler();
    return;
  }

  process.stderr.write(`Unknown slideotter command: ${command}\n`);
  process.exitCode = 1;
}

function handleHelpCommand(command, flags) {
  if (command !== "help" && !flags.get("help")) {
    return false;
  }

  printHelp();
  return true;
}

function handleInitialCommand(command, flags) {
  if (command === "init") {
    handleInit(flags);
    return true;
  }

  return false;
}

function handleRuntimeRootCommand(command, flags) {
  if (command !== "data-dir" && command !== "paths") {
    return false;
  }

  handleRuntimePathCommand(command, flags);
  return true;
}

async function main() {
  const argv = process.argv.slice(2);
  const { command, flags } = parseArgs(argv);
  configureDataRoot(flags);

  if (handleHelpCommand(command, flags) || handleInitialCommand(command, flags)) {
    return;
  }

  ensureDefaultDataRoot();
  if (handleRuntimeRootCommand(command, flags)) {
    return;
  }

  requireUserDataRoot();
  await dispatchCommand(command, argv.slice(1), flags);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
