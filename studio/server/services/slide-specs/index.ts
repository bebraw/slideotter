type JsonRecord = Record<string, unknown>;

import { assertSlideJsonMatchesSchema, getSlideSpecJsonSchema } from "./schema.ts";
import { sanitizeSvg } from "../custom-visuals.ts";

type SlideSpecItem = JsonRecord & {
  body?: unknown;
  bodyFontSize?: unknown;
  id?: unknown;
  label?: unknown;
  title?: unknown;
  value?: unknown;
};

type MediaItem = JsonRecord & {
  alt?: unknown;
  caption?: unknown;
  id?: unknown;
  materialId?: unknown;
  source?: unknown;
  src?: unknown;
  title?: unknown;
};

type SlideSpec = JsonRecord & {
  attribution?: unknown;
  bullets?: unknown;
  caption?: unknown;
  cards?: unknown;
  context?: unknown;
  customVisual?: unknown;
  eyebrow?: unknown;
  guardrails?: unknown;
  guardrailsTitle?: unknown;
  layout?: unknown;
  media?: unknown;
  mediaItems?: unknown;
  note?: unknown;
  quote?: unknown;
  resources?: unknown;
  resourcesTitle?: unknown;
  signals?: unknown;
  signalsTitle?: unknown;
  source?: unknown;
  summary?: unknown;
  title: string;
  type: string;
};

type MaterializedArrayItem = Record<string, string | number>;

function asRecord(value: unknown, label: string): JsonRecord {
  assertObject(value, label);
  return value;
}

function escapeString(value: unknown): string {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"");
}

function assertObject(value: unknown, label: string): asserts value is JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

const allowedSlideLayouts = new Set([
  "callout",
  "checklist",
  "focus",
  "standard",
  "steps",
  "strip"
]);

function assertOptionalLayout(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  assertString(value, label);

  if (!allowedSlideLayouts.has(value)) {
    throw new Error(`${label} must be one of: ${Array.from(allowedSlideLayouts).join(", ")}`);
  }
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}

function assertArray(value: unknown, label: string, exactLength?: number): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  if (typeof exactLength === "number" && value.length !== exactLength) {
    throw new Error(`${label} must contain ${exactLength} items`);
  }
}

function assertCardItem(item: unknown, label: string) {
  const record = asRecord(item, label) as SlideSpecItem;
  assertString(record.id, `${label}.id`);
  assertString(record.title, `${label}.title`);
  assertString(record.body, `${label}.body`);
}

function assertSignalItem(item: unknown, label: string) {
  const record = asRecord(item, label) as SlideSpecItem;
  assertString(record.id, `${label}.id`);

  if (record.title !== undefined || record.body !== undefined) {
    assertString(record.title, `${label}.title`);
    assertString(record.body, `${label}.body`);
    return;
  }

  assertString(record.label, `${label}.label`);
  assertNumber(record.value, `${label}.value`);
}

function assertGuardrailItem(item: unknown, label: string) {
  const record = asRecord(item, label) as SlideSpecItem;
  assertString(record.id, `${label}.id`);

  if (record.title !== undefined || record.body !== undefined) {
    assertString(record.title, `${label}.title`);
    assertString(record.body, `${label}.body`);
    return;
  }

  assertString(record.label, `${label}.label`);
  assertString(record.value, `${label}.value`);
}

function assertResourceItem(item: unknown, label: string) {
  const record = asRecord(item, label) as SlideSpecItem;
  assertString(record.id, `${label}.id`);
  assertString(record.title, `${label}.title`);
  assertString(record.body, `${label}.body`);

  if (record.bodyFontSize !== undefined) {
    assertNumber(record.bodyFontSize, `${label}.bodyFontSize`);
  }
}

function assertMediaItem(item: unknown, label: string) {
  if (item === undefined || item === null) {
    return;
  }

  const record = asRecord(item, label) as MediaItem;
  assertString(record.id, `${label}.id`);
  assertString(record.src, `${label}.src`);
  assertString(record.alt, `${label}.alt`);

  if (record.title !== undefined) {
    assertString(record.title, `${label}.title`);
  }

  if (record.caption !== undefined) {
    assertString(record.caption, `${label}.caption`);
  }

  if (record.source !== undefined) {
    assertString(record.source, `${label}.source`);
  }

  if (record.materialId !== undefined) {
    assertString(record.materialId, `${label}.materialId`);
  }
}

