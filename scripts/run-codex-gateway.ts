import { Codex, type ModelReasoningEffort } from "@openai/codex-sdk";
import { lstat, readdir } from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import {
  createCodexSdkProcessOptions,
  createCodexSdkRunner,
  startCodexGateway
} from "../studio/server/services/llm/codex-gateway.ts";
import { loadEnvFiles } from "../studio/server/services/env.ts";

const defaultPort = 4174;
const defaultReasoningEffort: ModelReasoningEffort = "medium";
const defaultRequestTimeoutMs = 300_000;
const defaultMaxConcurrentRequests = 1;
const minimumTokenLength = 24;
const maximumTokenLength = 512;
const maximumRequestTimeoutMs = 900_000;
const maximumConcurrentRequests = 32;

type GatewayEnvironment = Readonly<Record<string, string | undefined>>;

type GatewayCliHelp = {
  help: true;
};

type GatewayCliRuntimeConfig = {
  bearerToken: string;
  codexHome: string;
  help: false;
  maxConcurrentRequests: number;
  model: string;
  port: number;
  reasoningEffort: ModelReasoningEffort;
  requestTimeoutMs: number;
};

type GatewayCliConfig = GatewayCliHelp | GatewayCliRuntimeConfig;

const usage = `Usage:
  slideotter codex-gateway [options]
  npm run codex:gateway -- [options]  (from a source checkout)

Run a loopback-only OpenAI-compatible gateway backed by the local Codex login.

Options:
  --data-dir <path>             Slideotter env root (packaged command only)
  --port <port>                 Listening port (default: 4174)
  --model <model>               Codex model to expose
  --reasoning-effort <effort>   minimal, low, medium, high, or xhigh (default: medium)
  --timeout-ms <milliseconds>   Per-request timeout (default: 300000)
  --max-concurrency <count>     Concurrent request limit (default: 1)
  -h, --help                    Show this help

Environment:
  CODEX_GATEWAY_TOKEN            Required bearer token; 24-512 printable characters
  CODEX_GATEWAY_MODEL            Required unless --model is provided
  CODEX_GATEWAY_CODEX_HOME       Required dedicated Codex home with file-backed auth.json
  CODEX_GATEWAY_PORT             Optional alternative to --port
  CODEX_GATEWAY_REASONING_EFFORT Optional alternative to --reasoning-effort
  CODEX_GATEWAY_TIMEOUT_MS       Optional alternative to --timeout-ms
  CODEX_GATEWAY_MAX_CONCURRENCY  Optional alternative to --max-concurrency

The gateway always binds to 127.0.0.1. The bearer token is intentionally accepted
only through the environment so it is not exposed in the process argument list.
The dedicated Codex home must not contain .agents, config, plugins, custom skills, rules, or hooks.
`;

const forbiddenCodexHomeEntries = [
  ".agents",
  "AGENTS.override.md",
  "AGENTS.md",
  "config.toml",
  "hooks",
  "plugins",
  "requirements.toml",
  "rules"
] as const;

function parseInteger(
  rawValue: string,
  label: string,
  minimum: number,
  maximum: number
): number {
  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }

  return value;
}

function parseModel(rawValue: string | undefined): string {
  const model = rawValue?.trim() || "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model)) {
    throw new Error(
      "CODEX_GATEWAY_MODEL or --model must be a 1-128 character model identifier."
    );
  }
  return model;
}

function parseBearerToken(rawValue: string | undefined): string {
  const token = rawValue || "";
  if (
    token.length < minimumTokenLength ||
    token.length > maximumTokenLength ||
    !/^[\x21-\x7e]+$/.test(token)
  ) {
    throw new Error(
      `CODEX_GATEWAY_TOKEN must be ${minimumTokenLength}-${maximumTokenLength} printable ASCII characters without spaces.`
    );
  }
  return token;
}

