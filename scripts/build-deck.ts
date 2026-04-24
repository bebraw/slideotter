const { exportDeckPdfFromDom } = require("../studio/server/services/dom-export.ts");
const { getDomPreviewState } = require("../studio/server/services/dom-preview.ts");

async function main() {
  const { pdfFile } = await exportDeckPdfFromDom(getDomPreviewState());
  process.stdout.write(`${pdfFile}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
