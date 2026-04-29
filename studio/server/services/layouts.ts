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
const exchangeKind = "slideotter.layout";
const packExchangeKind = "slideotter.layoutPack";
const knownTreatments = new Set(["callout", "checklist", "focus", "standard", "steps", "strip"]);
const supportedSlideTypes = new Set(["cover", "divider", "quote", "photo", "toc", "content", "summary", "photoGrid"]);
const knownDefinitionTypes = new Set(["photoGridArrangement", "slotRegionLayout"]);
const knownPhotoGridArrangements = new Set(["lead-image", "comparison", "evidence"]);
const knownSlotRoles = new Set([
  "body",
  "caption",
  "eyebrow",
  "guardrails",
  "media",
  "note",
  "quote",
  "resources",
  "signals",
  "source",
  "summary",
  "title"
]);
const knownRegionAreas = new Set(["body", "footer", "header", "lead", "media", "sidebar", "support"]);
const knownAlignments = new Set(["center", "end", "start", "stretch"]);
const knownSpacingTokens = new Set(["loose", "none", "normal", "tight"]);
const knownTypographyRoles = new Set(["body", "caption", "display", "metric", "quote", "title"]);
const knownMediaFits = new Set(["contain", "cover", "crop", "fit"]);
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

  const normalized: any = {
    schemaVersion,
    id: id || slugPart(treatment),
    name: name || treatment,
    description: String(source.description || "").replace(/\s+/g, " ").trim(),
    supportedTypes,
    treatment,
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now
  };

  if (source.definition) {
    normalized.definition = normalizeLayoutDefinition(source.definition, supportedTypes);
  }

  return normalized;
}

function normalizeLayoutDefinition(definition, supportedTypes = []) {
  const source = definition && typeof definition === "object" && !Array.isArray(definition)
    ? definition
    : {};
  const type = String(source.type || "").trim();
  if (!knownDefinitionTypes.has(type)) {
    throw new Error(`Layout definition type must be one of: ${Array.from(knownDefinitionTypes).join(", ")}`);
  }

  if (type === "photoGridArrangement") {
    if (!supportedTypes.includes("photoGrid")) {
      throw new Error("Photo-grid layout definitions must support photoGrid slides");
    }

    const arrangement = String(source.arrangement || "").trim();
    if (!knownPhotoGridArrangements.has(arrangement)) {
      throw new Error(`Photo-grid layout arrangement must be one of: ${Array.from(knownPhotoGridArrangements).join(", ")}`);
    }

    const mediaOrder = Array.isArray(source.mediaOrder)
      ? source.mediaOrder
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 3)
      : [];

    return {
      arrangement,
      captionRole: String(source.captionRole || "context").replace(/\s+/g, " ").trim() || "context",
      mediaOrder: mediaOrder.length ? Array.from(new Set(mediaOrder)).slice(0, 4) : [],
      schemaVersion,
      type
    };
  }

  if (type === "slotRegionLayout") {
    return normalizeSlotRegionLayoutDefinition(source, supportedTypes, type);
  }

  throw new Error(`Unsupported layout definition type "${type}"`);
}

function normalizeInteger(value, fallback, min, max, label) {
  const number = value === undefined || value === null || value === ""
    ? fallback
    : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return number;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return value === true;
}

function normalizeEnum(value, allowedValues, fallback, label) {
  const normalized = String(value || fallback || "").trim();
  if (!allowedValues.has(normalized)) {
    throw new Error(`${label} must be one of: ${Array.from(allowedValues).join(", ")}`);
  }
  return normalized;
}

function normalizeSlotId(value, fallback = "slot") {
  return slugPart(String(value || fallback).replace(/\./g, "-"), fallback);
}

function normalizeSlotRegionLayoutDefinition(source, supportedTypes, type) {
  const layoutSupportedTypes = Array.isArray(supportedTypes) ? supportedTypes : [];
  if (!layoutSupportedTypes.length || !layoutSupportedTypes.every((slideType) => supportedSlideTypes.has(slideType))) {
    throw new Error("Slot-region layout definitions must support at least one known slide family");
  }

  const slots = Array.isArray(source.slots)
    ? source.slots.map((slot, index) => normalizeSlotDefinition(slot, index))
    : [];
  if (!slots.length) {
    throw new Error("Slot-region layout definitions must include at least one slot");
  }

  const slotIds = new Set();
  slots.forEach((slot) => {
    if (slotIds.has(slot.id)) {
      throw new Error(`Slot-region layout slot id "${slot.id}" is duplicated`);
    }
    slotIds.add(slot.id);
  });

  const regions = Array.isArray(source.regions)
    ? source.regions.map((region, index) => normalizeRegionDefinition(region, index, slotIds))
    : [];
  if (!regions.length) {
    throw new Error("Slot-region layout definitions must include at least one region");
  }

  const readingOrder = Array.isArray(source.readingOrder)
    ? source.readingOrder.map((slotId) => normalizeSlotId(slotId)).filter((slotId) => slotIds.has(slotId))
    : [];

  return {
    constraints: normalizeLayoutConstraints(source.constraints),
    mediaTreatment: normalizeMediaTreatment(source.mediaTreatment),
    readingOrder: readingOrder.length ? Array.from(new Set(readingOrder)) : slots.map((slot) => slot.id),
    regions,
    schemaVersion,
    slots,
    typography: normalizeTypographyMap(source.typography, slotIds),
    type
  };
}

