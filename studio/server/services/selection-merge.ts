import { describeSelectionScope, getSelectionEntries } from "./selection-entries.ts";
import { getPathValue, setPathValue } from "./selection-path-values.ts";

type SelectionApplyOptions = {
  allowFamilyChange?: unknown;
  familyChange?: unknown;
};

export function mergeCandidateIntoSelectionScope(baseSpec: unknown, candidateSpec: unknown, scope: unknown): unknown {
  let nextSpec = JSON.parse(JSON.stringify(baseSpec));
  getSelectionEntries(scope).forEach((entry) => {
    nextSpec = setPathValue(nextSpec, entry.fieldPath, getPathValue(candidateSpec, entry.fieldPath));
  });
  return nextSpec;
}

export function createSelectionApplyScope(scope: unknown, options: SelectionApplyOptions = {}): unknown {
  if (!scope) {
    return null;
  }

  return {
    ...scope,
    allowFamilyChange: Boolean(options.allowFamilyChange),
    familyChange: options.familyChange || null,
    scopeLabel: describeSelectionScope(scope)
  };
}
