import type { StudioClientState } from "../core/state";

type JsonRecord = StudioClientState.JsonRecord;

export type DiffHighlight = {
  after: string;
  before: string;
  line: number;
};

export type SourceDiff = {
  added: number;
  changed: number;
  highlights: DiffHighlight[];
  removed: number;
};

export type SourceDiffRow = DiffHighlight & {
  changed: boolean;
};

export type StructuredGroup = "bullets" | "cards" | "family" | "framing" | "guardrails" | "resources" | "signals" | string;

export type StructuredChange = {
  after: string;
  before: string;
  group: StructuredGroup;
  label: string;
};

export type StructuredGroupDetail = {
  changes: StructuredChange[];
  group: StructuredGroup;
  label: string;
};

export type StructuredComparison = {
  changes: StructuredChange[];
  groupDetails?: StructuredGroupDetail[];
  groups: StructuredGroup[];
  summaryLines: string[];
  totalChanges: number;
};

export type DecisionSupport = {
  contentAreas: number;
  cues: string[];
  fieldChanges: number;
  focusItems: Array<{
    label: string;
    value: string;
  }>;
  scale: "Large" | "Medium" | "Small";
  wordDelta: number | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function slideSpecItems(spec: JsonRecord, field: string): JsonRecord[] {
  const value = spec[field];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeCompareValue(value: unknown): string {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value);
}

function formatCompareValue(value: unknown): string {
  const normalized = normalizeCompareValue(value);
  return normalized || "(empty)";
}

function formatStructuredGroupLabel(group: StructuredGroup): string {
  const labels: Record<string, string> = {
    bullets: "Bullets",
    cards: "Cards",
    family: "Slide family",
    framing: "Framing",
    guardrails: "Guardrails",
    resources: "Resources",
    signals: "Signals"
  };
  return labels[group] || group;
}

function collectSlideTextParts(spec: unknown): string[] {
  if (!isRecord(spec)) {
    return [];
  }

  const parts: unknown[] = [
    spec.eyebrow,
    spec.title,
    spec.summary,
    spec.note,
    spec.signalsTitle,
    spec.guardrailsTitle,
    spec.resourcesTitle
  ];

  ["cards", "signals", "guardrails", "bullets", "resources"].forEach((field) => {
    slideSpecItems(spec, field).forEach((item: JsonRecord) => {
      parts.push(item.title, item.body, item.label, item.value);
    });
  });

  return parts
    .filter((part) => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean);
}

function countSlideWords(spec: unknown): number {
  const text = collectSlideTextParts(spec).join(" ").trim();
  return text ? text.split(/\s+/).length : 0;
}

export function summarizeDiff(currentSource: string, variantSource: string): SourceDiff {
  const currentLines = currentSource.split("\n");
  const variantLines = variantSource.split("\n");
  const maxLines = Math.max(currentLines.length, variantLines.length);
  let added = 0;
  let changed = 0;
  const highlights: DiffHighlight[] = [];
  let removed = 0;

  for (let index = 0; index < maxLines; index += 1) {
    const before = currentLines[index];
    const after = variantLines[index];

    if (before === after) {
      continue;
    }

    if (before === undefined) {
      added += 1;
    } else if (after === undefined) {
      removed += 1;
    } else {
      changed += 1;
    }

    if (highlights.length < 4) {
      highlights.push({
        after: after ? after.trim() : "(removed)",
        before: before ? before.trim() : "(no line)",
        line: index + 1
      });
    }
  }

  return {
    added,
    changed,
    highlights,
    removed
  };
}

export function buildSourceDiffRows(currentSource: string, variantSource: string): SourceDiffRow[] {
  const beforeLines = currentSource.split("\n");
  const afterLines = variantSource.split("\n");
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  const rows: SourceDiffRow[] = [];

  for (let index = 0; index < maxLines; index += 1) {
    const before = beforeLines[index];
    const after = afterLines[index];
    const changed = before !== after;

    rows.push({
      after: after === undefined ? "" : after,
      before: before === undefined ? "" : before,
      changed,
      line: index + 1
    });
  }

  return rows;
}

export function buildStructuredComparison(currentSpec: JsonRecord | null, variantSpec: JsonRecord | null): StructuredComparison | null {
  if (!currentSpec || !variantSpec) {
    return null;
  }

  const changes: StructuredChange[] = [];
  const groups = new Set<StructuredGroup>();

  const pushChange = (group: StructuredGroup, label: string, before: unknown, after: unknown): void => {
    const normalizedBefore = normalizeCompareValue(before);
    const normalizedAfter = normalizeCompareValue(after);

    if (normalizedBefore === normalizedAfter) {
      return;
    }

    groups.add(group);
    changes.push({
      after: formatCompareValue(after),
      before: formatCompareValue(before),
      group,
      label
    });
  };

  if (currentSpec.type !== variantSpec.type) {
    pushChange("family", "Slide family", currentSpec.type, variantSpec.type);

    return {
      changes,
      groupDetails: [
        {
          changes,
          group: "family",
          label: "Slide family"
        }
      ],
      groups: ["family"],
      summaryLines: [
        `Changed slide family from ${currentSpec.type} to ${variantSpec.type}.`,
        "Review dropped or transformed fields in the JSON diff before applying."
      ],
      totalChanges: changes.length
    };
  }

  pushChange("framing", "Title", currentSpec.title, variantSpec.title);
  if (currentSpec.type !== "divider") {
    pushChange("framing", "Eyebrow", currentSpec.eyebrow, variantSpec.eyebrow);
    pushChange("framing", "Summary", currentSpec.summary, variantSpec.summary);
  }

  switch (currentSpec.type) {
    case "divider":
      break;
    case "cover":
    case "toc":
      pushChange("framing", "Note", currentSpec.note, variantSpec.note);
      slideSpecItems(currentSpec, "cards").forEach((card: JsonRecord, index: number) => {
        const nextCard = slideSpecItems(variantSpec, "cards")[index] || {};
        pushChange("cards", `Card ${index + 1} title`, card.title, nextCard.title);
        pushChange("cards", `Card ${index + 1} body`, card.body, nextCard.body);
      });
      break;
    case "content":
      pushChange("signals", "Signals title", currentSpec.signalsTitle, variantSpec.signalsTitle);
      slideSpecItems(currentSpec, "signals").forEach((signal: JsonRecord, index: number) => {
        const nextSignal = slideSpecItems(variantSpec, "signals")[index] || {};
        pushChange("signals", `Signal ${index + 1} title`, signal.title || signal.label, nextSignal.title || nextSignal.label);
        pushChange("signals", `Signal ${index + 1} body`, signal.body || signal.value, nextSignal.body || nextSignal.value);
      });
      pushChange("guardrails", "Guardrails title", currentSpec.guardrailsTitle, variantSpec.guardrailsTitle);
      slideSpecItems(currentSpec, "guardrails").forEach((guardrail: JsonRecord, index: number) => {
        const nextGuardrail = slideSpecItems(variantSpec, "guardrails")[index] || {};
        pushChange("guardrails", `Guardrail ${index + 1} title`, guardrail.title || guardrail.label, nextGuardrail.title || nextGuardrail.label);
        pushChange("guardrails", `Guardrail ${index + 1} body`, guardrail.body || guardrail.value, nextGuardrail.body || nextGuardrail.value);
      });
      break;
    case "summary":
      pushChange("resources", "Resources title", currentSpec.resourcesTitle, variantSpec.resourcesTitle);
      slideSpecItems(currentSpec, "bullets").forEach((bullet: JsonRecord, index: number) => {
        const nextBullet = slideSpecItems(variantSpec, "bullets")[index] || {};
        pushChange("bullets", `Bullet ${index + 1} title`, bullet.title, nextBullet.title);
        pushChange("bullets", `Bullet ${index + 1} body`, bullet.body, nextBullet.body);
      });
      slideSpecItems(currentSpec, "resources").forEach((resource: JsonRecord, index: number) => {
        const nextResource = slideSpecItems(variantSpec, "resources")[index] || {};
        pushChange("resources", `Resource ${index + 1} title`, resource.title, nextResource.title);
        pushChange("resources", `Resource ${index + 1} body`, resource.body, nextResource.body);
      });
      break;
    default:
      return null;
  }

  if (!changes.length) {
    return {
      changes: [],
      groups: [],
      summaryLines: ["No structured field changes detected."],
      totalChanges: 0
    };
  }

  const orderedGroups = Array.from(groups);
  const groupLabels = orderedGroups.map((group) => formatStructuredGroupLabel(group)).join(", ");
  const groupDetails = orderedGroups.map((group) => ({
    changes: changes.filter((change: StructuredChange) => change.group === group),
    group,
    label: formatStructuredGroupLabel(group)
  }));

  return {
    changes,
    groupDetails,
    groups: orderedGroups,
    summaryLines: [
      `Changed ${changes.length} structured field${changes.length === 1 ? "" : "s"} across ${orderedGroups.length} content area${orderedGroups.length === 1 ? "" : "s"}.`,
      `Areas touched: ${groupLabels}.`
    ],
    totalChanges: changes.length
  };
}

export function buildVariantDecisionSupport(
  currentSpec: JsonRecord | null,
  variantSpec: JsonRecord | undefined,
  structuredComparison: StructuredComparison | null,
  diff: SourceDiff
): DecisionSupport {
  const fieldChanges = structuredComparison
    ? structuredComparison.totalChanges
    : diff.changed + diff.added + diff.removed;
  const groupDetails = structuredComparison && Array.isArray(structuredComparison.groupDetails)
    ? structuredComparison.groupDetails
    : [];
  const contentAreas = groupDetails.length;
  const canCompareWords = Boolean(currentSpec && variantSpec);
  const currentWords = canCompareWords ? countSlideWords(currentSpec) : 0;
  const variantWords = canCompareWords ? countSlideWords(variantSpec) : 0;
  const wordDelta = canCompareWords ? variantWords - currentWords : null;
  const absoluteWordDelta = wordDelta === null ? 0 : Math.abs(wordDelta);
  const titleChanged = structuredComparison
    ? structuredComparison.changes.some((change: StructuredChange) => change.label === "Title")
    : false;
  const scale = fieldChanges >= 12 || contentAreas >= 4 || absoluteWordDelta >= 24
    ? "Large"
    : fieldChanges >= 5 || contentAreas >= 2 || absoluteWordDelta >= 10
      ? "Medium"
      : "Small";
  const focusItems = groupDetails.length
    ? groupDetails.map((group: StructuredGroupDetail) => ({
      label: group.label,
      value: `${group.changes.length} change${group.changes.length === 1 ? "" : "s"}`
    }))
    : diff.highlights.map((highlight: DiffHighlight) => ({
      label: `Line ${highlight.line}`,
      value: "source change"
    }));
  const cues = [];

  if (scale === "Large") {
    cues.push("Review the full preview and affected areas before applying.");
  } else if (scale === "Medium") {
    cues.push("Check changed areas and text fit before applying.");
  } else {
    cues.push("Preview check is likely enough for this small change.");
  }

  if (titleChanged) {
    cues.push("Headline changed; confirm it still matches the deck narrative.");
  }

  if (wordDelta !== null && wordDelta >= 10) {
    cues.push("Candidate adds visible text; check wrapping and slide density.");
  } else if (wordDelta !== null && wordDelta <= -10) {
    cues.push("Candidate removes visible text; check whether key claims remain.");
  }

  if (contentAreas >= 3) {
    cues.push("Several content areas move together; compare the visual hierarchy.");
  }

  if (structuredComparison && structuredComparison.groups.includes("family")) {
    cues.push("Slide family changes can drop incompatible fields; inspect the JSON diff before applying.");
  }

  return {
    contentAreas,
    cues,
    fieldChanges,
    focusItems,
    scale,
    wordDelta
  };
}
