import {
  hasDanglingEnding,
  isAuthoringMetaText,
  isKnownBadTranslation,
  isScaffoldLeak,
  isUnsupportedBibliographicClaim,
  isWeakLabel
} from "./generated-text-hygiene.ts";
import { normalizeVisibleText } from "./generated-visible-text-normalization.ts";
import { isSlideItem } from "./generated-slide-shape-guards.ts";
import {
  isCopiedInstructionLikeText,
  isPromptLeakText,
  isSemanticLengthPlanningText
} from "./visible-text-quarantine-rules.ts";
import type { JsonObject, SlideItem } from "./generated-slide-types.ts";

export {
  isSemanticLengthLeak
} from "./visible-text-quarantine-rules.ts";

export type VisibleTextIssueCode =
  | "authoring-meta"
  | "copied-instruction"
  | "dangling-fragment"
  | "ellipsis-truncation"
  | "fallback-scaffold"
  | "known-bad-translation"
  | "near-duplicate-visible-text"
  | "planning-language"
  | "prompt-leak"
  | "schema-label"
  | "unsupported-bibliographic-claim"
  | "weak-label"
  | "workflow-rationale";

export type VisibleFieldRole =
  | "alt"
  | "body"
  | "caption"
  | "context"
  | "eyebrow"
  | "note"
  | "quote"
  | "summary"
  | "title";

export type VisibleTextField = {
  path: string;
  role: VisibleFieldRole;
  value: unknown;
};

export type VisibleTextIssue = {
  code: VisibleTextIssueCode;
  fieldPath: string;
  fieldRole: VisibleFieldRole;
  message: string;
  text: string;
};

export type PublicVisibleTextIssue = Omit<VisibleTextIssue, "text">;

type VisibleTextRule = {
  code: VisibleTextIssueCode;
  matches: (text: string, rawValue: unknown) => boolean;
  message: string;
};

const VISIBLE_TEXT_RULES: readonly VisibleTextRule[] = [
  {
    code: "weak-label",
    matches: (text) => isWeakLabel(text),
    message: "Visible text is only a weak schema-like label."
  },
  {
    code: "schema-label",
    matches: (_text, rawValue) => /\b(title|summary|body):\s*$/i.test(String(rawValue)),
    message: "Visible text leaks a schema field label."
  },
  {
    code: "fallback-scaffold",
    matches: (text) => isScaffoldLeak(text),
    message: "Visible text leaks scaffold or fallback copy."
  },
  {
    code: "authoring-meta",
    matches: (text) => isAuthoringMetaText(text),
    message: "Visible text leaks authoring or review instructions."
  },
  {
    code: "prompt-leak",
    matches: (text) => isPromptLeakText(text),
    message: "Visible text leaks prompt, role, schema, or hidden instruction context."
  },
  {
    code: "copied-instruction",
    matches: (text) => isCopiedInstructionLikeText(text),
    message: "Visible text copied instruction-like or executable source content."
  },
  {
    code: "ellipsis-truncation",
    matches: (_text, rawValue) => /\.{3,}|…/.test(String(rawValue)),
    message: "Visible text appears ellipsis-truncated."
  },
  {
    code: "dangling-fragment",
    matches: (text) => hasDanglingEnding(text),
    message: "Visible text ends as an incomplete fragment."
  },
  {
    code: "unsupported-bibliographic-claim",
    matches: (text) => isUnsupportedBibliographicClaim(text),
    message: "Visible text looks like an unsupported bibliographic claim."
  },
  {
    code: "known-bad-translation",
    matches: (text) => isKnownBadTranslation(text),
    message: "Visible text contains a known bad translation."
  },
  {
    code: "planning-language",
    matches: (text) => isSemanticLengthPlanningText(text),
    message: "Visible text leaks semantic deck-length planning language."
  }
];

export class VisibleTextQualityError extends Error {
  code: VisibleTextIssueCode;
  fieldPath: string;
  fieldRole: VisibleFieldRole;
  issues: PublicVisibleTextIssue[];

  constructor(label: string, issues: VisibleTextIssue[]) {
    const issue = issues[0];
    super(issue
      ? `Visible text quarantine blocked ${label}: ${issue.code} at ${issue.fieldPath}`
      : `Visible text quarantine blocked ${label}.`);
    this.name = "VisibleTextQualityError";
    this.code = issue ? issue.code : "weak-label";
    this.fieldPath = issue ? issue.fieldPath : "";
    this.fieldRole = issue ? issue.fieldRole : "body";
    this.issues = issues.map(({ text: _text, ...publicIssue }) => publicIssue);
  }

