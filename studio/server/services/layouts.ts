const fs = require("fs");
const {
  getActivePresentationPaths,
  presentationRuntimeFile
} = require("./presentations.ts");
const {
  ensureAllowedDir,
  writeAllowedJson
} = require("./write-boundary.ts");

const schemaVersion = 1;
const knownTreatments = new Set(["callout", "checklist", "focus", "standard", "steps", "strip"]);
const supportedSlideTypes = new Set(["cover", "toc", "content", "summary"]);
const defaultLayouts = {
  layouts: []
};

function slugPart(value, fallback = "layout") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || fallback;
}

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function ensureLayoutState() {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.stateDir);
}

function normalizeLayout(layout) {
  const source = layout && typeof layout === "object" ? layout : {};
  const treatment = String(source.treatment || "").trim() || "standard";
  if (!knownTreatments.has(treatment)) {
    throw new Error(`Layout treatment must be one of: ${Array.from(knownTreatments).join(", ")}`);
  }

  const supportedTypes = Array.isArray(source.supportedTypes)
    ? source.supportedTypes.filter((type) => supportedSlideTypes.has(type))
    : [];

  if (!supportedTypes.length) {
    throw new Error("Layout must support at least one known slide family");
  }

  const now = new Date().toISOString();
  const name = String(source.name || treatment).replace(/\s+/g, " ").trim();
  const id = String(source.id || slugPart(name, treatment)).replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");

  return {
    schemaVersion,
    id: id || slugPart(treatment),
    name: name || treatment,
    description: String(source.description || "").replace(/\s+/g, " ").trim(),
    supportedTypes,
    treatment,
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now
  };
}

function readLayouts() {
  const state = readJson(getActivePresentationPaths().layoutsFile, defaultLayouts);
  const layouts = Array.isArray(state.layouts)
    ? state.layouts.map((layout) => normalizeLayout(layout))
    : [];
  return { layouts };
}

function writeLayouts(nextState) {
  ensureLayoutState();
  const normalized = {
    layouts: Array.isArray(nextState.layouts)
      ? nextState.layouts.map((layout) => normalizeLayout(layout))
      : []
  };
  writeAllowedJson(getActivePresentationPaths().layoutsFile, normalized);
  return normalized;
}

function readRuntime() {
  return readJson(presentationRuntimeFile, {});
}

function writeRuntime(nextRuntime) {
  writeAllowedJson(presentationRuntimeFile, nextRuntime);
  return nextRuntime;
}

function createLayoutFromSlideSpec(slideSpec, fields: any = {}) {
  const slideType = slideSpec && slideSpec.type ? slideSpec.type : "";
  if (!supportedSlideTypes.has(slideType)) {
    throw new Error(`Saved layouts do not support slide type "${slideType}" yet`);
  }

  const treatment = String(slideSpec.layout || "standard").trim() || "standard";
  const now = new Date().toISOString();
  const name = String(fields.name || `${treatment} ${slideType}`).replace(/\s+/g, " ").trim();
  return normalizeLayout({
    schemaVersion,
    id: fields.id || `${slugPart(name, "layout")}-${Date.now().toString(36)}`,
    name,
    description: fields.description || `Saved ${treatment} treatment for ${slideType} slides.`,
    supportedTypes: [slideType],
    treatment,
    createdAt: now,
    updatedAt: now
  });
}

function saveLayoutFromSlideSpec(slideSpec, fields: any = {}) {
  const current = readLayouts();
  const layout = createLayoutFromSlideSpec(slideSpec, fields);
  const withoutExisting = current.layouts.filter((entry) => entry.id !== layout.id);
  return {
    layout,
    state: writeLayouts({ layouts: [...withoutExisting, layout] })
  };
}

function getLayout(layoutId) {
  const layouts = readLayouts().layouts;
  const layout = layouts.find((entry) => entry.id === layoutId);
  if (!layout) {
    throw new Error(`Unknown layout "${layoutId}"`);
  }
  return layout;
}

function readFavoriteLayouts() {
  const runtime = readRuntime();
  const layouts = Array.isArray(runtime.savedLayouts)
    ? runtime.savedLayouts.map((layout) => normalizeLayout(layout))
    : [];
  return { layouts };
}

function saveFavoriteLayout(layout) {
  const runtime = readRuntime();
  const timestamp = new Date().toISOString();
  const favorite = normalizeLayout({
    ...layout,
    id: layout.id || `${slugPart(layout.name, "favorite-layout")}-${Date.now().toString(36)}`,
    createdAt: layout.createdAt || timestamp,
    updatedAt: timestamp
  });
  const existing = Array.isArray(runtime.savedLayouts)
    ? runtime.savedLayouts.filter((entry) => entry && entry.id !== favorite.id)
    : [];
  const nextRuntime = {
    ...runtime,
    savedLayouts: [
      favorite,
      ...existing
    ].slice(0, 50)
  };
  writeRuntime(nextRuntime);
  return {
    layout: favorite,
    state: readFavoriteLayouts()
  };
}

function saveFavoriteLayoutFromDeckLayout(layoutId) {
  const layout = getLayout(layoutId);
  return saveFavoriteLayout({
    ...layout,
    id: `favorite-${layout.id}`,
    description: layout.description || `Favorite layout copied from ${layout.name}.`
  });
}

function deleteFavoriteLayout(layoutId) {
  const runtime = readRuntime();
  const nextRuntime = {
    ...runtime,
    savedLayouts: Array.isArray(runtime.savedLayouts)
      ? runtime.savedLayouts.filter((layout) => layout && layout.id !== layoutId)
      : []
  };
  writeRuntime(nextRuntime);
  return readFavoriteLayouts();
}

function getLayoutByRef(layoutRef) {
  const ref = String(layoutRef || "");
  if (ref.startsWith("favorite:")) {
    const layoutId = ref.slice("favorite:".length);
    const layout = readFavoriteLayouts().layouts.find((entry) => entry.id === layoutId);
    if (!layout) {
      throw new Error(`Unknown favorite layout "${layoutId}"`);
    }
    return layout;
  }

  return getLayout(ref.startsWith("deck:") ? ref.slice("deck:".length) : ref);
}

function applyLayoutToSlideSpec(slideSpec, layoutRef) {
  const layout = getLayoutByRef(layoutRef);
  const slideType = slideSpec && slideSpec.type ? slideSpec.type : "";
  if (!layout.supportedTypes.includes(slideType)) {
    throw new Error(`Layout "${layout.name}" does not support slide type "${slideType}"`);
  }

  return {
    ...slideSpec,
    layout: layout.treatment
  };
}

module.exports = {
  applyLayoutToSlideSpec,
  deleteFavoriteLayout,
  getLayoutByRef,
  knownTreatments,
  readFavoriteLayouts,
  readLayouts,
  saveFavoriteLayoutFromDeckLayout,
  saveLayoutFromSlideSpec,
  supportedSlideTypes,
  _test: {
    normalizeLayout
  }
};
