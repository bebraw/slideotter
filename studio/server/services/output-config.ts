const path = require("path");
const { repoRoot } = require("./paths.ts");

const outputDir = path.join(repoRoot, "slides", "output");
const outputBaseName = "demo-presentation";
const pdfFile = path.join(outputDir, `${outputBaseName}.pdf`);

module.exports = {
  outputBaseName,
  outputDir,
  pdfFile
};
