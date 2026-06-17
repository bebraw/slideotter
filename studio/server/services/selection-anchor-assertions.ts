import { hashFieldValue } from "./selection-hash.ts";
import { getSelectionEntries } from "./selection-entries.ts";
import { pathToString } from "./selection-path-format.ts";
import { getPathValue } from "./selection-path-values.ts";
import { normalizeText } from "./selection-normalization.ts";

export function assertSelectionAnchorsCurrent(slideSpec: unknown, scope: unknown): void {
  getSelectionEntries(scope).forEach((entry) => {
    const currentValue = getPathValue(slideSpec, entry.fieldPath);
    if (currentValue === undefined) {
      throw new Error(`Selection target no longer exists: ${pathToString(entry.fieldPath)}`);
    }

    const currentHash = hashFieldValue(currentValue);
    if (entry.fieldHash && currentHash !== entry.fieldHash) {
      throw new Error("Selection target changed after candidate generation. Regenerate or rebase before applying.");
    }

    if (entry.anchorText && typeof currentValue === "string" && !normalizeText(currentValue, 5000).includes(entry.anchorText)) {
      throw new Error("Selection anchor no longer matches the current slide field.");
    }
  });
}