function parseCodexHome(
  rawValue: string | undefined,
  environment: GatewayEnvironment
): string {
  const rawPath = rawValue?.trim() || "";
  if (!rawPath) {
    throw new Error(
      "Set CODEX_GATEWAY_CODEX_HOME to a dedicated Codex home authenticated separately for the gateway."
    );
  }

  if (rawPath === "~" || rawPath.startsWith("~/")) {
    const userHome = environment.HOME || environment.USERPROFILE || "";
    if (!userHome) {
      throw new Error("CODEX_GATEWAY_CODEX_HOME uses ~ but HOME or USERPROFILE is unavailable.");
    }
    return path.resolve(userHome, rawPath === "~" ? "." : rawPath.slice(2));
  }

  if (!path.isAbsolute(rawPath)) {
    throw new Error("CODEX_GATEWAY_CODEX_HOME must be an absolute path or start with ~/.");
  }

  return path.resolve(rawPath);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === code
  );
}

async function validateCodexGatewayHome(codexHome: string): Promise<void> {
  let homeStats: Awaited<ReturnType<typeof lstat>>;
  try {
    homeStats = await lstat(codexHome);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      throw new Error(
        `Dedicated Codex home does not exist: ${codexHome}. Create it, then run Codex login with CODEX_HOME set to that path and cli_auth_credentials_store set to file.`
      );
    }
    throw error;
  }

  if (!homeStats.isDirectory()) {
    throw new Error(`CODEX_GATEWAY_CODEX_HOME is not a directory: ${codexHome}`);
  }

  const authFile = path.join(codexHome, "auth.json");
  let authStats: Awaited<ReturnType<typeof lstat>>;
  try {
    authStats = await lstat(authFile);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      throw new Error(
        `Dedicated Codex home does not contain auth.json: ${codexHome}. Run Codex login with CODEX_HOME set to that path and cli_auth_credentials_store set to file.`
      );
    }
    throw error;
  }

  if (!authStats.isFile()) {
    throw new Error(`Dedicated Codex authentication must be a regular auth.json file: ${authFile}`);
  }

  const forbiddenEntries: string[] = [];
  for (const entry of forbiddenCodexHomeEntries) {
    try {
      await lstat(path.join(codexHome, entry));
      forbiddenEntries.push(entry);
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) {
        throw error;
      }
    }
  }

  const skillsPath = path.join(codexHome, "skills");
  try {
    const skillsStats = await lstat(skillsPath);
    if (!skillsStats.isDirectory()) {
      forbiddenEntries.push("skills");
    } else {
      const skillEntries = await readdir(skillsPath);
      for (const entry of skillEntries) {
        if (entry !== ".system") {
          forbiddenEntries.push(`skills/${entry}`);
        }
      }

      if (skillEntries.includes(".system")) {
        const systemSkillsStats = await lstat(path.join(skillsPath, ".system"));
        if (!systemSkillsStats.isDirectory()) {
          forbiddenEntries.push("skills/.system");
        }
      }
    }
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  if (forbiddenEntries.length > 0) {
    throw new Error(
      `Dedicated Codex home contains disallowed agent configuration: ${forbiddenEntries.join(", ")}. Use a separate home containing only Codex authentication and runtime state.`
    );
  }
}

function parseReasoningEffort(rawValue: string): ModelReasoningEffort {
  switch (rawValue) {
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return rawValue;
    default:
      throw new Error(
        "CODEX_GATEWAY_REASONING_EFFORT or --reasoning-effort must be minimal, low, medium, high, or xhigh."
      );
  }
}

