const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const diagramsRoot = path.join(__dirname, "..", "slides", "assets", "diagrams");

type GraphvizRenderer = {
  layout: (source: string, format: "svg", engine: "dot") => string;
};

function walkDotFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDotFiles(resolved));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".dot")) {
      files.push(resolved);
    }
  }

  return files.sort();
}

async function renderDiagram(graphviz: GraphvizRenderer, input: string): Promise<void> {
  const output = input.replace(/\.dot$/u, ".png");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const source = fs.readFileSync(input, "utf8");

  try {
    const svg = graphviz.layout(source, "svg", "dot");
    await sharp(Buffer.from(svg), { density: 180 })
      .png()
      .toFile(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render diagram: ${path.basename(input)}\n${message}`);
  }
}

function validateDiagramOutputs(root: string): string[] {
  const issues: string[] = [];

  if (!fs.existsSync(root)) {
    return issues;
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) {
      issues.push(...validateDiagramOutputs(resolved));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".png")) {
      continue;
    }

    const source = resolved.replace(/\.png$/u, ".dot");
    if (!fs.existsSync(source)) {
      issues.push(`Missing DOT source for ${path.relative(path.join(__dirname, ".."), resolved)}`);
    }
  }

  return issues;
}

async function main() {
  const issues = validateDiagramOutputs(diagramsRoot);
  if (issues.length) {
    throw new Error(issues.join("\n"));
  }

  const { Graphviz } = await import("@hpcc-js/wasm-graphviz");
  const graphviz = await Graphviz.load();

  for (const input of walkDotFiles(diagramsRoot)) {
    await renderDiagram(graphviz, input);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
