import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { getOutputConfig } = require("../studio/server/services/output-config.ts");
const { ensureDir } = require("../studio/server/services/page-artifacts.ts");

function main() {
  const { archiveFile, pdfFile } = getOutputConfig();

  if (!fs.existsSync(pdfFile)) {
    throw new Error(`Build the active presentation before archiving: ${pdfFile}`);
  }

  ensureDir(path.dirname(archiveFile));
  fs.copyFileSync(pdfFile, archiveFile);
  process.stdout.write(`${archiveFile}\n`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
}
