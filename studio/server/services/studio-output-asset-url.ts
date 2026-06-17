import * as path from "path";

import { outputRoots, relativeInside } from "./studio-output-roots.ts";

export function asStudioOutputAssetUrl(fileName: string): string {
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
