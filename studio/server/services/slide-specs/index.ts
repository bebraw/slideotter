function escapeString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"");
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value, label) {
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

function assertOptionalLayout(value, label) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  assertString(value, label);

  if (!allowedSlideLayouts.has(value)) {
    throw new Error(`${label} must be one of: ${Array.from(allowedSlideLayouts).join(", ")}`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
}

function assertArray(value, label, exactLength) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  if (typeof exactLength === "number" && value.length !== exactLength) {
    throw new Error(`${label} must contain ${exactLength} items`);
  }
}

function assertCardItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);
  assertString(item.title, `${label}.title`);
  assertString(item.body, `${label}.body`);
}

function assertSignalItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);

  if (item.title !== undefined || item.body !== undefined) {
    assertString(item.title, `${label}.title`);
    assertString(item.body, `${label}.body`);
    return;
  }

  assertString(item.label, `${label}.label`);
  assertNumber(item.value, `${label}.value`);
}

function assertGuardrailItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);

  if (item.title !== undefined || item.body !== undefined) {
    assertString(item.title, `${label}.title`);
    assertString(item.body, `${label}.body`);
    return;
  }

  assertString(item.label, `${label}.label`);
  assertString(item.value, `${label}.value`);
}

function assertResourceItem(item, label) {
  assertObject(item, label);
  assertString(item.id, `${label}.id`);
  assertString(item.title, `${label}.title`);
  assertString(item.body, `${label}.body`);

  if (item.bodyFontSize !== undefined) {
    assertNumber(item.bodyFontSize, `${label}.bodyFontSize`);
  }
}

function assertMediaItem(item, label) {
  if (item === undefined || item === null) {
    return;
  }

  assertObject(item, label);
  assertString(item.id, `${label}.id`);
  assertString(item.src, `${label}.src`);
  assertString(item.alt, `${label}.alt`);

  if (item.title !== undefined) {
    assertString(item.title, `${label}.title`);
  }

  if (item.caption !== undefined) {
    assertString(item.caption, `${label}.caption`);
  }

  if (item.source !== undefined) {
    assertString(item.source, `${label}.source`);
  }

  if (item.materialId !== undefined) {
    assertString(item.materialId, `${label}.materialId`);
  }
}

function assertRequiredMediaItem(item, label) {
  assertMediaItem(item, label);
  if (item === undefined || item === null) {
    throw new Error(`${label} must be an object`);
  }
}

function assertMediaItems(items, label) {
  if (items === undefined || items === null) {
    return;
  }

  assertArray(items, label, undefined);
  items.forEach((item, index) => {
    assertRequiredMediaItem(item, `${label}[${index}]`);
  });
}

function assertMediaItemsRange(items, label, minLength, maxLength) {
  assertMediaItems(items, label);
  if (!Array.isArray(items) || items.length < minLength || items.length > maxLength) {
    throw new Error(`${label} must contain ${minLength}-${maxLength} items`);
  }
}

function assertOptionalString(value, label) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  assertString(value, label);
}

function validateSlideSpec(spec) {
  assertObject(spec, "slideSpec");
  assertString(spec.type, "slideSpec.type");
  assertString(spec.title, "slideSpec.title");
  assertOptionalLayout(spec.layout, "slideSpec.layout");
  assertMediaItem(spec.media, "slideSpec.media");
  assertMediaItems(spec.mediaItems, "slideSpec.mediaItems");

  switch (spec.type) {
    case "divider":
      break;
    case "quote":
      assertString(spec.quote, "slideSpec.quote");
      assertOptionalString(spec.attribution, "slideSpec.attribution");
      assertOptionalString(spec.source, "slideSpec.source");
      assertOptionalString(spec.context, "slideSpec.context");
      break;
    case "photo":
      assertRequiredMediaItem(spec.media, "slideSpec.media");
      assertOptionalString(spec.caption, "slideSpec.caption");
      break;
    case "photoGrid":
      assertMediaItemsRange(spec.mediaItems, "slideSpec.mediaItems", 2, 4);
      assertOptionalString(spec.caption, "slideSpec.caption");
      assertOptionalString(spec.summary, "slideSpec.summary");
      break;
    case "cover":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.note, "slideSpec.note");
      assertArray(spec.cards, "slideSpec.cards", 3);
      spec.cards.forEach((item, index) => assertCardItem(item, `slideSpec.cards[${index}]`));
      break;
    case "toc":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.note, "slideSpec.note");
      assertArray(spec.cards, "slideSpec.cards", 3);
      spec.cards.forEach((item, index) => assertCardItem(item, `slideSpec.cards[${index}]`));
      break;
    case "content":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.signalsTitle, "slideSpec.signalsTitle");
      assertString(spec.guardrailsTitle, "slideSpec.guardrailsTitle");
      assertArray(spec.signals, "slideSpec.signals", 4);
      assertArray(spec.guardrails, "slideSpec.guardrails", 3);
      spec.signals.forEach((item, index) => assertSignalItem(item, `slideSpec.signals[${index}]`));
      spec.guardrails.forEach((item, index) => assertGuardrailItem(item, `slideSpec.guardrails[${index}]`));
      break;
    case "summary":
      assertString(spec.eyebrow, "slideSpec.eyebrow");
      assertString(spec.summary, "slideSpec.summary");
      assertString(spec.resourcesTitle, "slideSpec.resourcesTitle");
      assertArray(spec.bullets, "slideSpec.bullets", 3);
      assertArray(spec.resources, "slideSpec.resources", 2);
      spec.bullets.forEach((item, index) => assertCardItem(item, `slideSpec.bullets[${index}]`));
      spec.resources.forEach((item, index) => assertResourceItem(item, `slideSpec.resources[${index}]`));
      break;
    default:
      throw new Error(`Unsupported slide spec type "${spec.type}"`);
  }

  return spec;
}