  // fallow-ignore-next-line unused-class-member
  toJSON(): {
    code: VisibleTextIssueCode;
    fieldPath: string;
    fieldRole: VisibleFieldRole;
    issues: PublicVisibleTextIssue[];
    message: string;
    name: string;
  } {
    return {
      code: this.code,
      fieldPath: this.fieldPath,
      fieldRole: this.fieldRole,
      issues: this.issues,
      message: this.message,
      name: this.name
    };
  }
}

export type VisibleSlideSpec = JsonObject & {
  bullets?: unknown;
  cards?: unknown;
  context?: unknown;
  eyebrow?: unknown;
  guardrails?: unknown;
  guardrailsTitle?: unknown;
  media?: unknown;
  mediaItems?: unknown;
  narration?: unknown;
  note?: unknown;
  quote?: unknown;
  resources?: unknown;
  resourcesTitle?: unknown;
  signals?: unknown;
  signalsTitle?: unknown;
  summary?: unknown;
  title?: unknown;
};

function field(path: string, role: VisibleFieldRole, value: unknown): VisibleTextField {
  return { path, role, value };
}

function collectItems(value: unknown): SlideItem[] {
  return Array.isArray(value) ? value.filter(isSlideItem) : [];
}

function collectItemFields(items: SlideItem[], path: string): VisibleTextField[] {
  return items.flatMap((item, index) => [
    field(`${path}.${index}.title`, "title", item.title),
    field(`${path}.${index}.body`, "body", item.body)
  ]);
}

function mediaField(value: unknown, key: "alt" | "caption"): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)[key]
    : undefined;
}

function narrationField(value: unknown, key: "script"): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)[key]
    : undefined;
}

export function collectVisibleTextFields(slideSpec: VisibleSlideSpec): VisibleTextField[] {
  const cards = collectItems(slideSpec.cards);
  const signals = collectItems(slideSpec.signals);
  const guardrails = collectItems(slideSpec.guardrails);
  const bullets = collectItems(slideSpec.bullets);
  const resources = collectItems(slideSpec.resources);
  const mediaItems = collectItems(slideSpec.mediaItems);

  return [
    field("eyebrow", "eyebrow", slideSpec.eyebrow),
    field("title", "title", slideSpec.title),
    field("summary", "summary", slideSpec.summary),
    field("note", "note", slideSpec.note),
    field("context", "context", slideSpec.context),
    field("quote", "quote", slideSpec.quote),
    field("signalsTitle", "title", slideSpec.signalsTitle),
    field("guardrailsTitle", "title", slideSpec.guardrailsTitle),
    field("resourcesTitle", "title", slideSpec.resourcesTitle),
    field("media.alt", "alt", mediaField(slideSpec.media, "alt")),
    field("media.caption", "caption", mediaField(slideSpec.media, "caption")),
    field("narration.script", "note", narrationField(slideSpec.narration, "script")),
    ...collectItemFields(cards, "cards"),
    ...collectItemFields(signals, "signals"),
    ...collectItemFields(guardrails, "guardrails"),
    ...collectItemFields(bullets, "bullets"),
    ...collectItemFields(resources, "resources"),
    ...collectItemFields(mediaItems, "mediaItems")
  ].filter((entry) => Boolean(entry.value));
}

export function collectVisibleItems(slideSpec: VisibleSlideSpec): SlideItem[] {
  return [
    collectItems(slideSpec.cards),
    collectItems(slideSpec.signals),
    collectItems(slideSpec.guardrails),
    collectItems(slideSpec.bullets),
    collectItems(slideSpec.resources),
    collectItems(slideSpec.mediaItems)
  ].flat();
}

export function visibleItemSignature(item: SlideItem): string {
  return normalizeVisibleText([
    item.title,
    item.body
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function createVisibleTextIssue(fieldEntry: VisibleTextField, rule: VisibleTextRule, text: string): VisibleTextIssue {
  return {
    code: rule.code,
    fieldPath: fieldEntry.path,
    fieldRole: fieldEntry.role,
    message: rule.message,
    text
  };
}

export function classifyVisibleTextIssue(fieldEntry: VisibleTextField): VisibleTextIssue | null {
  const text = normalizeVisibleText(fieldEntry.value);
  if (!text) {
    return null;
  }

  const rule = VISIBLE_TEXT_RULES.find((entry) => entry.matches(text, fieldEntry.value));
  return rule ? createVisibleTextIssue(fieldEntry, rule, text) : null;
}

export function collectVisibleTextIssues(slideSpec: VisibleSlideSpec): VisibleTextIssue[] {
  return collectVisibleTextFields(slideSpec)
    .map(classifyVisibleTextIssue)
    .filter((issue): issue is VisibleTextIssue => Boolean(issue));
}

export function assertVisibleSlideTextQuality<T extends VisibleSlideSpec>(slideSpec: T, label = "slide"): T {
  const issues = collectVisibleTextIssues(slideSpec);
  if (issues.length) {
    throw new VisibleTextQualityError(label, issues);
  }

  return slideSpec;
}
