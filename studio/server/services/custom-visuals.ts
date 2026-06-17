import * as fs from "fs";

import {
  getActivePresentationPaths,
  getPresentationPaths
} from "./presentations.ts";
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";
import { sanitizeSvg } from "./custom-svg-sanitizer.ts";

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
const allowedRoles = new Set(["diagram", "chart", "illustration", "brandedArtwork"]);

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
