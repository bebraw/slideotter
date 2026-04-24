const path = require("path");
const { archiveDir, baselineRootDir, repoRoot } = require("./paths.ts");
const { getActivePresentationId } = require("./presentations.ts");

const outputDir = path.join(repoRoot, "slides", "output");

function getOutputConfig() {
  const outputBaseName = getActivePresentationId();

  return {
    archiveFile: path.join(archiveDir, `${outputBaseName}.pdf`),
    baselineDir: path.join(baselineRootDir, outputBaseName),
    contactSheetFile: path.join(outputDir, outputBaseName, "contact-sheet.png"),
    outputBaseName,
    outputDir,
    pdfFile: path.join(outputDir, `${outputBaseName}.pdf`),
    previewDir: path.join(outputDir, outputBaseName, "rendered-pages")
  };
}

module.exports = {
  archiveDir,
  getOutputConfig,
  outputDir
};
