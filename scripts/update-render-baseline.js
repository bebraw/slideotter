const path = require("path");
const {
  baselineDir
} = require("../studio/server/services/paths");
const { pdfFile } = require("../studio/server/services/output-config");
const {
  createContactSheet,
  renderPdfPages
} = require("../studio/server/services/baseline-utils");

function main() {
  const pages = renderPdfPages(baselineDir, pdfFile);
  createContactSheet(pages, path.join(baselineDir, "contact-sheet.png"));
  process.stdout.write(`${baselineDir}\n`);
}

main();
