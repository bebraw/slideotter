import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const DEFAULT_SCREENSHOT_URL = "http://127.0.0.1:4173/";
const DEFAULT_OUTPUT_PATH = "docs/assets/studio-home.png";
const DEFAULT_SERVER_COMMAND = "npm run studio:start";
const DEFAULT_SERVER_START_TIMEOUT_MS = 120_000;
const READY_POLL_INTERVAL_MS = 1_000;

const helpText = `
Capture the local studio screenshot used by the README.

Environment variables:
  SCREENSHOT_URL                  Optional. Target URL. Defaults to http://127.0.0.1:4173/
  SCREENSHOT_OUTPUT_PATH          Optional. Output path. Defaults to docs/assets/studio-home.png
  SCREENSHOT_SERVER_COMMAND       Optional. Server command to start when the URL is not already live. Defaults to "npm run studio:start".
  SCREENSHOT_SERVER_READY_URL     Optional. URL to poll for readiness. Defaults to SCREENSHOT_URL.
  SCREENSHOT_SERVER_START_TIMEOUT_MS
                                  Optional. Server start timeout in milliseconds. Defaults to 120000.

Examples:
  npm run screenshot:home
  SCREENSHOT_URL=http://127.0.0.1:4173/deck-preview npm run screenshot:home
`.trim();

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(helpText);
  process.exit(0);
}

const screenshotUrl = process.env.SCREENSHOT_URL || DEFAULT_SCREENSHOT_URL;
const readyUrl = process.env.SCREENSHOT_SERVER_READY_URL || screenshotUrl;
const outputPath = resolve(process.cwd(), process.env.SCREENSHOT_OUTPUT_PATH || DEFAULT_OUTPUT_PATH);
const serverCommand = process.env.SCREENSHOT_SERVER_COMMAND || DEFAULT_SERVER_COMMAND;
const serverStartTimeoutMs = readIntegerEnv(
  "SCREENSHOT_SERVER_START_TIMEOUT_MS",
  DEFAULT_SERVER_START_TIMEOUT_MS,
);

await main();

async function main() {
  await mkdir(dirname(outputPath), { recursive: true });

  let server = null;

  try {
    if (!(await isUrlReady(readyUrl))) {
      server = await startServer(serverCommand);
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({
        colorScheme: "light",
        viewport: { width: 1280, height: 720 },
      });

      await page.goto(screenshotUrl, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#active-preview .dom-slide-viewport, #active-preview img", {
        timeout: 30_000,
      });
      await page.screenshot({ path: outputPath });
    } finally {
      await browser.close();
    }

    console.log(`Wrote screenshot to ${outputPath}`);
  } finally {
    if (server) {
      await stopServer(server);
    }
  }
}

async function startServer(command: string): Promise<ChildProcess> {
  const server = spawn(command, {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: { ...process.env, CI: "1" },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`[screenshot-server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[screenshot-server] ${chunk}`));

  try {
    await waitForServerReady(server, readyUrl, serverStartTimeoutMs);
    return server;
  } catch (error) {
    terminateServer(server, "SIGTERM");
    throw error;
  }
}

async function isUrlReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
    });

    return response.status >= 100 && response.status < 600;
  } catch {
    return false;
  }
}

async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isUrlReady(url)) {
      return;
    }

    await delay(READY_POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for screenshot server at ${url}.`);
}

async function waitForServerReady(server: ChildProcess, url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isUrlReady(url)) {
      return;
    }

    if (server.exitCode !== null || server.signalCode !== null) {
      const reason = server.signalCode
        ? `signal ${server.signalCode}`
        : `exit code ${server.exitCode ?? "unknown"}`;
      throw new Error(`Screenshot server exited before ${url} became ready (${reason}).`);
    }

    await delay(READY_POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for screenshot server at ${url}.`);
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) {
    return;
  }

  terminateServer(server, "SIGTERM");

  await Promise.race([
    new Promise((resolvePromise) => server.once("exit", resolvePromise)),
    new Promise((resolvePromise) =>
      setTimeout(() => {
        if (server.exitCode === null) {
          terminateServer(server, "SIGKILL");
        }

        resolvePromise(undefined);
      }, 5_000),
    ),
  ]);
}

function terminateServer(server: ChildProcess, signal: NodeJS.Signals): void {
  if (process.platform !== "win32" && typeof server.pid === "number") {
    try {
      process.kill(-server.pid, signal);
      return;
    } catch {
      // Fall back to the direct child if the process group is already gone.
    }
  }

  server.kill(signal);
}

function readIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer when provided.`);
  }

  return parsed;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
