import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { exportDeckPptx } = require("../studio/server/services/build.ts");

async function main() {
  const result = await exportDeckPptx();
  process.stdout.write(`${result.pptxFile}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
