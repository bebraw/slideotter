import * as fs from "fs";
import {
  getActivePresentationPaths,
  presentationRuntimeFile
} from "./presentations.ts";
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";
import {
  applyPhotoGridArrangement,
  asRecord,
  createLayoutExchangeDocument,
  createLayoutPackExchangeDocument,
  knownDefinitionTypes,
  knownPhotoGridArrangements,
  knownTreatments,
  normalizeLayout,
  normalizeLayoutCollectionId,
  normalizeLayoutDefinition,
  normalizeLayoutTreatment,
  readLayoutFromExchangeDocument,
  readLayoutsFromExchangeDocument,
  schemaVersion,
  slugPart,
  supportedSlideTypes,
  type JsonRecord,
  type Layout,
  type LayoutFields
} from "./layout-normalization.ts";

const defaultLayouts = {
  layouts: []
};

type LayoutState = {
  layouts: Layout[];
};

type RuntimeState = JsonRecord & {
  savedLayouts?: unknown;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function ensureLayoutState() {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.stateDir);
}

function readLayouts(): LayoutState {
  const state = readJson(getActivePresentationPaths().layoutsFile, defaultLayouts);
  const layouts = Array.isArray(state.layouts)
    ? state.layouts.map((layout) => normalizeLayout(layout))
    : [];
  return { layouts };
}

function writeLayouts(nextState: unknown): LayoutState {
  ensureLayoutState();
  const state = asRecord(nextState);
  const normalized = {
    layouts: Array.isArray(state.layouts)
      ? state.layouts.map((layout) => normalizeLayout(layout))
      : []
  };
  writeAllowedJson(getActivePresentationPaths().layoutsFile, normalized);
  return normalized;
}

function readRuntime(): RuntimeState {
  return readJson(presentationRuntimeFile, {});
}

function writeRuntime(nextRuntime: RuntimeState): RuntimeState {
  writeAllowedJson(presentationRuntimeFile, nextRuntime);
  return nextRuntime;
}

function createLayoutFromSlideSpec(slideSpec: unknown, fields: LayoutFields = {}): Layout {
  const spec = asRecord(slideSpec);
  const slideType = spec.type ? String(spec.type) : "";
  if (!supportedSlideTypes.has(slideType)) {
    throw new Error(`Saved layouts do not support slide type "${slideType}" yet`);
  }

  const treatment = normalizeLayoutTreatment(spec.layout);
  const now = new Date().toISOString();
  const name = String(fields.name || `${treatment} ${slideType}`).replace(/\s+/g, " ").trim();
  return normalizeLayout({
    schemaVersion,
    id: fields.id || `${slugPart(name, "layout")}-${Date.now().toString(36)}`,
    name,
    description: fields.description || `Saved ${treatment} treatment for ${slideType} slides.`,
    definition: fields.definition,
    supportedTypes: [slideType],
    treatment,
    createdAt: now,
    updatedAt: now
  });
}

function saveLayoutFromSlideSpec(slideSpec: unknown, fields: LayoutFields = {}) {
  const current = readLayouts();
  const layout = createLayoutFromSlideSpec(slideSpec, fields);
  const withoutExisting = current.layouts.filter((entry) => entry.id !== layout.id);
  return {
    layout,
    state: writeLayouts({ layouts: [...withoutExisting, layout] })
  };
}

function getLayout(layoutId: string): Layout {
  const layouts = readLayouts().layouts;
  const layout = layouts.find((entry) => entry.id === layoutId);
  if (!layout) {
    throw new Error(`Unknown layout "${layoutId}"`);
  }
  return layout;
}

function exportDeckLayout(layoutId: string) {
  return createLayoutExchangeDocument(getLayout(layoutId));
}

function exportDeckLayoutPack(fields: LayoutFields = {}) {
  return createLayoutPackExchangeDocument(readLayouts().layouts, {
    name: fields.name || "Deck layout pack"
  });
}

function readFavoriteLayouts(): LayoutState {
  const runtime = readRuntime();
  const layouts = Array.isArray(runtime.savedLayouts)
    ? runtime.savedLayouts.map((layout) => normalizeLayout(layout))
    : [];
  return { layouts };
}

