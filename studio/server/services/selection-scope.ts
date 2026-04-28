function pathToArray(path) {
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

function pathToString(path) {
  return pathToArray(path).map(String).join(".");
}

function getPathValue(value, path) {
  return pathToArray(path).reduce((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    return current[segment];
  }, value);
}

function setPathValue(value, path, nextValue) {
  const segments = pathToArray(path);
  if (!segments.length) {
    return nextValue;
  }

  const clone = JSON.parse(JSON.stringify(value));
  let target = clone;
  segments.slice(0, -1).forEach((segment) => {
    if (target[segment] === null || target[segment] === undefined) {
      throw new Error(`Cannot set unknown selection field: ${pathToString(path)}`);
    }

    target = target[segment];
  });
  target[segments[segments.length - 1]] = nextValue;
  return clone;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashFieldValue(value) {
  let hash = 2166136261;
  const text = canonicalJson(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeText(value, limit = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function selectionLabelFromPath(path) {
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

function normalizeSelectionEntry(entry, slideSpec) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const fieldPath = pathToArray(entry.fieldPath || entry.path);
  if (!fieldPath.length) {
    return null;
  }

  const fieldValue = getPathValue(slideSpec, fieldPath);
  if (fieldValue === undefined) {
    return null;
  }

  const selectedText = normalizeText(entry.selectedText || entry.text || fieldValue);
  const anchorText = normalizeText(entry.anchorText || selectedText || fieldValue);
  if (!selectedText && typeof fieldValue !== "string") {
    return null;
  }

  return {
    anchorText,
    fieldHash: normalizeText(entry.fieldHash, 80) || hashFieldValue(fieldValue),
    fieldPath,
    label: normalizeText(entry.label, 80) || selectionLabelFromPath(fieldPath),
    selectedText: selectedText || normalizeText(fieldValue),
    selectionRange: entry.selectionRange && typeof entry.selectionRange === "object"
      ? {
          end: Number.isFinite(Number(entry.selectionRange.end)) ? Number(entry.selectionRange.end) : null,
          start: Number.isFinite(Number(entry.selectionRange.start)) ? Number(entry.selectionRange.start) : null
        }
      : null
  };
}

function normalizeSelectionScope(selection, options: any = {}) {
  if (!selection || typeof selection !== "object" || !options.slideSpec) {
    return null;
  }

  const kind = selection.kind === "selectionGroup" || Array.isArray(selection.selections)
    ? "selectionGroup"
    : "selection";
  const slideId = normalizeText(selection.slideId || options.slideId, 80);
  if (options.slideId && slideId && slideId !== options.slideId) {
    return null;
  }

  if (kind === "selectionGroup") {
    const selections = (Array.isArray(selection.selections) ? selection.selections : [])
      .map((entry) => normalizeSelectionEntry(entry, options.slideSpec))
      .filter(Boolean);
    const uniquePaths = new Set(selections.map((entry) => pathToString(entry.fieldPath)));
    if (!selections.length || uniquePaths.size !== selections.length) {
      return null;
    }

    return {
      kind,
      label: `${selections.length} selected fields`,
      presentationId: normalizeText(selection.presentationId || options.presentationId, 80),
      selections,
      slideId,
      slideRevision: normalizeText(selection.slideRevision, 120) || null
    };
  }

  const normalized = normalizeSelectionEntry(selection, options.slideSpec);
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    kind,
    presentationId: normalizeText(selection.presentationId || options.presentationId, 80),
    slideId,
    slideRevision: normalizeText(selection.slideRevision, 120) || null
  };
}

function getSelectionEntries(scope) {
  if (!scope || typeof scope !== "object") {
    return [];
  }

  return scope.kind === "selectionGroup"
    ? Array.isArray(scope.selections) ? scope.selections : []
    : [scope];
}

function describeSelectionScope(scope) {
  if (!scope) {
    return "Current slide";
  }

  if (scope.kind === "selectionGroup") {
    return "Selected fields";
  }

  const entry = getSelectionEntries(scope)[0];
  const path = pathToString(entry && entry.fieldPath);
  const label = entry && entry.label ? entry.label : selectionLabelFromPath(path);
  return /body|summary|quote|title|note|caption/i.test(label)
    ? `Selected ${label}`
    : "Selected text";
}

function assertSelectionAnchorsCurrent(slideSpec, scope) {
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

function collectChangedPaths(before, after, basePath = []) {
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

  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].flatMap((key) => collectChangedPaths(before ? before[key] : undefined, after ? after[key] : undefined, [...basePath, Number.isInteger(Number(key)) ? Number(key) : key]));
}

function pathStartsWith(path, prefix) {
  const left = pathToArray(path);
  const right = pathToArray(prefix);
  return right.length <= left.length && right.every((segment, index) => String(segment) === String(left[index]));
}

function assertPatchWithinSelectionScope(before, after, scope) {
  const allowedPaths = getSelectionEntries(scope).map((entry) => entry.fieldPath);
  const changedPaths = collectChangedPaths(before, after);
  const outside = changedPaths.filter((path) => !allowedPaths.some((allowed) => pathStartsWith(path, allowed)));

  if (outside.length) {
    throw new Error(`Selection-scoped candidate changed fields outside its scope: ${outside.map(pathToString).join(", ")}`);
  }
}

function mergeCandidateIntoSelectionScope(baseSpec, candidateSpec, scope) {
  let nextSpec = JSON.parse(JSON.stringify(baseSpec));
  getSelectionEntries(scope).forEach((entry) => {
    nextSpec = setPathValue(nextSpec, entry.fieldPath, getPathValue(candidateSpec, entry.fieldPath));
  });
  return nextSpec;
}

function createSelectionApplyScope(scope, options: any = {}) {
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

module.exports = {
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
