import * as fs from "fs";
import * as path from "path";

import { outputDir } from "./paths.ts";
import { outputRoots, relativeInside } from "./studio-output-roots.ts";

export function resolveStudioOutputAssetPath(requestPath: string): string {
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
