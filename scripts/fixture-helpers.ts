const fs = require("fs");
const path = require("path");

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoText(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function readCssSource(filePath: string, visited = new Set<string>()): string {
  const absolutePath = path.resolve(filePath);
  assert(!visited.has(absolutePath), `CSS import cycle detected at ${absolutePath}`);
  visited.add(absolutePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  return source.replace(/@import\s+"([^"]+)";/g, (_match: string, importPath: string) => {
    return readCssSource(path.join(path.dirname(absolutePath), importPath), visited);
  });
}

function readClientCss(relativePath = "styles.css"): string {
  return readCssSource(path.join(process.cwd(), "studio/client", relativePath));
}

module.exports = {
  assert,
  readClientCss,
  readCssSource,
  readRepoText
};
