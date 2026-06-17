export { assertSelectionAnchorsCurrent } from "./selection-anchor-assertions.ts";

import { collectChangedPaths } from "./selection-change-paths.ts";
import { getSelectionEntries } from "./selection-entries.ts";
import {
  pathToString,
} from "./selection-path-format.ts";
import { pathStartsWith } from "./selection-path-values.ts";

export function assertPatchWithinSelectionScope(before: unknown, after: unknown, scope: unknown): void {
  const allowedPaths = getSelectionEntries(scope).map((entry) => entry.fieldPath);
  const changedPaths = collectChangedPaths(before, after);
  const outside = changedPaths.filter((path) => !allowedPaths.some((allowed) => pathStartsWith(path, allowed)));

  if (outside.length) {
    throw new Error(`Selection-scoped candidate changed fields outside its scope: ${outside.map(pathToString).join(", ")}`);
  }
}
