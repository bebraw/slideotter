const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const diagramsRoot = path.join(__dirname, "..", "slides", "assets", "diagrams");

function walkDotFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];

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

function renderDiagram(input) {
  const output = input.replace(/\.dot$/u, ".png");
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const result = spawnSync("dot", [
    "-Kdot",
    "-Tpng:cairo",
    "-Gdpi=180",
    input,
    "-o",
    output
  ], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to render diagram: ${path.basename(input)}`);
  }
}

function validateDiagramOutputs(root) {
  const issues = [];

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
      issues.push(`Missing Graphviz source for ${path.relative(path.join(__dirname, ".."), resolved)}`);
    }
  }

  return issues;
}

function main() {
  const issues = validateDiagramOutputs(diagramsRoot);
  if (issues.length) {
    throw new Error(issues.join("\n"));
  }

  for (const input of walkDotFiles(diagramsRoot)) {
    renderDiagram(input);
  }
}

main();
