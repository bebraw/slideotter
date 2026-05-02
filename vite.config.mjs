import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "vite";

const rootDir = import.meta.dirname;
const clientRoot = path.join(rootDir, "studio/client");
const clientOutDir = path.join(rootDir, "studio/client-dist");

function readCssSource(filePath, visited = new Set()) {
  const absolutePath = path.resolve(filePath);
  if (visited.has(absolutePath)) {
    throw new Error(`CSS import cycle detected at ${absolutePath}`);
  }
  visited.add(absolutePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  return source.replace(/@import\s+"([^"]+)";/g, (_match, importPath) => {
    return readCssSource(path.join(path.dirname(absolutePath), importPath), visited);
  });
}

function stripCssComments(source) {
  let output = "";
  let quote = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (quote) {
      output += character;
      if (character === "\\" && next) {
        output += next;
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === "\"" || character === "'") {
      quote = character;
      output += character;
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }

    output += character;
  }
  return output;
}

function isCssSyntaxBoundary(character) {
  return "{}[]():;,>+~=".includes(character);
}

function minifyCss(source) {
  const withoutComments = stripCssComments(source);
  let output = "";
  let quote = "";
  let pendingSpace = false;

  for (let index = 0; index < withoutComments.length; index += 1) {
    const character = withoutComments[index];
    const next = withoutComments[index + 1];

    if (quote) {
      output += character;
      if (character === "\\" && next) {
        output += next;
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === "\"" || character === "'") {
      if (pendingSpace && output && !isCssSyntaxBoundary(output.at(-1) || "")) {
        output += " ";
      }
      pendingSpace = false;
      quote = character;
      output += character;
      continue;
    }

    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }

    if (isCssSyntaxBoundary(character)) {
      output = output.trimEnd();
      output += character;
      pendingSpace = false;
      continue;
    }

    if (pendingSpace && output && !isCssSyntaxBoundary(output.at(-1) || "")) {
      output += " ";
    }
    pendingSpace = false;
    output += character;
  }

  return `${output.trim()}\n`;
}

export default defineConfig({
  appType: "spa",
  build: {
    emptyOutDir: true,
    minify: "esbuild",
    outDir: clientOutDir,
    sourcemap: false
  },
  plugins: [
    {
      name: "slideotter-stable-server-assets",
      closeBundle() {
        fs.writeFileSync(
          path.join(clientOutDir, "styles.css"),
          minifyCss(readCssSource(path.join(clientRoot, "styles.css"))),
          "utf8"
        );
        fs.copyFileSync(path.join(clientRoot, "favicon.svg"), path.join(clientOutDir, "favicon.svg"));
      }
    }
  ],
  publicDir: false,
  root: clientRoot
});
