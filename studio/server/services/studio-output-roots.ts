import * as path from "path";

import {
  outputDir,
  slidesOutputDir
} from "./paths.ts";

export type StudioOutputRoot = {
  prefix: string;
  rootDir: string;
};

export const outputRoots: StudioOutputRoot[] = [
  { prefix: "runtime", rootDir: path.resolve(outputDir) },
  { prefix: "slides", rootDir: path.resolve(slidesOutputDir) }
].filter((entry, index, entries) => (
  entries.findIndex((candidate) => candidate.rootDir === entry.rootDir) === index
));

export function relativeInside(rootDir: string, fileName: string): string | null {
  const relativePath = path.relative(rootDir, path.resolve(fileName));
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return relativePath;
}
