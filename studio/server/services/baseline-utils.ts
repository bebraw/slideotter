const fs = require("fs");
const path = require("path");
const { runImageMagick } = require("./imagemagick.ts");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function listPages(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function renderPdfPages(targetDir, inputFile) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Missing PDF input: ${inputFile}`);
  }

  resetDir(targetDir);
  const pattern = path.join(targetDir, "page-%02d.png");
  const result = runImageMagick([
    "-density",
    "160",
    inputFile,
    pattern
  ]);

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(`Failed to rasterize PDF pages.\n${details}`);
  }

  const pages = listPages(targetDir);
  if (!pages.length) {
    throw new Error(`No rendered pages were created in ${targetDir}`);
  }

  return pages;
}

function createContactSheet(pageFiles, targetPath) {
  const rows = [];
  const tempDir = path.join(path.dirname(targetPath), ".contact-sheet-rows");
  resetDir(tempDir);

  for (let index = 0; index < pageFiles.length; index += 2) {
    const rowPath = path.join(tempDir, `row-${String(index / 2).padStart(2, "0")}.png`);
    const rowResult = runImageMagick([
      ...pageFiles.slice(index, index + 2),
      "+append",
      rowPath
    ]);

    if (rowResult.status !== 0) {
      const details = (rowResult.stderr || rowResult.stdout || "").trim();
      throw new Error(`Failed to create contact-sheet row.\n${details}`);
    }

    rows.push(rowPath);
  }

  const sheetResult = runImageMagick([
    ...rows,
    "-append",
    targetPath
  ]);

  fs.rmSync(tempDir, { recursive: true, force: true });

  if (sheetResult.status !== 0) {
    const details = (sheetResult.stderr || sheetResult.stdout || "").trim();
    throw new Error(`Failed to create contact sheet.\n${details}`);
  }
}

function comparePageImages(baselinePage, currentPage, diffPath) {
  const result = runImageMagick([
    "compare",
    "-metric",
    "RMSE",
    baselinePage,
    currentPage,
    diffPath
  ]);

  const metricOutput = (result.stderr || result.stdout || "").trim();
  const match = metricOutput.match(/\(([\d.]+)\)/);
  const normalized = match ? Number(match[1]) : Number.NaN;

  return {
    normalized,
    raw: metricOutput,
    exitCode: result.status
  };
}

module.exports = {
  comparePageImages,
  createContactSheet,
  ensureDir,
  listPages,
  renderPdfPages,
  resetDir
};
