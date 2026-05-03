import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

type ExplicitAnyCounts = Record<string, number>;
type TsNode = import("typescript").Node;

const repoRoot = path.resolve(import.meta.dirname, "..");

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

const current = collectCounts();

if (process.argv.includes("--print-counts")) {
  process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
  process.exit(0);
}

const remaining = Object.values(current).reduce((total, count) => total + count, 0);

if (remaining > 0) {
  const issues = Object.entries(current).map(([fileName, count]) => `${fileName}: ${count} explicit any node${count === 1 ? "" : "s"}`);
  process.stderr.write(`Explicit any usage is not allowed:\n${issues.join("\n")}\n`);
  process.stderr.write("Use narrower domain types or unknown with local guards.\n");
  process.exit(1);
}

process.stdout.write("Explicit any guard passed. Remaining explicit any nodes: 0.\n");
