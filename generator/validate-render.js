const fs = require("fs");
const path = require("path");
const {
  baselineDir,
  diffDir,
  renderedDir,
  comparePageImages,
  createContactSheet,
  ensureDir,
  listPages,
  renderPdfPages,
  resetDir
} = require("./baseline-utils");

const MAX_NORMALIZED_RMSE = 0.001;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function main() {
  const baselinePages = listPages(baselineDir);
  if (!baselinePages.length) {
    fail(
      [
        "No render baseline found.",
        "Run npm run baseline:render to create the approved page snapshots first."
      ].join("\n")
    );
  }

  const currentPages = renderPdfPages(renderedDir);
  createContactSheet(currentPages, path.join(renderedDir, "contact-sheet.png"));

  if (baselinePages.length !== currentPages.length) {
    fail(
      `Rendered page count changed. baseline=${baselinePages.length}, current=${currentPages.length}`
    );
  }

  resetDir(diffDir);
  const failures = [];

  for (let index = 0; index < baselinePages.length; index += 1) {
    const baselinePage = baselinePages[index];
    const currentPage = currentPages[index];
    const diffPath = path.join(diffDir, `page-${String(index).padStart(2, "0")}-diff.png`);
    const comparison = comparePageImages(baselinePage, currentPage, diffPath);

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

ensureDir(diffDir);
main();
