type PathSegment = string | number;
type FieldPath = PathSegment[];
type JsonRecord = Record<string, unknown>;

type SelectionEntry = {
  anchorText: string;
  fieldHash: string;
  fieldPath: FieldPath;
  label: string;
  selectedText: string;
  selectionRange: {
    end: number | null;
    start: number | null;
  } | null;
};

type SelectionScope = SelectionEntry & {
  kind: "selection";
  presentationId: string;
  slideId: string;
  slideRevision: string | null;
};

type SelectionGroupScope = {
  kind: "selectionGroup";
  label: string;
  presentationId: string;
  selections: SelectionEntry[];
  slideId: string;
  slideRevision: string | null;
};

type NormalizedSelectionScope = SelectionScope | SelectionGroupScope;

type SelectionNormalizeOptions = {
  presentationId?: unknown;
  slideId?: unknown;
  slideSpec?: unknown;
};

type SelectionApplyOptions = {
  allowFamilyChange?: unknown;
  familyChange?: unknown;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function getIndexedValue(value: unknown, segment: PathSegment): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value) && typeof segment === "number") {
    return value[segment];
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return asRecord(value)[String(segment)];
  }

  return undefined;
}

function pathToArray(path: unknown): FieldPath {
  if (Array.isArray(path)) {
    return path.map((segment) => Number.isInteger(Number(segment)) && String(segment).trim() !== ""
      ? Number(segment)
      : String(segment));
  }

  return String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => Number.isInteger(Number(segment)) ? Number(segment) : segment);
}

function pathToString(path: unknown): string {
  return pathToArray(path).map(String).join(".");
}

function getPathValue(value: unknown, path: unknown): unknown {
  return pathToArray(path).reduce((current, segment) => {
    return getIndexedValue(current, segment);
  }, value);
}