function parseGatewayCliConfig(
  args: readonly string[],
  environment: GatewayEnvironment
): GatewayCliConfig {
  const { values } = parseArgs({
    allowPositionals: false,
    args: [...args],
    options: {
      help: {
        short: "h",
        type: "boolean"
      },
      "max-concurrency": {
        type: "string"
      },
      model: {
        type: "string"
      },
      port: {
        type: "string"
      },
      "reasoning-effort": {
        type: "string"
      },
      "timeout-ms": {
        type: "string"
      }
    },
    strict: true
  });

  if (values.help) {
    return { help: true };
  }

  const port = parseInteger(
    values.port ?? environment.CODEX_GATEWAY_PORT ?? String(defaultPort),
    "CODEX_GATEWAY_PORT or --port",
    0,
    65_535
  );
  const requestTimeoutMs = parseInteger(
    values["timeout-ms"] ??
      environment.CODEX_GATEWAY_TIMEOUT_MS ??
      String(defaultRequestTimeoutMs),
    "CODEX_GATEWAY_TIMEOUT_MS or --timeout-ms",
    1,
    maximumRequestTimeoutMs
  );
  const maxConcurrentRequests = parseInteger(
    values["max-concurrency"] ??
      environment.CODEX_GATEWAY_MAX_CONCURRENCY ??
      String(defaultMaxConcurrentRequests),
    "CODEX_GATEWAY_MAX_CONCURRENCY or --max-concurrency",
    1,
    maximumConcurrentRequests
  );

  return {
    bearerToken: parseBearerToken(environment.CODEX_GATEWAY_TOKEN),
    codexHome: parseCodexHome(environment.CODEX_GATEWAY_CODEX_HOME, environment),
    help: false,
    maxConcurrentRequests,
    model: parseModel(values.model ?? environment.CODEX_GATEWAY_MODEL),
    port,
    reasoningEffort: parseReasoningEffort(
      values["reasoning-effort"] ??
        environment.CODEX_GATEWAY_REASONING_EFFORT ??
        defaultReasoningEffort
    ),
    requestTimeoutMs
  };
}

function formatStartupMessage(
  url: string,
  model: string,
  reasoningEffort: ModelReasoningEffort
): string {
  return `Codex gateway listening at ${url} (model=${model}, reasoning=${reasoningEffort}, token=<redacted>)\n`;
}

function createCodexProcessEnvironment(
  environment: GatewayEnvironment,
  codexHome: string
): Record<string, string> {
  return createCodexSdkProcessOptions(codexHome, { ...environment }).env;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runCodexGatewayCli(
  args: readonly string[] = process.argv.slice(2),
  environment?: GatewayEnvironment
): Promise<void> {
  if (environment === undefined) {
    if (args.includes("--help") || args.includes("-h")) {
      const helpConfig = parseGatewayCliConfig(args, {});
      if (helpConfig.help) {
        process.stdout.write(usage);
        return;
      }
    }
    loadEnvFiles();
  }
  const resolvedEnvironment = environment ?? process.env;
  const config = parseGatewayCliConfig(args, resolvedEnvironment);
  if (config.help) {
    process.stdout.write(usage);
    return;
  }

  await validateCodexGatewayHome(config.codexHome);
  const sdkProcessOptions = createCodexSdkProcessOptions(
    config.codexHome,
    { ...resolvedEnvironment }
  );
  const codex = new Codex({
    ...sdkProcessOptions,
    config: {
      ...sdkProcessOptions.config,
      model_reasoning_effort: config.reasoningEffort
    }
  });
  const gateway = await startCodexGateway({
    bearerToken: config.bearerToken,
    host: "127.0.0.1",
    maxConcurrentRequests: config.maxConcurrentRequests,
    model: config.model,
    modelReasoningEffort: config.reasoningEffort,
    port: config.port,
    requestTimeoutMs: config.requestTimeoutMs,
    runner: createCodexSdkRunner(codex)
  });

  process.stdout.write(
    formatStartupMessage(gateway.address.url, config.model, config.reasoningEffort)
  );

  let shutdownStarted = false;
  const shutdown = async (exitCode: number): Promise<void> => {
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;
    process.exitCode = exitCode;

    try {
      await gateway.close();
    } catch (error) {
      process.stderr.write(`Failed to close Codex gateway: ${errorMessage(error)}\n`);
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => {
    void shutdown(130);
  });
  process.once("SIGTERM", () => {
    void shutdown(143);
  });
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  runCodexGatewayCli().catch((error: unknown) => {
    process.stderr.write(`Unable to start Codex gateway: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  createCodexProcessEnvironment,
  formatStartupMessage,
  parseGatewayCliConfig,
  runCodexGatewayCli,
  usage,
  validateCodexGatewayHome
};
export type {
  GatewayCliConfig,
  GatewayCliRuntimeConfig,
  GatewayEnvironment
};
