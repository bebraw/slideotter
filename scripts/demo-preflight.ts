import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type JsonRecord = Record<string, unknown>;

type DemoPreflightLevel = "fail" | "pass" | "warn";

type DemoPreflightCheck = {
  detail?: string;
  label: string;
  level: DemoPreflightLevel;
};

type DemoPreflightOptions = {
  checkLmStudio?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  lmStudioBaseUrl?: string;
};

type DemoPreflightReport = {
  checks: DemoPreflightCheck[];
  ok: boolean;
};

type LmStudioModelsResponse = JsonRecord & {
  data?: Array<JsonRecord & {
    id?: unknown;
  }>;
};

const requiredScripts = [
  "studio:dev",
  "quality:gate:fast",
  "quality:gate",
  "validate:presentation-workflow",
  "demo:rehearse",
  "fuzz:lmstudio",
  "fuzz:lmstudio:browser"
] as const;

const recommendedArtifacts = [
  {
    label: "current Slideotter PDF",
    minBytes: 50_000,
    relativePath: "slides/output/slideotter.pdf"
  },
  {
    label: "archived Slideotter PDF",
    minBytes: 50_000,
    relativePath: "archive/slideotter.pdf"
  }
] as const;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readJsonFile(fileName: string): JsonRecord {
  const parsed: unknown = JSON.parse(fs.readFileSync(fileName, "utf8"));
  if (!isJsonRecord(parsed)) {
    throw new Error(`${fileName} must contain a JSON object`);
  }

  return parsed;
}

function addCheck(checks: DemoPreflightCheck[], level: DemoPreflightLevel, label: string, detail?: string): void {
  checks.push(detail ? { detail, label, level } : { label, level });
}

function packageScripts(packageJson: JsonRecord): JsonRecord {
  return isJsonRecord(packageJson.scripts) ? packageJson.scripts : {};
}

function fileSize(fileName: string): number {
  try {
    return fs.statSync(fileName).size;
  } catch {
    return 0;
  }
}

function configuredLmStudioBaseUrl(options: DemoPreflightOptions): string {
  const env = options.env || process.env;
  return String(
    options.lmStudioBaseUrl ||
    env.LMSTUDIO_BASE_URL ||
    env.STUDIO_LLM_BASE_URL ||
    "http://127.0.0.1:1234/v1"
  ).replace(/\/+$/, "");
}

function configuredLmStudioModel(env: NodeJS.ProcessEnv): string {
  return String(env.STUDIO_LLM_MODEL || env.LMSTUDIO_MODEL || "").trim();
}

function findFutureFrontendDeck(env: NodeJS.ProcessEnv): string | null {
  const home = env.SLIDEOTTER_HOME || path.join(os.homedir(), ".slideotter");
  const presentationsDir = path.join(home, "presentations");
  if (!fs.existsSync(presentationsDir)) {
    return null;
  }

  const entries = fs.readdirSync(presentationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return entries.find((entry) => /future[-_\s]*frontend/i.test(entry)) || null;
}

async function readJsonFromUrl(url: string): Promise<JsonRecord> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed: unknown = await response.json();
    return isJsonRecord(parsed) ? parsed : {};
  } finally {
    clearTimeout(timeout);
  }
}

async function addLmStudioChecks(checks: DemoPreflightCheck[], options: DemoPreflightOptions): Promise<void> {
  const env = options.env || process.env;
  const baseUrl = configuredLmStudioBaseUrl(options);
  try {
    const models = await readJsonFromUrl(`${baseUrl}/models`) as LmStudioModelsResponse;
    const loadedModels = Array.isArray(models.data)
      ? models.data.map((model) => String(model.id || "").trim()).filter(Boolean)
      : [];
    if (!loadedModels.length) {
      addCheck(checks, "fail", "LM Studio model loaded", `No loaded models reported by ${baseUrl}/models.`);
      return;
    }

    const configuredModel = configuredLmStudioModel(env);
    if (configuredModel && !loadedModels.includes(configuredModel)) {
      addCheck(
        checks,
        "fail",
        "LM Studio configured model",
        `"${configuredModel}" is configured but loaded models are: ${loadedModels.join(", ")}.`
      );
      return;
    }

    addCheck(
      checks,
      "pass",
      "LM Studio model loaded",
      configuredModel ? `Using ${configuredModel}.` : `Using discovered model ${loadedModels[0]}.`
    );
  } catch (error) {
    addCheck(
      checks,
      "fail",
      "LM Studio reachable",
      `${baseUrl}/models failed: ${error instanceof Error ? error.message : String(error)}.`
    );
  }
}

