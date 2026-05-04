import * as fs from "fs";
import * as path from "path";

import {
  outputDir,
  slidesOutputDir
} from "./paths.ts";

const outputRoots = [
  { prefix: "runtime", rootDir: path.resolve(outputDir) },
  { prefix: "slides", rootDir: path.resolve(slidesOutputDir) }
].filter((entry, index, entries) => (
  entries.findIndex((candidate) => candidate.rootDir === entry.rootDir) === index
));

function relativeInside(rootDir: string, fileName: string): string | null {
  const relativePath = path.relative(rootDir, path.resolve(fileName));
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return relativePath;
}

function asStudioOutputAssetUrl(fileName: string): string {
  const match = outputRoots
    .map((entry) => {
      const relativePath = relativeInside(entry.rootDir, fileName);
      return relativePath ? { prefix: entry.prefix, relativePath } : null;
    })
    .find((entry): entry is { prefix: string; relativePath: string } => Boolean(entry));

  if (!match) {
    throw new Error(`Studio output asset is outside configured output roots: ${fileName}`);
  }

  return `/studio-output/${match.prefix}/${match.relativePath.split(path.sep).join("/")}`;
}

function resolveStudioOutputAssetPath(requestPath: string): string {
  const relativePath = decodeURIComponent(requestPath.replace(/^\/studio-output\/?/, ""));
  const prefixedRoot = outputRoots.find((entry) => relativePath === entry.prefix || relativePath.startsWith(`${entry.prefix}/`));
  if (prefixedRoot) {
    const unprefixedPath = relativePath.slice(prefixedRoot.prefix.length).replace(/^\/+/, "");
    const candidate = path.resolve(prefixedRoot.rootDir, unprefixedPath);
    return relativeInside(prefixedRoot.rootDir, candidate) === null
      ? path.join(prefixedRoot.rootDir, "__missing__")
      : candidate;
  }

  const candidates = outputRoots
    .map((entry) => path.resolve(entry.rootDir, relativePath))
    .filter((candidate) => outputRoots.some((entry) => relativeInside(entry.rootDir, candidate) !== null));
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  return existing || candidates[0] || path.join(outputDir, "__missing__");
}

export {
  asStudioOutputAssetUrl,
  resolveStudioOutputAssetPath
};