function saveFavoriteLayout(layout: unknown) {
  const runtime = readRuntime();
  const timestamp = new Date().toISOString();
  const source = asRecord(layout);
  const favorite = normalizeLayout({
    ...source,
    id: source.id || `${slugPart(source.name, "favorite-layout")}-${Date.now().toString(36)}`,
    createdAt: source.createdAt || timestamp,
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

function getFavoriteLayout(layoutId: string): Layout {
  const layout = readFavoriteLayouts().layouts.find((entry) => entry.id === layoutId);
  if (!layout) {
    throw new Error(`Unknown favorite layout "${layoutId}"`);
  }
  return layout;
}

function exportFavoriteLayout(layoutId: string) {
  return createLayoutExchangeDocument(getFavoriteLayout(layoutId));
}

function exportFavoriteLayoutPack(fields: LayoutFields = {}) {
  return createLayoutPackExchangeDocument(readFavoriteLayouts().layouts, {
    name: fields.name || "Favorite layout pack"
  });
}

function importDeckLayout(document: unknown, fields: LayoutFields = {}) {
  const current = readLayouts();
  const timestamp = new Date().toISOString();
  const imported = normalizeLayoutCollectionId(
    normalizeLayout({
      ...readLayoutFromExchangeDocument(document),
      createdAt: timestamp,
      updatedAt: timestamp
    }),
    current.layouts,
    fields.id
  );
  const layout = normalizeLayout({
    ...imported,
    description: fields.description || imported.description,
    name: fields.name || imported.name
  });

  return {
    layout,
    state: writeLayouts({ layouts: [...current.layouts, layout] })
  };
}

function importDeckLayoutPack(document: unknown, fields: LayoutFields = {}) {
  const current = readLayouts();
  const timestamp = new Date().toISOString();
  const importedLayouts = readLayoutsFromExchangeDocument(document).map((layout) => normalizeLayout({
    ...layout,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const nextLayouts = [...current.layouts];
  const savedLayouts = importedLayouts.map((layout, index) => {
    const withId = normalizeLayoutCollectionId(layout, nextLayouts, index === 0 ? fields.id : null);
    const saved = normalizeLayout({
      ...withId,
      description: index === 0 && fields.description ? fields.description : withId.description,
      name: index === 0 && fields.name ? fields.name : withId.name
    });
    nextLayouts.push(saved);
    return saved;
  });

  return {
    layout: savedLayouts[0],
    layouts: savedLayouts,
    state: writeLayouts({ layouts: nextLayouts })
  };
}

function importFavoriteLayout(document: unknown, fields: LayoutFields = {}) {
  const current = readFavoriteLayouts();
  const runtime = readRuntime();
  const timestamp = new Date().toISOString();
  const imported = normalizeLayoutCollectionId(
    normalizeLayout({
      ...readLayoutFromExchangeDocument(document),
      createdAt: timestamp,
      updatedAt: timestamp
    }),
    current.layouts,
    fields.id
  );
  const layout = normalizeLayout({
    ...imported,
    description: fields.description || imported.description,
    name: fields.name || imported.name
  });
  const nextRuntime = {
    ...runtime,
    savedLayouts: [
      layout,
      ...(Array.isArray(runtime.savedLayouts) ? runtime.savedLayouts : [])
    ].slice(0, 50)
  };

  writeRuntime(nextRuntime);
  return {
    layout,
    state: readFavoriteLayouts()
  };
}

function importFavoriteLayoutPack(document: unknown, fields: LayoutFields = {}) {
  const current = readFavoriteLayouts();
  const runtime = readRuntime();
  const timestamp = new Date().toISOString();
  const importedLayouts = readLayoutsFromExchangeDocument(document).map((layout) => normalizeLayout({
    ...layout,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  const nextLayouts = [...current.layouts];
  const savedLayouts = importedLayouts.map((layout, index) => {
    const withId = normalizeLayoutCollectionId(layout, nextLayouts, index === 0 ? fields.id : null);
    const saved = normalizeLayout({
      ...withId,
      description: index === 0 && fields.description ? fields.description : withId.description,
      name: index === 0 && fields.name ? fields.name : withId.name
    });
    nextLayouts.push(saved);
    return saved;
  });

  writeRuntime({
    ...runtime,
    savedLayouts: [
      ...savedLayouts,
      ...(Array.isArray(runtime.savedLayouts) ? runtime.savedLayouts : [])
    ].slice(0, 50)
  });

  return {
    layout: savedLayouts[0],
    layouts: savedLayouts,
    state: readFavoriteLayouts()
  };
}

function saveFavoriteLayoutFromDeckLayout(layoutId: string) {
  const layout = getLayout(layoutId);
  return saveFavoriteLayout({
    ...layout,
    id: `favorite-${layout.id}`,
    description: layout.description || `Favorite layout copied from ${layout.name}.`
  });
}

function deleteFavoriteLayout(layoutId: string) {
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

function getLayoutByRef(layoutRef: unknown): Layout {
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

function applyLayoutToSlideSpec(slideSpec: unknown, layoutRef: unknown) {
  const layout = getLayoutByRef(layoutRef);
  const spec = asRecord(slideSpec);
  const slideType = spec.type ? String(spec.type) : "";
  if (!layout.supportedTypes.includes(slideType)) {
    throw new Error(`Layout "${layout.name}" does not support slide type "${slideType}"`);
  }

  const nextSpec: JsonRecord = {
    ...spec,
    layout: layout.treatment
  };

  if (
    slideType === "photoGrid" &&
    layout.definition &&
    layout.definition.type === "photoGridArrangement" &&
    Array.isArray(spec.mediaItems)
  ) {
    const orderedItems = applyPhotoGridArrangement(spec.mediaItems, layout.definition);
    if (orderedItems.length >= 2) {
      nextSpec.mediaItems = orderedItems;
    }
  }

  return nextSpec;
}

const _test = {
  createLayoutExchangeDocument,
  createLayoutPackExchangeDocument,
  readLayoutFromExchangeDocument,
  readLayoutsFromExchangeDocument,
  normalizeLayoutDefinition,
  normalizeLayoutTreatment,
  normalizeLayoutCollectionId,
  normalizeLayout
};

export {
  _test,
  applyLayoutToSlideSpec,
  exportDeckLayout,
  exportDeckLayoutPack,
  exportFavoriteLayout,
  exportFavoriteLayoutPack,
  importDeckLayout,
  importDeckLayoutPack,
  importFavoriteLayout,
  importFavoriteLayoutPack,
  deleteFavoriteLayout,
  getLayoutByRef,
  knownTreatments,
  knownPhotoGridArrangements,
  knownDefinitionTypes,
  normalizeLayoutDefinition,
  readFavoriteLayouts,
  readLayouts,
  saveFavoriteLayout,
  saveFavoriteLayoutFromDeckLayout,
  saveLayoutFromSlideSpec,
  supportedSlideTypes
};