function assertRequiredMediaItem(item: unknown, label: string) {
  assertMediaItem(item, label);
  if (item === undefined || item === null) {
    throw new Error(`${label} must be an object`);
  }
}

function assertMediaItems(items: unknown, label: string) {
  if (items === undefined || items === null) {
    return;
  }

  assertArray(items, label, undefined);
  items.forEach((item, index) => {
    assertRequiredMediaItem(item, `${label}[${index}]`);
  });
}

function assertMediaItemsRange(items: unknown, label: string, minLength: number, maxLength: number) {
  assertMediaItems(items, label);
  if (!Array.isArray(items) || items.length < minLength || items.length > maxLength) {
    throw new Error(`${label} must contain ${minLength}-${maxLength} items`);
  }
}

function assertOptionalString(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  assertString(value, label);
}

function assertCustomVisualReference(value: unknown, label: string) {
  if (value === undefined || value === null) {
    return;
  }

  const record = asRecord(value, label);
  assertString(record.id, `${label}.id`);

  if (record.title !== undefined) {
    assertString(record.title, `${label}.title`);
  }
  if (record.description !== undefined) {
    assertString(record.description, `${label}.description`);
  }
  if (record.role !== undefined) {
    assertString(record.role, `${label}.role`);
  }
  if (record.content !== undefined) {
    assertString(record.content, `${label}.content`);
    sanitizeSvg(record.content);
  }
}

function validateSlideSpec(spec: unknown): SlideSpec {
  assertSlideJsonMatchesSchema(spec, "slideSpec");
  const slideSpec = asRecord(spec, "slideSpec") as Partial<SlideSpec>;
  assertString(slideSpec.type, "slideSpec.type");
  assertString(slideSpec.title, "slideSpec.title");
  assertOptionalLayout(slideSpec.layout, "slideSpec.layout");
  assertCustomVisualReference(slideSpec.customVisual, "slideSpec.customVisual");
  assertMediaItem(slideSpec.media, "slideSpec.media");
  assertMediaItems(slideSpec.mediaItems, "slideSpec.mediaItems");

  switch (slideSpec.type) {
    case "divider":
      break;
    case "quote":
      assertString(slideSpec.quote, "slideSpec.quote");
      assertOptionalString(slideSpec.attribution, "slideSpec.attribution");
      assertOptionalString(slideSpec.source, "slideSpec.source");
      assertOptionalString(slideSpec.context, "slideSpec.context");
      break;
    case "photo":
      assertRequiredMediaItem(slideSpec.media, "slideSpec.media");
      assertOptionalString(slideSpec.caption, "slideSpec.caption");
      break;
    case "photoGrid":
      assertMediaItemsRange(slideSpec.mediaItems, "slideSpec.mediaItems", 2, 4);
      assertOptionalString(slideSpec.caption, "slideSpec.caption");
      assertOptionalString(slideSpec.summary, "slideSpec.summary");
      break;
    case "cover":
      assertString(slideSpec.eyebrow, "slideSpec.eyebrow");
      assertString(slideSpec.summary, "slideSpec.summary");
      assertString(slideSpec.note, "slideSpec.note");
      assertArray(slideSpec.cards, "slideSpec.cards", 3);
      slideSpec.cards.forEach((item, index) => assertCardItem(item, `slideSpec.cards[${index}]`));
      break;
    case "toc":
      assertString(slideSpec.eyebrow, "slideSpec.eyebrow");
      assertString(slideSpec.summary, "slideSpec.summary");
      assertString(slideSpec.note, "slideSpec.note");
      assertArray(slideSpec.cards, "slideSpec.cards", 3);
      slideSpec.cards.forEach((item, index) => assertCardItem(item, `slideSpec.cards[${index}]`));
      break;
    case "content":
      assertString(slideSpec.eyebrow, "slideSpec.eyebrow");
      assertString(slideSpec.summary, "slideSpec.summary");
      assertString(slideSpec.signalsTitle, "slideSpec.signalsTitle");
      assertString(slideSpec.guardrailsTitle, "slideSpec.guardrailsTitle");
      assertArray(slideSpec.signals, "slideSpec.signals", 4);
      assertArray(slideSpec.guardrails, "slideSpec.guardrails", 3);
      slideSpec.signals.forEach((item, index) => assertSignalItem(item, `slideSpec.signals[${index}]`));
      slideSpec.guardrails.forEach((item, index) => assertGuardrailItem(item, `slideSpec.guardrails[${index}]`));
      break;
    case "summary":
      assertString(slideSpec.eyebrow, "slideSpec.eyebrow");
      assertString(slideSpec.summary, "slideSpec.summary");
      assertString(slideSpec.resourcesTitle, "slideSpec.resourcesTitle");
      assertArray(slideSpec.bullets, "slideSpec.bullets", 3);
      assertArray(slideSpec.resources, "slideSpec.resources", 2);
      slideSpec.bullets.forEach((item, index) => assertCardItem(item, `slideSpec.bullets[${index}]`));
      slideSpec.resources.forEach((item, index) => assertResourceItem(item, `slideSpec.resources[${index}]`));
      break;
    default:
      throw new Error(`Unsupported slide spec type "${slideSpec.type}"`);
  }

  return slideSpec as SlideSpec;
}

