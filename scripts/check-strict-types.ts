const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");

type StrictTypeCounts = Record<string, number>;

const repoRoot = path.resolve(__dirname, "..");
const tscPath = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
const diagnosticPattern = /^([^(:]+\.(?:ts|mts|tsx))\(\d+,\d+\): error TS\d+:/;

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

function total(counts: StrictTypeCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

const current = collectCounts();

if (process.argv.includes("--print-counts")) {
  process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
  process.exit(0);
}

const remaining = total(current);

if (remaining > 0) {
  const issues = Object.entries(current).map(([fileName, count]) => `${fileName}: ${count} strict diagnostic${count === 1 ? "" : "s"}`);
  process.stderr.write(`Strict typecheck failed:\n${issues.join("\n")}\n`);
  process.stderr.write("Add precise types before merging.\n");
  process.exit(1);
}

process.stdout.write("Strict typecheck guard passed. Remaining strict diagnostics: 0.\n");
