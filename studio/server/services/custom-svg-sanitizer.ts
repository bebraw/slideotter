const maxSvgCharacters = 256 * 1024;
const allowedTags = new Map<string, string>([
  ["circle", "circle"],
  ["clippath", "clipPath"],
  ["defs", "defs"],
  ["desc", "desc"],
  ["ellipse", "ellipse"],
  ["g", "g"],
  ["line", "line"],
  ["lineargradient", "linearGradient"],
  ["path", "path"],
  ["pattern", "pattern"],
  ["polygon", "polygon"],
  ["polyline", "polyline"],
  ["radialgradient", "radialGradient"],
  ["rect", "rect"],
  ["stop", "stop"],
  ["svg", "svg"],
  ["text", "text"],
  ["title", "title"],
  ["tspan", "tspan"],
]);
const allowedAttributes = new Set([
  "aria-label",
  "clip-path",
  "cx",
  "cy",
  "d",
  "dominant-baseline",
  "dx",
  "dy",
  "fill",
  "fill-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "gradientTransform",
  "gradientUnits",
  "height",
  "id",
  "offset",
  "opacity",
  "points",
  "preserveAspectRatio",
  "r",
  "role",
  "rx",
  "ry",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "transform",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2",
]);
const allowedColorNames = new Set([
  "black",
  "blue",
  "currentcolor",
  "gray",
  "green",
  "grey",
  "none",
  "orange",
  "purple",
  "red",
  "transparent",
  "white",
  "yellow",
]);
const urlReferencePattern = /^url\(\s*#[a-zA-Z][a-zA-Z0-9_-]*\s*\)$/;
const pathDataPattern = /^[a-zA-Z0-9.,+\-\s]+$/;
const transformPattern = /^[a-zA-Z0-9(),.+\-\s]+$/;
const numericPattern = /^[0-9.,+\-%\s]+$/;
const tokenTextPattern = /^[a-zA-Z0-9#().,;: %_+\-]+$/;
const numericAttributes = new Set([
  "dx",
  "dy",
  "font-size",
  "height",
  "offset",
  "opacity",
  "stroke-dasharray",
  "stroke-width",
  "viewBox",
  "width",
]);
const coordinateAttributePattern = /^[cr]?[xy]?[12]?$/;
const unsafeUrlMarkers = ["javascript:", "data:", "http:", "https:"];

type SanitizerState = {
  output: string[];
  stack: string[];
  sawRoot: boolean;
};

type AttributeValueValidator = (value: string) => boolean;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

function normalizeAttributeName(value: string): string {
  if (value === "viewbox") {
    return "viewBox";
  }
  if (value === "preserveaspectratio") {
    return "preserveAspectRatio";
  }
  if (value === "gradienttransform") {
    return "gradientTransform";
  }
  if (value === "gradientunits") {
    return "gradientUnits";
  }
  return value;
}

function isSafeColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    allowedColorNames.has(normalized) ||
    /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(normalized)
  );
}

function hasUnsafeUrl(value: string): boolean {
  return unsafeUrlMarkers.some((marker) => value.includes(marker));
}

function isNumericAttribute(name: string): boolean {
  return numericAttributes.has(name) || coordinateAttributePattern.test(name) || name.endsWith("opacity");
}

function isSafePaintValue(value: string): boolean {
  return isSafeColor(value) || urlReferencePattern.test(value);
}

function isSafeKeywordValue(value: string): boolean {
  return /^[a-zA-Z0-9 -]+$/.test(value);
}

const attributeValueValidators: Record<string, AttributeValueValidator> = {
  "aria-label": (value) => /^[a-zA-Z0-9 .,;:()/_-]+$/.test(value),
  "clip-path": (value) => urlReferencePattern.test(value),
  d: (value) => pathDataPattern.test(value),
  "dominant-baseline": isSafeKeywordValue,
  fill: isSafePaintValue,
  "font-family": (value) => /^[a-zA-Z0-9 "'.,-]+$/.test(value),
  "font-weight": isSafeKeywordValue,
  gradientTransform: (value) => transformPattern.test(value),
  gradientUnits: (value) => value === "userSpaceOnUse" || value === "objectBoundingBox",
  id: (value) => /^[a-zA-Z][a-zA-Z0-9_-]{0,80}$/.test(value),
  points: (value) => pathDataPattern.test(value),
  preserveAspectRatio: isSafeKeywordValue,
  role: (value) => /^[a-zA-Z0-9 .,;:()/_-]+$/.test(value),
  "stop-color": isSafePaintValue,
  stroke: isSafePaintValue,
  "stroke-linecap": isSafeKeywordValue,
  "stroke-linejoin": isSafeKeywordValue,
  "text-anchor": isSafeKeywordValue,
  transform: (value) => transformPattern.test(value),
};

function isSafeAttributeValue(name: string, value: string): boolean {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return true;
  }
  if (hasUnsafeUrl(lower)) {
    return false;
  }
  if (lower.includes("url(") && !urlReferencePattern.test(trimmed)) {
    return false;
  }
  const validator = attributeValueValidators[name];
  if (validator) {
    return validator(trimmed);
  }
  if (isNumericAttribute(name)) {
    return numericPattern.test(trimmed);
  }

  return tokenTextPattern.test(trimmed);
}