function normalizeSlotDefinition(slot, index) {
  const source = slot && typeof slot === "object" && !Array.isArray(slot) ? slot : {};
  const role = normalizeEnum(source.role, knownSlotRoles, "body", `slots[${index}].role`);
  return {
    id: normalizeSlotId(source.id, role),
    maxLines: source.maxLines === undefined
      ? null
      : normalizeInteger(source.maxLines, null, 1, 12, `slots[${index}].maxLines`),
    required: normalizeBoolean(source.required, true),
    role
  };
}

function normalizeRegionDefinition(region, index, slotIds) {
  const source = region && typeof region === "object" && !Array.isArray(region) ? region : {};
  const slot = normalizeSlotId(source.slot, "");
  if (!slot || !slotIds.has(slot)) {
    throw new Error(`regions[${index}].slot must reference a known slot`);
  }

  return {
    align: normalizeEnum(source.align, knownAlignments, "stretch", `regions[${index}].align`),
    area: normalizeEnum(source.area, knownRegionAreas, "body", `regions[${index}].area`),
    column: normalizeInteger(source.column, 1, 1, 12, `regions[${index}].column`),
    columnSpan: normalizeInteger(source.columnSpan, 12, 1, 12, `regions[${index}].columnSpan`),
    id: normalizeSlotId(source.id, `${slot}-region`),
    row: normalizeInteger(source.row, 1, 1, 8, `regions[${index}].row`),
    rowSpan: normalizeInteger(source.rowSpan, 1, 1, 8, `regions[${index}].rowSpan`),
    slot,
    spacing: normalizeEnum(source.spacing, knownSpacingTokens, "normal", `regions[${index}].spacing`)
  };
}

function normalizeTypographyMap(typography, slotIds) {
  const source = typography && typeof typography === "object" && !Array.isArray(typography)
    ? typography
    : {};
  const normalized: any = {};
  Object.entries(source).forEach(([slotId, role]) => {
    const normalizedSlotId = normalizeSlotId(slotId, "");
    if (!normalizedSlotId || !slotIds.has(normalizedSlotId)) {
      return;
    }
    normalized[normalizedSlotId] = normalizeEnum(role, knownTypographyRoles, "body", `typography.${slotId}`);
  });
  return normalized;
}

function normalizeMediaTreatment(mediaTreatment) {
  const source = mediaTreatment && typeof mediaTreatment === "object" && !Array.isArray(mediaTreatment)
    ? mediaTreatment
    : {};
  return {
    fit: normalizeEnum(source.fit, knownMediaFits, "contain", "mediaTreatment.fit"),
    focalPoint: String(source.focalPoint || "center").replace(/\s+/g, " ").trim() || "center"
  };
}

function normalizeLayoutConstraints(constraints) {
  const source = constraints && typeof constraints === "object" && !Array.isArray(constraints)
    ? constraints
    : {};
  return {
    captionAttached: normalizeBoolean(source.captionAttached, true),
    maxLines: normalizeInteger(source.maxLines, 6, 1, 12, "constraints.maxLines"),
    minFontSize: normalizeInteger(source.minFontSize, 18, 12, 44, "constraints.minFontSize"),
    progressClearance: normalizeBoolean(source.progressClearance, true)
  };
}

function normalizeLayoutCollectionId(layout, existingLayouts, preferredId = null) {
  const existingIds = new Set(
    (Array.isArray(existingLayouts) ? existingLayouts : [])
      .map((entry) => entry && entry.id)
      .filter(Boolean)
  );
  const baseId = slugPart(preferredId || layout.id || layout.name || layout.treatment, "layout");
  let id = baseId;
  let suffix = 2;

  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    ...layout,
    id
  };
}

