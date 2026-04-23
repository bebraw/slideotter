const path = require("path");
const {
  baselineDir,
  createContactSheet,
  renderPdfPages
} = require("./baseline-utils");

function main() {
  const pages = renderPdfPages(baselineDir);
  createContactSheet(pages, path.join(baselineDir, "contact-sheet.png"));
  process.stdout.write(`${baselineDir}\n`);
}

main();
