import * as fs from "fs";

import {
  getActivePresentationPaths,
  getPresentationPaths
} from "./presentations.ts";
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";

type JsonObject = Record<string, unknown>;

type CustomVisualFormat = "svg";

type CustomVisualArtifact = {
  content: string;
  createdAt: string;
  description: string;
  format: CustomVisualFormat;
  id: string;
  kind: "customVisual";
  role: string;
  sanitizerVersion: number;
  title: string;
  updatedAt: string;
};

type CustomVisualStore = {
  customVisuals: CustomVisualArtifact[];
};

type CustomVisualInput = {
  content?: unknown;
  description?: unknown;
  id?: unknown;
  role?: unknown;
  title?: unknown;
};

type CustomVisualOptions = {
  presentationId?: unknown;
};

const sanitizerVersion = 1;
const maxSvgCharacters = 256 * 1024;
const allowedRoles = new Set(["diagram", "chart", "illustration", "brandedArtwork"]);
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
  ["tspan", "tspan"]
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
  "y2"
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
  "yellow"
]);

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function normalizeText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function createSlug(value: unknown, fallback = "custom-visual"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || fallback;
}

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
  return allowedColorNames.has(normalized)
    || /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)
    || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(normalized);
}

function isSafeAttributeValue(name: string, value: string): boolean {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return true;
  }
  if (lower.includes("javascript:") || lower.includes("data:") || lower.includes("http:") || lower.includes("https:")) {
    return false;
  }
  if (lower.includes("url(") && !/^url\(\s*#[a-zA-Z][a-zA-Z0-9_-]*\s*\)$/.test(trimmed)) {
    return false;
  }
  if (name === "fill" || name === "stroke" || name === "stop-color") {
    return isSafeColor(trimmed) || /^url\(\s*#[a-zA-Z][a-zA-Z0-9_-]*\s*\)$/.test(trimmed);
  }
  if (name === "clip-path") {
    return /^url\(\s*#[a-zA-Z][a-zA-Z0-9_-]*\s*\)$/.test(trimmed);
  }
  if (name === "id") {
    return /^[a-zA-Z][a-zA-Z0-9_-]{0,80}$/.test(trimmed);
  }
  if (name === "d" || name === "points") {
    return /^[a-zA-Z0-9.,+\-\s]+$/.test(trimmed);
  }
  if (name === "transform" || name === "gradientTransform") {
    return /^[a-zA-Z0-9(),.+\-\s]+$/.test(trimmed);
  }
  if (name === "font-family") {
    return /^[a-zA-Z0-9 "'.,-]+$/.test(trimmed);
  }
  if (name === "aria-label" || name === "role") {
    return /^[a-zA-Z0-9 .,;:()/_-]+$/.test(trimmed);
  }
  if (name === "gradientUnits") {
    return trimmed === "userSpaceOnUse" || trimmed === "objectBoundingBox";
  }
  if (name === "preserveAspectRatio" || name === "text-anchor" || name === "dominant-baseline" || name === "stroke-linecap" || name === "stroke-linejoin" || name === "font-weight") {
    return /^[a-zA-Z0-9 -]+$/.test(trimmed);
  }
  if (name === "width" || name === "height" || name === "viewBox" || name === "offset" || /^[cr]?[xy]?[12]?$/.test(name) || name.endsWith("opacity") || name === "opacity" || name === "font-size" || name === "stroke-width" || name === "stroke-dasharray" || name === "dx" || name === "dy") {
    return /^[0-9.,+\-%\s]+$/.test(trimmed);
  }

  return /^[a-zA-Z0-9#().,;: %_+\-]+$/.test(trimmed);
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

    if (lowerName.startsWith("on") || lowerName === "style" || lowerName === "href" || lowerName === "xlink:href" || lowerName === "xmlns:xlink") {
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
  const stack: string[] = [];
  const output: string[] = [];
  let sawRoot = false;

  tokens.forEach((token) => {
    if (!token.startsWith("<")) {
      output.push(escapeText(token));
      return;
    }
    if (/^<\s*\//.test(token)) {
      const closingMatch = token.match(/^<\s*\/\s*([a-zA-Z][\w:-]*)\s*>$/);
      const closingName = closingMatch ? String(closingMatch[1] || "").toLowerCase() : "";
      const expected = stack.pop();
      if (!closingName || closingName !== expected) {
        throw new Error("Custom visual SVG has mismatched tags");
      }
      output.push(`</${allowedTags.get(closingName)}>`);
      return;
    }

    const openingMatch = token.match(/^<\s*([a-zA-Z][\w:-]*)([\s\S]*?)\/?\s*>$/);
    const rawTagName = openingMatch ? String(openingMatch[1] || "") : "";
    const tagName = rawTagName.toLowerCase();
    const safeTagName = allowedTags.get(tagName);
    if (!safeTagName) {
      throw new Error(`Custom SVG element is not allowed: ${rawTagName || "unknown"}`);
    }
    if (!sawRoot && tagName !== "svg") {
      throw new Error("Custom visual SVG must start with an svg element");
    }
    sawRoot = true;

    const rawAttributes = String(openingMatch ? openingMatch[2] || "" : "");
    const selfClosing = /\/\s*>$/.test(token) || tagName === "path" || tagName === "rect" || tagName === "circle" || tagName === "ellipse" || tagName === "line" || tagName === "polyline" || tagName === "polygon" || tagName === "stop";
    const attributes = parseAttributes(rawAttributes);
    const rootNamespace = tagName === "svg" ? " xmlns=\"http://www.w3.org/2000/svg\"" : "";

    output.push(`<${safeTagName}${rootNamespace}${attributes}${selfClosing ? " />" : ">"}`);
    if (!selfClosing) {
      stack.push(tagName);
    }
  });

  if (!sawRoot || stack.length) {
    throw new Error("Custom visual SVG is incomplete");
  }

  return output.join("");
}

function isCustomVisualArtifact(value: unknown): value is CustomVisualArtifact {
  const artifact = asRecord(value);
  return artifact.kind === "customVisual"
    && artifact.format === "svg"
    && typeof artifact.id === "string"
    && typeof artifact.title === "string"
    && typeof artifact.content === "string";
}

function normalizeCustomVisualStore(value: unknown): CustomVisualStore {
  const source = asRecord(value);
  const customVisuals = Array.isArray(source.customVisuals)
    ? source.customVisuals.filter(isCustomVisualArtifact)
    : [];

  return { customVisuals };
}

function getCustomVisualStore(options: CustomVisualOptions = {}): CustomVisualStore {
  const paths = typeof options.presentationId === "string" && options.presentationId
    ? getPresentationPaths(options.presentationId)
    : getActivePresentationPaths();
  ensureAllowedDir(paths.stateDir);

  if (!fs.existsSync(paths.customVisualsFile)) {
    writeAllowedJson(paths.customVisualsFile, { customVisuals: [] });
  }

  return normalizeCustomVisualStore(readJson(paths.customVisualsFile, { customVisuals: [] }));
}

function saveCustomVisualStore(store: unknown, options: CustomVisualOptions = {}): CustomVisualStore {
  const paths = typeof options.presentationId === "string" && options.presentationId
    ? getPresentationPaths(options.presentationId)
    : getActivePresentationPaths();
  const normalized = normalizeCustomVisualStore(store);
  writeAllowedJson(paths.customVisualsFile, normalized);
  return normalized;
}

function listCustomVisuals(options: CustomVisualOptions = {}): CustomVisualArtifact[] {
  return getCustomVisualStore(options).customVisuals;
}

function getCustomVisual(customVisualId: string, options: CustomVisualOptions = {}): CustomVisualArtifact {
  const customVisual = listCustomVisuals(options).find((entry) => entry.id === customVisualId);
  if (!customVisual) {
    throw new Error(`Unknown custom visual: ${customVisualId}`);
  }

  return customVisual;
}

function createCustomVisual(input: CustomVisualInput = {}, options: CustomVisualOptions = {}): CustomVisualArtifact {
  const store = getCustomVisualStore(options);
  const title = normalizeText(input.title, "Custom visual");
  const providedId = typeof input.id === "string" ? createSlug(input.id) : "";
  const baseId = providedId || `custom-visual-${createSlug(title)}`;
  let id = baseId;
  let suffix = 2;

  while (store.customVisuals.some((entry) => entry.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const role = normalizeText(input.role, "diagram");
  const timestamp = new Date().toISOString();
  const customVisual: CustomVisualArtifact = {
    content: sanitizeSvg(input.content),
    createdAt: timestamp,
    description: normalizeText(input.description),
    format: "svg",
    id,
    kind: "customVisual",
    role: allowedRoles.has(role) ? role : "diagram",
    sanitizerVersion,
    title,
    updatedAt: timestamp
  };

  saveCustomVisualStore({
    customVisuals: [
      customVisual,
      ...store.customVisuals
    ]
  }, options);

  return customVisual;
}

function hydrateCustomVisualSlideSpec(slideSpec: unknown, options: CustomVisualOptions = {}): JsonObject {
  const next = { ...asRecord(slideSpec) };
  const reference = asRecord(next.customVisual);
  const customVisualId = normalizeText(reference.id);
  if (!customVisualId) {
    return next;
  }

  const customVisual = getCustomVisual(customVisualId, options);
  next.customVisual = {
    description: customVisual.description,
    id: customVisual.id,
    role: customVisual.role,
    title: customVisual.title,
    content: customVisual.content
  };
  return next;
}

export {
  createCustomVisual,
  getCustomVisual,
  hydrateCustomVisualSlideSpec,
  listCustomVisuals,
  sanitizeSvg
};