function createLayoutExchangeDocument(layout) {
  const normalized = normalizeLayout(layout);
  return {
    exportedAt: new Date().toISOString(),
    kind: exchangeKind,
    layout: normalized,
    schemaVersion
  };
}

function createLayoutPackExchangeDocument(layouts, fields: any = {}) {
  const normalizedLayouts = (Array.isArray(layouts) ? layouts : []).map((layout) => normalizeLayout(layout));
  return {
    exportedAt: new Date().toISOString(),
    kind: packExchangeKind,
    layouts: normalizedLayouts,
    name: String(fields.name || "Layout pack").replace(/\s+/g, " ").trim() || "Layout pack",
    schemaVersion
  };
}

function readLayoutFromExchangeDocument(document) {
  const source = document && typeof document === "object" && !Array.isArray(document)
    ? document
    : {};

  if (source.kind === exchangeKind || source.layout) {
    if (source.schemaVersion !== schemaVersion) {
      throw new Error(`Layout exchange schemaVersion must be ${schemaVersion}`);
    }

    return normalizeLayout(source.layout);
  }

  return normalizeLayout(source);
}

function readLayoutsFromExchangeDocument(document) {
  const source = document && typeof document === "object" && !Array.isArray(document)
    ? document
    : {};

  if (source.kind === packExchangeKind || source.layouts) {
    if (source.schemaVersion !== schemaVersion) {
      throw new Error(`Layout pack schemaVersion must be ${schemaVersion}`);
    }

    if (!Array.isArray(source.layouts) || !source.layouts.length) {
      throw new Error("Layout pack must contain at least one layout");
    }

    return source.layouts.map((layout) => normalizeLayout(layout));
  }

  return [readLayoutFromExchangeDocument(document)];
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
    definition: fields.definition,
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

function exportDeckLayout(layoutId) {
  return createLayoutExchangeDocument(getLayout(layoutId));
}

function exportDeckLayoutPack(fields: any = {}) {
  return createLayoutPackExchangeDocument(readLayouts().layouts, {
    name: fields.name || "Deck layout pack"
  });
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

function getFavoriteLayout(layoutId) {
  const layout = readFavoriteLayouts().layouts.find((entry) => entry.id === layoutId);
  if (!layout) {
    throw new Error(`Unknown favorite layout "${layoutId}"`);
  }
  return layout;
}

function exportFavoriteLayout(layoutId) {
  return createLayoutExchangeDocument(getFavoriteLayout(layoutId));
}

function exportFavoriteLayoutPack(fields: any = {}) {
  return createLayoutPackExchangeDocument(readFavoriteLayouts().layouts, {
    name: fields.name || "Favorite layout pack"
  });
}

function importDeckLayout(document, fields: any = {}) {
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

function importDeckLayoutPack(document, fields: any = {}) {
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

function importFavoriteLayout(document, fields: any = {}) {
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

function importFavoriteLayoutPack(document, fields: any = {}) {
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

  const nextSpec = {
    ...slideSpec,
    layout: layout.treatment
  };

  if (
    slideType === "photoGrid" &&
    layout.definition &&
    layout.definition.type === "photoGridArrangement" &&
    Array.isArray(slideSpec.mediaItems)
  ) {
    const orderedItems = applyPhotoGridArrangement(slideSpec.mediaItems, layout.definition);
    if (orderedItems.length >= 2) {
      nextSpec.mediaItems = orderedItems;
    }
  }

  return nextSpec;
}

function applyPhotoGridArrangement(mediaItems, definition) {
  const items = Array.isArray(mediaItems) ? mediaItems.map((item) => ({ ...item })) : [];
  if (!items.length) {
    return [];
  }

  const used = new Set();
  const ordered = [];
  const order = Array.isArray(definition.mediaOrder) && definition.mediaOrder.length
    ? definition.mediaOrder
    : definition.arrangement === "comparison"
      ? [1, 0, 2, 3]
      : definition.arrangement === "evidence"
        ? [2, 0, 1, 3]
        : [0, 1, 2, 3];

  order.forEach((index) => {
    if (items[index] && !used.has(index)) {
      ordered.push(items[index]);
      used.add(index);
    }
  });

  items.forEach((item, index) => {
    if (!used.has(index)) {
      ordered.push(item);
    }
  });

  return ordered.slice(0, 4);
}

module.exports = {
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
  supportedSlideTypes,
  _test: {
    createLayoutExchangeDocument,
    createLayoutPackExchangeDocument,
    readLayoutFromExchangeDocument,
    readLayoutsFromExchangeDocument,
    normalizeLayoutDefinition,
    normalizeLayoutCollectionId,
    normalizeLayout
  }
};
