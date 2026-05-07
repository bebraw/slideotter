import {
  hasDanglingEnding,
  isAuthoringMetaText,
  isKnownBadTranslation,
  isScaffoldLeak,
  isUnsupportedBibliographicClaim,
  isWeakLabel,
  normalizeVisibleText
} from "./generated-text-hygiene.ts";
import { isSlideItem } from "./generated-slide-shape-guards.ts";
import type { JsonObject, SlideItem } from "./generated-slide-types.ts";

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

export class VisibleTextQualityError extends Error {
  code: VisibleTextIssueCode;
  fieldPath: string;
  fieldRole: VisibleFieldRole;
  issues: VisibleTextIssue[];
  publicIssues: PublicVisibleTextIssue[];

  constructor(label: string, issues: VisibleTextIssue[]) {
    const issue = issues[0];
    super(issue
      ? `Visible text quarantine blocked ${label}: ${issue.code} at ${issue.fieldPath}`
      : `Visible text quarantine blocked ${label}.`);
    this.name = "VisibleTextQualityError";
    this.code = issue ? issue.code : "weak-label";
    this.fieldPath = issue ? issue.fieldPath : "";
    this.fieldRole = issue ? issue.fieldRole : "body";
    this.issues = issues;
    this.publicIssues = issues.map(({ text: _text, ...publicIssue }) => publicIssue);
  }

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
      issues: this.publicIssues,
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
  note?: unknown;
  quote?: unknown;
  resources?: unknown;
  resourcesTitle?: unknown;
  signals?: unknown;
  signalsTitle?: unknown;
  summary?: unknown;
  title?: unknown;
};

const semanticLengthLeakPatterns = [
  /\bcurrent deck\b/,
  /\btarget count\b/,
  /\bactive deck length\b/,
  /\bsemantic depth\b/,
  /\bsemantic length planning\b/,
  /\bdeck had room to expand\b/,
  /\binstead of stretching\b/,
  /\bwithout changing the deck\b/,
  /\bnot filler\b/,
  /\bexpansion rules\b/,
  /\bsection gets\b/,
  /\bgets one concrete example\b/,
  /\bdetail names what changes\b/,
  /\bpoint connects\b/,
  /\bconnects to the next slide\b/,
  /\bmoving forward\b/,
  /\bbefore the story moves on\b/
];

const promptLeakPatterns = [
  /\b(?:system|developer|user|assistant)\s+(?:prompt|message|instruction|instructions)\b/,
  /\b(?:developerprompt|systemprompt|userprompt|promptcontext|schemaname|response_format|json schema)\b/,
  /\b(?:as an ai|you are chatgpt|you are an ai|large language model)\b/,
  /\b(?:return|respond|output)\s+(?:only\s+)?(?:valid\s+)?json\b/,
  /\b(?:use|follow|obey)\s+(?:the\s+)?(?:schema|developer instructions|system instructions)\b/,
  /\b(?:do not|don't)\s+(?:mention|reveal|include|expose|show)\s+(?:the\s+)?(?:prompt|instructions|system message|developer message)\b/,
  /\b(?:internal|hidden)\s+(?:prompt|instruction|instructions|context|message|messages)\b/
];

const copiedInstructionPatterns = [
  /<\s*script\b/,
  /```/,
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/,
  /\boverride\s+(?:the\s+)?(?:system|developer|schema)\b/,
  /\bdo\s+not\s+follow\s+(?:the\s+)?(?:system|developer|schema)\b/,
  /\b(?:follow|execute|run)\s+(?:these|the following)\s+instructions\b/
];

function comparableText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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
    ...collectItemFields(cards, "cards"),
    ...collectItemFields(signals, "signals"),
    ...collectItemFields(guardrails, "guardrails"),
    ...collectItemFields(bullets, "bullets"),
    ...collectItemFields(resources, "resources"),
    ...collectItemFields(mediaItems, "mediaItems")
  ].filter((entry) => Boolean(entry.value));
}

export function collectVisibleText(slideSpec: VisibleSlideSpec): unknown[] {
  return collectVisibleTextFields(slideSpec).map((entry) => entry.value);
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

export function isSemanticLengthLeak(value: unknown): boolean {
  const text = normalizeVisibleText(value);
  const normalized = comparableText(text);
  if (!text || isWeakLabel(text) || isScaffoldLeak(text) || isAuthoringMetaText(text) || hasDanglingEnding(text)) {
    return true;
  }

  return semanticLengthLeakPatterns.some((pattern) => pattern.test(normalized));
}

export function isPromptLeakText(value: unknown): boolean {
  const text = normalizeVisibleText(value);
  if (!text) {
    return false;
  }

  return promptLeakPatterns.some((pattern) => pattern.test(text.toLowerCase()));
}

export function isCopiedInstructionLikeText(value: unknown): boolean {
  const text = normalizeVisibleText(value);
  if (!text) {
    return false;
  }

  return copiedInstructionPatterns.some((pattern) => pattern.test(text.toLowerCase()));
}

export function classifyVisibleTextIssue(fieldEntry: VisibleTextField): VisibleTextIssue | null {
  const text = normalizeVisibleText(fieldEntry.value);
  if (!text) {
    return null;
  }

  if (isWeakLabel(text)) {
    return {
      code: "weak-label",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text is only a weak schema-like label.",
      text
    };
  }

  if (/\b(title|summary|body):\s*$/i.test(String(fieldEntry.value))) {
    return {
      code: "schema-label",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text leaks a schema field label.",
      text
    };
  }

  if (isScaffoldLeak(text)) {
    return {
      code: "fallback-scaffold",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text leaks scaffold or fallback copy.",
      text
    };
  }

  if (isAuthoringMetaText(text)) {
    return {
      code: "authoring-meta",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text leaks authoring or review instructions.",
      text
    };
  }

  if (isPromptLeakText(text)) {
    return {
      code: "prompt-leak",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text leaks prompt, role, schema, or hidden instruction context.",
      text
    };
  }

  if (isCopiedInstructionLikeText(text)) {
    return {
      code: "copied-instruction",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text copied instruction-like or executable source content.",
      text
    };
  }

  if (/\.{3,}|…/.test(String(fieldEntry.value))) {
    return {
      code: "ellipsis-truncation",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text appears ellipsis-truncated.",
      text
    };
  }

  if (hasDanglingEnding(text)) {
    return {
      code: "dangling-fragment",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text ends as an incomplete fragment.",
      text
    };
  }

  if (isUnsupportedBibliographicClaim(text)) {
    return {
      code: "unsupported-bibliographic-claim",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text looks like an unsupported bibliographic claim.",
      text
    };
  }

  if (isKnownBadTranslation(text)) {
    return {
      code: "known-bad-translation",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text contains a known bad translation.",
      text
    };
  }

  if (semanticLengthLeakPatterns.some((pattern) => pattern.test(comparableText(text)))) {
    return {
      code: "planning-language",
      fieldPath: fieldEntry.path,
      fieldRole: fieldEntry.role,
      message: "Visible text leaks semantic deck-length planning language.",
      text
    };
  }

  return null;
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