function setPathValue(value: unknown, path: unknown, nextValue: unknown): unknown {
  const segments = pathToArray(path);
  if (!segments.length) {
    return nextValue;
  }

  const clone = JSON.parse(JSON.stringify(value));
  let target: unknown = clone;
  segments.slice(0, -1).forEach((segment) => {
    const nextTarget = getIndexedValue(target, segment);
    if (nextTarget === null || nextTarget === undefined) {
      throw new Error(`Cannot set unknown selection field: ${pathToString(path)}`);
    }

    target = nextTarget;
  });
  const finalSegment = segments[segments.length - 1];
  if (finalSegment === undefined) {
    return clone;
  }
  if (Array.isArray(target) && typeof finalSegment === "number") {
    target[finalSegment] = nextValue;
  } else if (target && typeof target === "object" && !Array.isArray(target)) {
    asRecord(target)[String(finalSegment)] = nextValue;
  } else {
    throw new Error(`Cannot set unknown selection field: ${pathToString(path)}`);
  }
  return clone;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = asRecord(value);
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashFieldValue(value: unknown): string {
  let hash = 2166136261;
  const text = canonicalJson(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeText(value: unknown, limit = 500): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function selectionLabelFromPath(path: unknown): string {
  const segments = pathToArray(path);
  if (!segments.length) {
    return "Selection";
  }

  const last = segments[segments.length - 1];
  const previous = segments.length > 1 ? segments[segments.length - 2] : null;
  if (typeof previous === "number") {
    return `${String(segments[segments.length - 3] || "Item")} ${previous + 1} ${String(last)}`;
  }

  return String(last);
}

function normalizeSelectionEntry(entry: unknown, slideSpec: unknown): SelectionEntry | null {
  const entryRecord = asRecord(entry);
  if (!Object.keys(entryRecord).length) {
    return null;
  }

  const fieldPath = pathToArray(entryRecord.fieldPath || entryRecord.path);
  if (!fieldPath.length) {
    return null;
  }

  const fieldValue = getPathValue(slideSpec, fieldPath);
  if (fieldValue === undefined) {
    return null;
  }

  const selectedText = normalizeText(entryRecord.selectedText || entryRecord.text || fieldValue);
  const anchorText = normalizeText(entryRecord.anchorText || selectedText || fieldValue);
  if (!selectedText && typeof fieldValue !== "string") {
    return null;
  }

  const selectionRange = asRecord(entryRecord.selectionRange);
  return {
    anchorText,
    fieldHash: normalizeText(entryRecord.fieldHash, 80) || hashFieldValue(fieldValue),
    fieldPath,
    label: normalizeText(entryRecord.label, 80) || selectionLabelFromPath(fieldPath),
    selectedText: selectedText || normalizeText(fieldValue),
    selectionRange: Object.keys(selectionRange).length
      ? {
          end: Number.isFinite(Number(selectionRange.end)) ? Number(selectionRange.end) : null,
          start: Number.isFinite(Number(selectionRange.start)) ? Number(selectionRange.start) : null
        }
      : null
  };
}

function normalizeSelectionScope(selection: unknown, options: SelectionNormalizeOptions = {}): NormalizedSelectionScope | null {
  const selectionRecord = asRecord(selection);
  if (!Object.keys(selectionRecord).length || !options.slideSpec) {
    return null;
  }

  const kind = selectionRecord.kind === "selectionGroup" || Array.isArray(selectionRecord.selections)
    ? "selectionGroup"
    : "selection";
  const expectedSlideId = normalizeText(options.slideId, 80);
  const slideId = normalizeText(selectionRecord.slideId || options.slideId, 80);
  if (expectedSlideId && slideId && slideId !== expectedSlideId) {
    return null;
  }

  if (kind === "selectionGroup") {
    const selections = (Array.isArray(selectionRecord.selections) ? selectionRecord.selections : [])
      .map((entry) => normalizeSelectionEntry(entry, options.slideSpec))
      .filter((entry): entry is SelectionEntry => Boolean(entry));
    const uniquePaths = new Set(selections.map((entry) => pathToString(entry.fieldPath)));
    if (!selections.length || uniquePaths.size !== selections.length) {
      return null;
    }

    return {
      kind,
      label: `${selections.length} selected fields`,
      presentationId: normalizeText(selectionRecord.presentationId || options.presentationId, 80),
      selections,
      slideId,
      slideRevision: normalizeText(selectionRecord.slideRevision, 120) || null
    };
  }

  const normalized = normalizeSelectionEntry(selectionRecord, options.slideSpec);
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    kind,
    presentationId: normalizeText(selectionRecord.presentationId || options.presentationId, 80),
    slideId,
    slideRevision: normalizeText(selectionRecord.slideRevision, 120) || null
  };
}

function getSelectionEntries(scope: unknown): SelectionEntry[] {
  const scopeRecord = asRecord(scope);
  if (!Object.keys(scopeRecord).length) {
    return [];
  }

  return scopeRecord.kind === "selectionGroup"
    ? Array.isArray(scopeRecord.selections) ? scopeRecord.selections.map(asRecord).filter((entry): entry is SelectionEntry => Array.isArray(entry.fieldPath)) : []
    : Array.isArray(scopeRecord.fieldPath) ? [scopeRecord as SelectionEntry] : [];
}

function describeSelectionScope(scope: unknown): string {
  const scopeRecord = asRecord(scope);
  if (!scope) {
    return "Current slide";
  }

  if (scopeRecord.kind === "selectionGroup") {
    return "Selected fields";
  }

  const entry = getSelectionEntries(scope)[0];
  const path = pathToString(entry && entry.fieldPath);
  const label = entry && entry.label ? entry.label : selectionLabelFromPath(path);
  return /body|summary|quote|title|note|caption/i.test(label)
    ? `Selected ${label}`
    : "Selected text";
}

function assertSelectionAnchorsCurrent(slideSpec: unknown, scope: unknown) {
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

function collectChangedPaths(before: unknown, after: unknown, basePath: FieldPath = []): FieldPath[] {
  if (canonicalJson(before) === canonicalJson(after)) {
    return [];
  }

  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    return [basePath];
  }

  const beforeRecord = asRecord(before);
  const afterRecord = asRecord(after);
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  return [...keys].flatMap((key) => collectChangedPaths(beforeRecord[key], afterRecord[key], [...basePath, Number.isInteger(Number(key)) ? Number(key) : key]));
}

function pathStartsWith(path: unknown, prefix: unknown): boolean {
  const left = pathToArray(path);
  const right = pathToArray(prefix);
  return right.length <= left.length && right.every((segment, index) => String(segment) === String(left[index]));
}

function assertPatchWithinSelectionScope(before: unknown, after: unknown, scope: unknown) {
  const allowedPaths = getSelectionEntries(scope).map((entry) => entry.fieldPath);
  const changedPaths = collectChangedPaths(before, after);
  const outside = changedPaths.filter((path) => !allowedPaths.some((allowed) => pathStartsWith(path, allowed)));

  if (outside.length) {
    throw new Error(`Selection-scoped candidate changed fields outside its scope: ${outside.map(pathToString).join(", ")}`);
  }
}

function mergeCandidateIntoSelectionScope(baseSpec: unknown, candidateSpec: unknown, scope: unknown) {
  let nextSpec = JSON.parse(JSON.stringify(baseSpec));
  getSelectionEntries(scope).forEach((entry) => {
    nextSpec = setPathValue(nextSpec, entry.fieldPath, getPathValue(candidateSpec, entry.fieldPath));
  });
  return nextSpec;
}

function createSelectionApplyScope(scope: unknown, options: SelectionApplyOptions = {}) {
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

function buildActionDescriptors() {
  return [
    {
      acceptsScope: ["selection", "slide"],
      effect: "candidate",
      href: "/api/assistant/message",
      input: {
        required: ["message", "slideId"],
        optional: ["selection", "candidateCount", "sessionId"]
      },
      label: "Selection-aware assistant command",
      method: "POST",
      rel: "assistant-message"
    },
    {
      acceptsScope: ["selection", "slide"],
      effect: "write",
      href: "/api/slides/{slideId}/slide-spec",
      input: {
        required: ["slideSpec"],
        optional: ["selectionScope", "rebuild", "visualTheme"]
      },
      label: "Apply slide candidate",
      method: "POST",
      rel: "apply-slide-spec"
    },
    {
      acceptsScope: ["deck"],
      effect: "candidate",
      href: "/api/operations/ideate-deck-structure",
      input: {
        optional: ["dryRun"]
      },
      label: "Generate deck-plan candidates",
      method: "POST",
      rel: "ideate-deck-structure"
    }
  ];
}

export {
  assertPatchWithinSelectionScope,
  assertSelectionAnchorsCurrent,
  buildActionDescriptors,
  canonicalJson,
  createSelectionApplyScope,
  describeSelectionScope,
  getPathValue,
  getSelectionEntries,
  hashFieldValue,
  mergeCandidateIntoSelectionScope,
  normalizeSelectionScope,
  pathToArray,
  pathToString
};