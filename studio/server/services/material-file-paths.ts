import * as path from "path";
import { getPresentationPaths } from "./presentation-paths.ts";

function getMaterialFilePath(presentationId: string, fileName: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(presentationId || ""))) {
    throw new Error("Invalid presentation id");
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(String(fileName || ""))) {
    throw new Error("Invalid material filename");
  }

  const paths = getPresentationPaths(presentationId);
  const resolved = path.resolve(paths.materialsDir, fileName);
  const root = path.resolve(paths.materialsDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid material path");
  }

  return resolved;
}

export {
  getMaterialFilePath
};