function parseAttributes(raw: string): string {
  const output: string[] = [];
  const pattern = /([:@a-zA-Z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null = pattern.exec(raw);

  while (match) {
    const rawName = String(match[1] || "");
    const lowerName = rawName.toLowerCase();
    const name = normalizeAttributeName(lowerName);
    const value = String(match[3] ?? match[4] ?? "");

    if (
      lowerName.startsWith("on") ||
      lowerName === "style" ||
      lowerName === "href" ||
      lowerName === "xlink:href" ||
      lowerName === "xmlns:xlink"
    ) {
      throw new Error(`Custom SVG attribute is not allowed: ${rawName}`);
    }
    if (lowerName === "xmlns") {
      match = pattern.exec(raw);
      continue;
    }
    if (!allowedAttributes.has(name)) {
      throw new Error(`Custom SVG attribute is not allowed: ${rawName}`);
    }
    if (!isSafeAttributeValue(name, value)) {
      throw new Error(`Custom SVG attribute has an unsafe value: ${rawName}`);
    }

    output.push(`${name}="${escapeAttribute(value)}"`);
    match = pattern.exec(raw);
  }

  return output.length ? ` ${output.join(" ")}` : "";
}

function isSelfClosingSvgTag(token: string, tagName: string): boolean {
  return (
    /\/\s*>$/.test(token) ||
    tagName === "path" ||
    tagName === "rect" ||
    tagName === "circle" ||
    tagName === "ellipse" ||
    tagName === "line" ||
    tagName === "polyline" ||
    tagName === "polygon" ||
    tagName === "stop"
  );
}

function appendTextToken(token: string, state: SanitizerState): void {
  state.output.push(escapeText(token));
}

function appendClosingTag(token: string, state: SanitizerState): void {
  const closingMatch = token.match(/^<\s*\/\s*([a-zA-Z][\w:-]*)\s*>$/);
  const closingName = closingMatch ? String(closingMatch[1] || "").toLowerCase() : "";
  const expected = state.stack.pop();
  if (!closingName || closingName !== expected) {
    throw new Error("Custom visual SVG has mismatched tags");
  }
  state.output.push(`</${allowedTags.get(closingName)}>`);
}

function appendOpeningTag(token: string, state: SanitizerState): void {
  const openingMatch = token.match(/^<\s*([a-zA-Z][\w:-]*)([\s\S]*?)\/?\s*>$/);
  const rawTagName = openingMatch ? String(openingMatch[1] || "") : "";
  const tagName = rawTagName.toLowerCase();
  const safeTagName = allowedTags.get(tagName);
  if (!safeTagName) {
    throw new Error(`Custom SVG element is not allowed: ${rawTagName || "unknown"}`);
  }
  if (!state.sawRoot && tagName !== "svg") {
    throw new Error("Custom visual SVG must start with an svg element");
  }
  state.sawRoot = true;

  const rawAttributes = String(openingMatch ? openingMatch[2] || "" : "");
  const selfClosing = isSelfClosingSvgTag(token, tagName);
  const attributes = parseAttributes(rawAttributes);
  const rootNamespace = tagName === "svg" ? " xmlns=\"http://www.w3.org/2000/svg\"" : "";

  state.output.push(`<${safeTagName}${rootNamespace}${attributes}${selfClosing ? " />" : ">"}`);
  if (!selfClosing) {
    state.stack.push(tagName);
  }
}

function appendSanitizedToken(token: string, state: SanitizerState): void {
  if (!token.startsWith("<")) {
    appendTextToken(token, state);
    return;
  }
  if (/^<\s*\//.test(token)) {
    appendClosingTag(token, state);
    return;
  }
  appendOpeningTag(token, state);
}

function sanitizeSvg(content: unknown): string {
  const source = String(content || "").trim();
  if (!source) {
    throw new Error("Custom visual SVG is required");
  }
  if (source.length > maxSvgCharacters) {
    throw new Error("Custom visual SVG is too large");
  }
  if (/<!doctype|<!entity|<\?|<!--|<script|<style|<foreignobject|<animate|<set|<iframe|<object|<embed|<form/i.test(source)) {
    throw new Error("Custom visual SVG contains unsupported executable or document markup");
  }

  const tokens = source.split(/(<[^>]+>)/g).filter((token) => token.length > 0);
  const state: SanitizerState = {
    output: [],
    stack: [],
    sawRoot: false,
  };

  tokens.forEach((token) => {
    appendSanitizedToken(token, state);
  });

  if (!state.sawRoot || state.stack.length) {
    throw new Error("Custom visual SVG is incomplete");
  }

  return state.output.join("");
}

export { sanitizeSvg };
