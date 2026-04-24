const path = require("path");
const {
  baselineDir
} = require("../studio/server/services/paths.ts");
const { pdfFile } = require("../studio/server/services/output-config.ts");
const {
  createContactSheet,
  renderPdfPages
} = require("../studio/server/services/baseline-utils.ts");

function main() {
  const pages = renderPdfPages(baselineDir, pdfFile);
  createContactSheet(pages, path.join(baselineDir, "contact-sheet.png"));
  process.stdout.write(`${baselineDir}\n`);
}

main();
