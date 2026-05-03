import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { getOutputConfig, outputDir } = require("../studio/server/services/output-config.ts");
const { renderCheckCurrentDir,
  renderCheckDiffDir } = require("../studio/server/services/paths.ts");
const { comparePageImages,
  createContactSheet,
  ensureDir,
  listPages,
  renderPdfPages,
  resetDir } = require("../studio/server/services/baseline-utils.ts");

const MAX_NORMALIZED_RMSE = 0.001;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function main() {
  const { baselineDir, pdfFile } = getOutputConfig();
  const baselinePages = listPages(baselineDir);
  if (!baselinePages.length) {
    fail(
      [
        "No render baseline found.",
        "Run npm run baseline:render to create the approved page snapshots first."
      ].join("\n")
    );
  }

  const currentPages = await renderPdfPages(renderCheckCurrentDir, pdfFile);
  await createContactSheet(currentPages, path.join(renderCheckCurrentDir, "contact-sheet.png"));

  if (baselinePages.length !== currentPages.length) {
    fail(
      `Rendered page count changed. baseline=${baselinePages.length}, current=${currentPages.length}`
    );
  }

  resetDir(renderCheckDiffDir);
  const failures = [];

  for (let index = 0; index < baselinePages.length; index += 1) {
    const baselinePage = baselinePages[index];
    const currentPage = currentPages[index];
    const diffPath = path.join(renderCheckDiffDir, `page-${String(index).padStart(2, "0")}-diff.png`);
    const comparison = await comparePageImages(baselinePage, currentPage, diffPath);

    if (!Number.isFinite(comparison.normalized) || comparison.normalized > MAX_NORMALIZED_RMSE) {
      failures.push({
        page: index + 1,
        metric: comparison.raw,
        diffPath
      });
      continue;
    }

    fs.rmSync(diffPath, { force: true });
  }

  if (failures.length) {
    for (const failure of failures) {
      process.stderr.write(
        `page ${failure.page}: render mismatch (${failure.metric}) diff: ${failure.diffPath}\n`
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Render validation passed.\n");
}

ensureDir(outputDir);
ensureDir(renderCheckDiffDir);
main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