function replaceConstArray(source, constName, items) {
  const pattern = new RegExp(`const ${constName} = \\[[\\s\\S]*?\\n\\];`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find array constant ${constName}`);
  }

  const body = items.map((item) => {
    const lines = Object.entries(item).map(([key, value], index, entries) => {
      if (typeof value === "number") {
        return `    ${key}: ${value}${index < entries.length - 1 ? "," : ""}`;
      }

      return `    ${key}: "${escapeString(value)}"${index < entries.length - 1 ? "," : ""}`;
    });

    return ["  {", ...lines, "  }"].join("\n");
  }).join(",\n");

  return source.replace(pattern, `const ${constName} = [\n${body}\n];`);
}

function replaceSlideTitle(source, nextTitle) {
  return source.replace(
    /(const slideConfig = \{[\s\S]*?title:\s*")([^"]*)(")/,
    `$1${escapeString(nextTitle)}$3`
  );
}

function replaceSectionTitle(source, eyebrow, body) {
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

function replaceAddTextValue(source, id, nextText) {
  const pattern = new RegExp(`(canvas\\.addText\\("${id}",\\s*")([^"]*)(")`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find text block ${id}`);
  }

  return source.replace(pattern, `$1${escapeString(nextText)}$3`);
}

function readArrayConstant(source, constName) {
  const pattern = new RegExp(`const ${constName} = (\\[[\\s\\S]*?\\n\\]);`);
  const match = source.match(pattern);

  if (!match) {
    throw new Error(`Could not read array constant ${constName}`);
  }

  return Function(`"use strict"; return (${match[1]});`)();
}

function readSlideTitle(source) {
  const match = source.match(/const slideConfig = \{[\s\S]*?title:\s*"([^"]+)"/);
  if (!match) {
    throw new Error("Could not read slide title");
  }

  return match[1];
}

function readTextBlockValue(source, id) {
  const pattern = new RegExp(`canvas\\.addText\\("${id}",\\s*"([^"]*)"`);
  const match = source.match(pattern);

  if (!match) {
    throw new Error(`Could not read text block ${id}`);
  }

  return match[1];
}

function readSectionTitle(source) {
  const pattern = /addSectionTitle\(\s*canvas,\s*theme,\s*"([^"]*)",\s*slideConfig\.title,\s*"([^"]*)"\s*\)/;
  const match = source.match(pattern);

  if (!match) {
    throw new Error("Could not read addSectionTitle values");
  }

  return {
    eyebrow: match[1],
    summary: match[2]
  };
}

function extractSlideTypeFromSource(source) {
  const match = source.match(/type:\s*"([^"]+)"/);
  return match ? match[1] : "unknown";
}

function extractSlideSpec(source) {
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

function buildDividerSource(source, slideSpec) {
  return replaceSlideTitle(source, slideSpec.title);
}

function buildCoverSource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceConstArray(next, "capabilityCards", slideSpec.cards);
  next = replaceAddTextValue(next, "cover-eyebrow", slideSpec.eyebrow);
  next = replaceAddTextValue(next, "cover-summary", slideSpec.summary);
  next = replaceAddTextValue(next, "cover-footnote", slideSpec.note);
  return next;
}

function buildTocSource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "outlineCards", slideSpec.cards);
  next = replaceAddTextValue(next, "outline-note", slideSpec.note);
  return next;
}

function buildContentSource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "signalBars", slideSpec.signals);
  next = replaceConstArray(next, "guardrails", slideSpec.guardrails);
  next = replaceAddTextValue(next, "content-signals-title", slideSpec.signalsTitle);
  next = replaceAddTextValue(next, "content-guardrails-title", slideSpec.guardrailsTitle);
  return next;
}

function buildSummarySource(source, slideSpec) {
  let next = replaceSlideTitle(source, slideSpec.title);
  next = replaceSectionTitle(next, slideSpec.eyebrow, slideSpec.summary);
  next = replaceConstArray(next, "checklistItems", slideSpec.bullets);
  next = replaceConstArray(next, "resourceCards", slideSpec.resources);
  next = replaceAddTextValue(next, "summary-resources-title", slideSpec.resourcesTitle);
  return next;
}

function materializeSlideSpec(source, slideSpec) {
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

module.exports = {
  extractSlideSpec,
  extractSlideTypeFromSource,
  materializeSlideSpec,
  validateSlideSpec
};
