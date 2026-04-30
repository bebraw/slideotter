const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");
const ts = require("typescript") as typeof import("typescript");

type ExplicitAnyCounts = Record<string, number>;
type TsNode = import("typescript").Node;

const repoRoot = path.resolve(__dirname, "..");
const baselinePath = path.join(repoRoot, "scripts", "type-safety-explicit-any-baseline.json");

function readJsonFile<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
}

function readTsConfig(): import("typescript").ParsedCommandLine {
  const configPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) {
    throw new Error("Could not find tsconfig.json");
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n");
    throw new Error(message);
  }

  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
}

function countExplicitAny(fileName: string): number {
  const sourceText = fs.readFileSync(fileName, "utf8");
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  let count = 0;

  function visit(node: TsNode): void {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return count;
}

function collectCounts(): ExplicitAnyCounts {
  const parsedConfig = readTsConfig();
  const counts: ExplicitAnyCounts = {};

  for (const fileName of parsedConfig.fileNames) {
    if (fileName.endsWith(".d.ts")) {
      continue;
    }

    const count = countExplicitAny(fileName);
    if (count > 0) {
      counts[path.relative(repoRoot, fileName).split(path.sep).join("/")] = count;
    }
  }

  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function compareCounts(current: ExplicitAnyCounts, baseline: ExplicitAnyCounts): string[] {
  const issues: string[] = [];
  const fileNames = new Set([...Object.keys(current), ...Object.keys(baseline)]);

  for (const fileName of [...fileNames].sort()) {
    const currentCount = current[fileName] ?? 0;
    const baselineCount = baseline[fileName] ?? 0;
    if (currentCount > baselineCount) {
      issues.push(`${fileName}: ${currentCount} explicit any nodes, baseline ${baselineCount}`);
    }
  }

  return issues;
}

const current = collectCounts();

if (process.argv.includes("--print-baseline")) {
  process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
  process.exit(0);
}

const baseline = readJsonFile<ExplicitAnyCounts>(baselinePath);
const issues = compareCounts(current, baseline);

if (issues.length) {
  process.stderr.write(`Explicit any usage increased:\n${issues.join("\n")}\n`);
  process.stderr.write("Use narrower domain types, unknown with guards, or reduce the baseline when existing usages are removed.\n");
  process.exit(1);
}

const remaining = Object.values(current).reduce((total, count) => total + count, 0);
process.stdout.write(`Explicit any guard passed. Remaining baseline count: ${remaining}.\n`);