function replaceConstArray(source: string, constName: string, items: unknown): string {
  assertArray(items, constName);
  const pattern = new RegExp(`const ${constName} = \\[[\\s\\S]*?\\n\\];`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find array constant ${constName}`);
  }

  const body = items.map((item) => {
    const record = asRecord(item, `${constName} item`) as MaterializedArrayItem;
    const lines = Object.entries(record).map(([key, value], index, entries) => {
      if (typeof value === "number") {
        return `    ${key}: ${value}${index < entries.length - 1 ? "," : ""}`;
      }

      return `    ${key}: "${escapeString(value)}"${index < entries.length - 1 ? "," : ""}`;
    });

    return ["  {", ...lines, "  }"].join("\n");
  }).join(",\n");

  return source.replace(pattern, `const ${constName} = [\n${body}\n];`);
}

function replaceSlideTitle(source: string, nextTitle: string): string {
  return source.replace(
    /(const slideConfig = \{[\s\S]*?title:\s*")([^"]*)(")/,
    `$1${escapeString(nextTitle)}$3`
  );
}

function replaceSectionTitle(source: string, eyebrow: unknown, body: unknown): string {
  const pattern = /addSectionTitle\(\s*canvas,\s*theme,\s*"[^"]*",\s*slideConfig\.title,\s*"[^"]*"\s*\)/;
  if (!pattern.test(source)) {
    throw new Error("Could not find addSectionTitle call");
  }

  return source.replace(pattern, [
    "addSectionTitle(",
    "    canvas,",
    "    theme,",
    `    "${escapeString(eyebrow)}",`,
    "    slideConfig.title,",
    `    "${escapeString(body)}"`,
    "  )"
  ].join("\n"));
}

function replaceAddTextValue(source: string, id: string, nextText: unknown): string {
  const pattern = new RegExp(`(canvas\\.addText\\("${id}",\\s*")([^"]*)(")`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find text block ${id}`);
  }

  return source.replace(pattern, `$1${escapeString(nextText)}$3`);
}

function readArrayConstant(source: string, constName: string): unknown[] {
  const pattern = new RegExp(`const ${constName} = (\\[[\\s\\S]*?\\n\\]);`);
  const match = source.match(pattern);

  if (!match) {
    throw new Error(`Could not read array constant ${constName}`);
  }

  const rawArraySource = match[1];
  if (!rawArraySource) {
    throw new Error(`Could not read array constant ${constName}`);
  }
  const parsed = Function(`"use strict"; return (${rawArraySource});`)();
  assertArray(parsed, constName);
  return parsed;
}

function readSlideTitle(source: string): string {
  const match = source.match(/const slideConfig = \{[\s\S]*?title:\s*"([^"]+)"/);
  if (!match || !match[1]) {
    throw new Error("Could not read slide title");
  }

  return match[1];
}

function readTextBlockValue(source: string, id: string): string {
  const pattern = new RegExp(`canvas\\.addText\\("${id}",\\s*"([^"]*)"`);
  const match = source.match(pattern);

  if (!match || match[1] === undefined) {
    throw new Error(`Could not read text block ${id}`);
  }

  return match[1];
}

function readSectionTitle(source: string) {
  const pattern = /addSectionTitle\(\s*canvas,\s*theme,\s*"([^"]*)",\s*slideConfig\.title,\s*"([^"]*)"\s*\)/;
  const match = source.match(pattern);

  if (!match || match[1] === undefined || match[2] === undefined) {
    throw new Error("Could not read addSectionTitle values");
  }

  return {
    eyebrow: match[1],
    summary: match[2]
  };
}

function extractSlideTypeFromSource(source: string): string {
  const match = source.match(/type:\s*"([^"]+)"/);
  return match && match[1] ? match[1] : "unknown";
}

