import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

type SourceFileStats = {
  fileName: string;
  extension: string;
  topLevelDirectory: string;
  lines: number;
};

type AggregateStats = {
  name: string;
  files: number;
  lines: number;
};

const sourceDirectories = ["studio/", "scripts/", "tests/", "cloud/", "desktop/", "bin/", "website/"];
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".cjs", ".css", ".html", ".sql"]);
const repoRoot = path.resolve(import.meta.dirname, "..");

function readTrackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return output.split("\n").filter(Boolean);
}

function isSourceFile(fileName: string): boolean {
  return sourceDirectories.some((directory) => fileName.startsWith(directory))
    && sourceExtensions.has(path.extname(fileName));
}

function countLines(sourceText: string): number {
  if (!sourceText) {
    return 0;
  }

  const lineCount = sourceText.split(/\r\n|\r|\n/).length;
  return sourceText.endsWith("\n") ? lineCount - 1 : lineCount;
}

function collectSourceStats(): SourceFileStats[] {
  return readTrackedFiles()
    .filter(isSourceFile)
    .map((fileName): SourceFileStats => {
      const fullPath = path.join(repoRoot, fileName);
      const sourceText = fs.readFileSync(fullPath, "utf8");

      return {
        fileName,
        extension: path.extname(fileName) || "[none]",
        topLevelDirectory: fileName.split("/")[0] || ".",
        lines: countLines(sourceText)
      };
    });
}

function aggregateBy(stats: SourceFileStats[], key: "extension" | "topLevelDirectory"): AggregateStats[] {
  const aggregate = new Map<string, AggregateStats>();

  for (const fileStats of stats) {
    const name = fileStats[key];
    const current = aggregate.get(name) ?? { name, files: 0, lines: 0 };
    current.files += 1;
    current.lines += fileStats.lines;
    aggregate.set(name, current);
  }

  return [...aggregate.values()].sort((left, right) => right.lines - left.lines || left.name.localeCompare(right.name));
}

function formatRow(columns: string[]): string {
  return columns.join("\t");
}

function printAggregate(title: string, aggregate: AggregateStats[]): void {
  process.stdout.write(`\n${title}\n`);
  process.stdout.write(formatRow(["Name", "Files", "LOC"]));
  process.stdout.write("\n");

  for (const row of aggregate) {
    process.stdout.write(formatRow([row.name, String(row.files), String(row.lines)]));
    process.stdout.write("\n");
  }
}

const sourceStats = collectSourceStats();
const totalLines = sourceStats.reduce((total, fileStats) => total + fileStats.lines, 0);

process.stdout.write(`Source files: ${sourceStats.length}\n`);
process.stdout.write(`Source LOC: ${totalLines}\n`);
printAggregate("By top-level directory", aggregateBy(sourceStats, "topLevelDirectory"));
printAggregate("By extension", aggregateBy(sourceStats, "extension"));

process.stdout.write("\nLargest files\n");
process.stdout.write(formatRow(["LOC", "File"]));
process.stdout.write("\n");

for (const fileStats of [...sourceStats].sort((left, right) => right.lines - left.lines || left.fileName.localeCompare(right.fileName)).slice(0, 20)) {
  process.stdout.write(formatRow([String(fileStats.lines), fileStats.fileName]));
  process.stdout.write("\n");
}
