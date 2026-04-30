const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");

type StrictTypeCounts = Record<string, number>;

const repoRoot = path.resolve(__dirname, "..");
const baselinePath = path.join(repoRoot, "scripts", "type-safety-strict-baseline.json");
const tscPath = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
const diagnosticPattern = /^([^(:]+\.(?:ts|mts|tsx))\(\d+,\d+\): error TS\d+:/;

function readJsonFile<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
}

function collectCounts(): StrictTypeCounts {
  const result = spawnSync(
    tscPath,
    ["--noEmit", "--pretty", "false"],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const counts: StrictTypeCounts = {};

  for (const line of output.split("\n")) {
    const match = line.match(diagnosticPattern);
    if (!match) {
      continue;
    }

    const fileName = match[1];
    if (!fileName) {
      continue;
    }

    counts[fileName] = (counts[fileName] ?? 0) + 1;
  }

  if (result.status === 0 && Object.keys(counts).length > 0) {
    throw new Error("Strict typecheck succeeded but diagnostics were parsed from output.");
  }

  if (result.status !== 0 && Object.keys(counts).length === 0) {
    process.stderr.write(output);
    throw new Error("Strict typecheck failed but no TypeScript diagnostics were parsed.");
  }

  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function compareCounts(current: StrictTypeCounts, baseline: StrictTypeCounts): string[] {
  const issues: string[] = [];
  const fileNames = new Set([...Object.keys(current), ...Object.keys(baseline)]);

  for (const fileName of [...fileNames].sort()) {
    const currentCount = current[fileName] ?? 0;
    const baselineCount = baseline[fileName] ?? 0;
    if (currentCount > baselineCount) {
      issues.push(`${fileName}: ${currentCount} strict diagnostics, baseline ${baselineCount}`);
    }
  }

  return issues;
}

function total(counts: StrictTypeCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

const current = collectCounts();

if (process.argv.includes("--print-baseline")) {
  process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
  process.exit(0);
}

const baseline = readJsonFile<StrictTypeCounts>(baselinePath);
const issues = compareCounts(current, baseline);

if (issues.length) {
  process.stderr.write(`Strict typecheck backlog increased:\n${issues.join("\n")}\n`);
  process.stderr.write("Add precise types or reduce the baseline when strict diagnostics are removed.\n");
  process.exit(1);
}

process.stdout.write(`Strict type baseline guard passed. Remaining baseline diagnostics: ${total(current)}.\n`);
