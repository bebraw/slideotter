import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { runPresentationWorkflowValidation } = require("./validate-presentation-workflow.ts");
const { runStudioLayoutValidation } = require("./validate-studio-layout.ts");

type BrowserValidationFlow = "all" | "presentation" | "studio";

function listFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry: import("node:fs").Dirent) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  });
}

function validateClientDistAssets(): void {
  const clientDistDir = path.join(process.cwd(), "studio/client-dist");
  const files = listFiles(clientDistDir);
  if (!files.length) {
    throw new Error("Browser validation needs built client assets in studio/client-dist");
  }

  const sourceMapFiles = files.filter((filePath) => filePath.endsWith(".map"));
  if (sourceMapFiles.length) {
    throw new Error(`Built client assets should not ship sourcemaps: ${sourceMapFiles.map((filePath) => path.relative(process.cwd(), filePath)).join(", ")}`);
  }

  const shippedTextFiles = files.filter((filePath) => /\.(?:css|html|js)$/u.test(filePath));
  for (const filePath of shippedTextFiles) {
    const source = fs.readFileSync(filePath, "utf8");
    if (/sourceMappingURL/u.test(source)) {
      throw new Error(`Built client asset should not reference a sourcemap: ${path.relative(process.cwd(), filePath)}`);
    }
  }

  const fallbackStyles = path.join(clientDistDir, "styles.css");
  const fallbackCss = fs.readFileSync(fallbackStyles, "utf8");
  if (/@import/u.test(fallbackCss)) {
    throw new Error("Built fallback /styles.css should inline imported client CSS");
  }
}

async function main() {
  const flow = (process.argv[2] || "all") as BrowserValidationFlow;
  if (!["all", "presentation", "studio"].includes(flow)) {
    throw new Error(`Unknown browser validation flow "${flow}". Use all, presentation, or studio.`);
  }

  validateClientDistAssets();

  if (flow === "presentation") {
    await runPresentationWorkflowValidation();
    return;
  }

  if (flow === "studio") {
    await runStudioLayoutValidation();
    return;
  }

  const { server } = await runPresentationWorkflowValidation({ keepServerOpen: true });

  try {
    await runStudioLayoutValidation({ server });
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