function addOfflineChecks(checks: DemoPreflightCheck[], options: DemoPreflightOptions): void {
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const packageFile = path.join(cwd, "package.json");
  const packageJson = readJsonFile(packageFile);
  const scripts = packageScripts(packageJson);

  requiredScripts.forEach((scriptName) => {
    if (typeof scripts[scriptName] === "string" && scripts[scriptName].trim()) {
      addCheck(checks, "pass", `npm script ${scriptName}`);
      return;
    }

    addCheck(checks, "fail", `npm script ${scriptName}`, "Missing from package.json.");
  });

  const rehearsalDoc = path.join(cwd, "docs", "HYPERMEDIA_DEMO_REHEARSAL.md");
  addCheck(
    checks,
    fs.existsSync(rehearsalDoc) ? "pass" : "fail",
    "demo rehearsal document",
    fs.existsSync(rehearsalDoc) ? undefined : "docs/HYPERMEDIA_DEMO_REHEARSAL.md is missing."
  );

  recommendedArtifacts.forEach((artifact) => {
    const absolutePath = path.join(cwd, artifact.relativePath);
    const size = fileSize(absolutePath);
    if (size >= artifact.minBytes) {
      addCheck(checks, "pass", artifact.label, `${artifact.relativePath} (${Math.round(size / 1024)} KB).`);
      return;
    }

    addCheck(
      checks,
      "warn",
      artifact.label,
      `${artifact.relativePath} is missing or unexpectedly small. Run npm run archive:update before the demo.`
    );
  });

  const futureFrontendDeck = findFutureFrontendDeck(env);
  addCheck(
    checks,
    futureFrontendDeck ? "pass" : "warn",
    "Future Frontend user deck",
    futureFrontendDeck
      ? `Found ${futureFrontendDeck} under ${env.SLIDEOTTER_HOME || "~/.slideotter"}.`
      : "No Future Frontend deck found under the configured slideotter data directory."
  );
}

function formatReport(report: DemoPreflightReport): string {
  const markByLevel: Record<DemoPreflightLevel, string> = {
    fail: "FAIL",
    pass: "PASS",
    warn: "WARN"
  };
  const lines = report.checks.map((check) => {
    const detail = check.detail ? ` - ${check.detail}` : "";
    return `${markByLevel[check.level]} ${check.label}${detail}`;
  });

  lines.push("");
  lines.push(report.ok
    ? "Demo preflight passed."
    : "Demo preflight found blocking failures.");
  lines.push("Recommended rehearsal commands: npm run quality:gate:fast, npm run demo:preflight:lmstudio, npm run studio:dev");

  return `${lines.join("\n")}\n`;
}

async function createDemoPreflightReport(options: DemoPreflightOptions = {}): Promise<DemoPreflightReport> {
  const checks: DemoPreflightCheck[] = [];
  addOfflineChecks(checks, options);
  if (options.checkLmStudio) {
    await addLmStudioChecks(checks, options);
  }

  return {
    checks,
    ok: !checks.some((check) => check.level === "fail")
  };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const report = await createDemoPreflightReport({
    checkLmStudio: args.has("--lmstudio")
  });
  process.stdout.write(formatReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}

export {
  createDemoPreflightReport,
  formatReport
};
