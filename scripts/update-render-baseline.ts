import * as path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { getOutputConfig } = require("../studio/server/services/output-config.ts");
const { createContactSheet,
  renderPdfPages } = require("../studio/server/services/baseline-utils.ts");

async function main() {
  const { baselineDir, pdfFile } = getOutputConfig();
  const pages = await renderPdfPages(baselineDir, pdfFile);
  await createContactSheet(pages, path.join(baselineDir, "contact-sheet.png"));
  process.stdout.write(`${baselineDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