function extractSlideSpec(source: string): SlideSpec {
  const type = extractSlideTypeFromSource(source);
  const title = readSlideTitle(source);

  switch (type) {
    case "divider":
      return validateSlideSpec({
        title,
        type
      });
    case "cover":
      return validateSlideSpec({
        cards: readArrayConstant(source, "capabilityCards"),
        eyebrow: readTextBlockValue(source, "cover-eyebrow"),
        note: readTextBlockValue(source, "cover-footnote"),
        summary: readTextBlockValue(source, "cover-summary"),
        title,
        type
      });
    case "toc": {
      const section = readSectionTitle(source);
      return validateSlideSpec({
        cards: readArrayConstant(source, "outlineCards"),
        eyebrow: section.eyebrow,
        note: readTextBlockValue(source, "outline-note"),
        summary: section.summary,
        title,
        type
      });
    }
    case "content": {
      const section = readSectionTitle(source);
      return validateSlideSpec({
        eyebrow: section.eyebrow,
        guardrails: readArrayConstant(source, "guardrails"),
        guardrailsTitle: readTextBlockValue(source, "content-guardrails-title"),
        signals: readArrayConstant(source, "signalBars"),
        signalsTitle: readTextBlockValue(source, "content-signals-title"),
        summary: section.summary,
        title,
        type
      });
    }
    case "summary": {
      const section = readSectionTitle(source);
      return validateSlideSpec({
        bullets: readArrayConstant(source, "checklistItems"),
        eyebrow: section.eyebrow,
        resources: readArrayConstant(source, "resourceCards"),
        resourcesTitle: readTextBlockValue(source, "summary-resources-title"),
        summary: section.summary,
        title,
        type
      });
    }
    default:
      throw new Error(`Unsupported slide spec extraction for type "${type}"`);
  }
}

function buildDividerSource(source: string, slideSpec: SlideSpec): string {
  return replaceSlideTitle(source, slideSpec.title);
}

function buildCoverSource(source: string, slideSpec: SlideSpec): string {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceConstArray(next, "capabilityCards", slideSpec.cards);
  next = replaceAddTextValue(next, "cover-eyebrow", slideSpec.eyebrow);
  next = replaceAddTextValue(next, "cover-summary", slideSpec.summary);
  next = replaceAddTextValue(next, "cover-footnote", slideSpec.note);
  return next;
}

function buildTocSource(source: string, slideSpec: SlideSpec): string {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "outlineCards", slideSpec.cards);
  next = replaceAddTextValue(next, "outline-note", slideSpec.note);
  return next;
}

function buildContentSource(source: string, slideSpec: SlideSpec): string {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "signalBars", slideSpec.signals);
  next = replaceConstArray(next, "guardrails", slideSpec.guardrails);
  next = replaceAddTextValue(next, "content-signals-title", slideSpec.signalsTitle);
  next = replaceAddTextValue(next, "content-guardrails-title", slideSpec.guardrailsTitle);
  return next;
}

function buildSummarySource(source: string, slideSpec: SlideSpec): string {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "checklistItems", slideSpec.bullets);
  next = replaceConstArray(next, "resourceCards", slideSpec.resources);
  next = replaceAddTextValue(next, "summary-resources-title", slideSpec.resourcesTitle);
  return next;
}

function materializeSlideSpec(source: string, slideSpec: unknown): string {
  const validated = validateSlideSpec(slideSpec);
  const sourceType = extractSlideTypeFromSource(source);

  if (validated.type !== sourceType) {
    throw new Error(`Slide spec type "${validated.type}" does not match source type "${sourceType}"`);
  }

  switch (validated.type) {
    case "divider":
      return buildDividerSource(source, validated);
    case "quote":
      return source;
    case "photo":
      return source;
    case "photoGrid":
      return source;
    case "cover":
      return buildCoverSource(source, validated);
    case "toc":
      return buildTocSource(source, validated);
    case "content":
      return buildContentSource(source, validated);
    case "summary":
      return buildSummarySource(source, validated);
    default:
      throw new Error(`Unsupported slide spec type "${validated.type}"`);
  }
}

export {
  getSlideSpecJsonSchema,
  extractSlideSpec,
  extractSlideTypeFromSource,
  materializeSlideSpec,
  validateSlideSpec
};