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

type JsonRecord = Record<string, unknown>;

type LayoutDefinition = JsonRecord & {
  arrangement?: unknown;
  mediaOrder?: unknown;
  type?: unknown;
};

type Layout = JsonRecord & {
  createdAt: string;
  definition?: LayoutDefinition;
  description: string;
  id: string;
  name: string;
  schemaVersion: number;
  supportedTypes: string[];
  treatment: string;
  updatedAt: string;
};

type LayoutState = {
  layouts: Layout[];
};

type RuntimeState = JsonRecord & {
  savedLayouts?: unknown;
};

type SlotDefinition = {
  id: string;
  maxLines: number | null;
  required: boolean;
  role: string;
};

type RegionDefinition = {
  align: string;
  area: string;
  column: number;
  columnSpan: number;
  id: string;
  row: number;
  rowSpan: number;
  slot: string;
  spacing: string;
};

type CustomLayoutDraftOptions = {
  minFontSize?: unknown;
  profile?: unknown;
  slideType?: unknown;
  spacing?: unknown;
};

type LayoutFields = JsonRecord & {
  definition?: unknown;
  description?: unknown;
  id?: unknown;
  name?: unknown;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeDraftSlideType(value: unknown): string {
  const slideType = String(value || "content").trim();
  return slideType === "cover" ? "cover" : "content";
}

function createCustomLayoutSlots(slideType = "content"): SlotDefinition[] {
  if (normalizeDraftSlideType(slideType) === "cover") {
    return [
      { id: "title", maxLines: 3, required: true, role: "title" },
      { id: "summary", maxLines: 3, required: true, role: "summary" },
      { id: "note", maxLines: 3, required: true, role: "caption" },
      { id: "cards", maxLines: 6, required: true, role: "body" }
    ];
  }

  return [
    { id: "title", maxLines: 3, required: true, role: "title" },
    { id: "summary", maxLines: 3, required: true, role: "summary" },
    { id: "signals", maxLines: 6, required: true, role: "signals" },
    { id: "guardrails", maxLines: 5, required: true, role: "guardrails" }
  ];
}

function createCoverLayoutRegions(profile: string, spacing: string): RegionDefinition[] {
  if (profile === "lead-sidebar") {
    return [
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 4, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "note-region", row: 6, rowSpan: 2, slot: "note", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "cards-region", row: 1, rowSpan: 7, slot: "cards", spacing }
    ];
  }

  if (profile === "stacked-sequence") {
    return [
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "body", column: 1, columnSpan: 8, id: "cards-region", row: 5, rowSpan: 4, slot: "cards", spacing },
      { align: "stretch", area: "body", column: 9, columnSpan: 4, id: "note-region", row: 5, rowSpan: 4, slot: "note", spacing }
    ];
  }

  if (profile === "lead-support") {
    return [
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "title-region", row: 1, rowSpan: 4, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "summary-region", row: 5, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "support", column: 1, columnSpan: 8, id: "cards-region", row: 6, rowSpan: 3, slot: "cards", spacing },
      { align: "stretch", area: "support", column: 9, columnSpan: 4, id: "note-region", row: 6, rowSpan: 3, slot: "note", spacing }
    ];
  }

  return [
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 3, slot: "title", spacing: "normal" },
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 4, rowSpan: 2, slot: "summary", spacing },
    { align: "stretch", area: "support", column: 8, columnSpan: 5, id: "cards-region", row: 1, rowSpan: 7, slot: "cards", spacing },
    { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "note-region", row: 6, rowSpan: 2, slot: "note", spacing }
  ];
}

function createContentLayoutRegions(profile: string, spacing: string): RegionDefinition[] {
  if (profile === "lead-sidebar") {
    return [
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 1, columnSpan: 7, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "signals-region", row: 1, rowSpan: 4, slot: "signals", spacing },
      { align: "stretch", area: "sidebar", column: 8, columnSpan: 5, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
    ];
  }

  if (profile === "stacked-sequence") {
    return [
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "header", column: 1, columnSpan: 12, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
      { align: "stretch", area: "body", column: 1, columnSpan: 6, id: "signals-region", row: 5, rowSpan: 4, slot: "signals", spacing },
      { align: "stretch", area: "body", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 4, slot: "guardrails", spacing }
    ];
  }

  if (profile === "lead-support") {
    return [
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
      { align: "stretch", area: "lead", column: 2, columnSpan: 10, id: "summary-region", row: 3, rowSpan: 1, slot: "summary", spacing },
      { align: "stretch", area: "support", column: 1, columnSpan: 6, id: "signals-region", row: 5, rowSpan: 3, slot: "signals", spacing },
      { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
    ];
  }

  return [
    { align: "stretch", area: "lead", column: 1, columnSpan: 6, id: "title-region", row: 1, rowSpan: 2, slot: "title", spacing: "normal" },
    { align: "stretch", area: "lead", column: 1, columnSpan: 6, id: "summary-region", row: 3, rowSpan: 2, slot: "summary", spacing },
    { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "signals-region", row: 1, rowSpan: 4, slot: "signals", spacing },
    { align: "stretch", area: "support", column: 7, columnSpan: 6, id: "guardrails-region", row: 5, rowSpan: 3, slot: "guardrails", spacing }
  ];
}

function createCustomLayoutDraftDefinition(options: CustomLayoutDraftOptions = {}) {
  const slideType = normalizeDraftSlideType(options.slideType);
  const profile = String(options.profile || "balanced-grid").trim() || "balanced-grid";
  const spacing = normalizeEnum(options.spacing, knownSpacingTokens, "normal", "spacing");
  const minFontSize = normalizeInteger(options.minFontSize, 18, 8, 72, "minFontSize");
  const slots = createCustomLayoutSlots(slideType);
  const regions = slideType === "cover"
    ? createCoverLayoutRegions(profile, spacing)
    : createContentLayoutRegions(profile, spacing);

  return normalizeLayoutDefinition({
    constraints: {
      captionAttached: true,
      maxLines: 6,
      minFontSize,
      progressClearance: true
    },
    mediaTreatment: {
      fit: "contain",
      focalPoint: "center"
    },
    readingOrder: slots.map((slot) => slot.id),
    regions,
    slots,
    typography: Object.fromEntries(slots.map((slot) => [
      slot.id,
      slot.role === "title" ? "title" : slot.role === "caption" ? "caption" : "body"
    ])),
    type: "slotRegionLayout"
  }, [slideType]);
}

function slugPart(value: unknown, fallback = "layout"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || fallback;
}

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

function normalizeLayout(layout: unknown): Layout {
  const source = asRecord(layout);
  const treatment = normalizeLayoutTreatment(source.treatment);
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

  const normalized: Layout = {
    schemaVersion,
    id: id || slugPart(treatment),
    name: name || treatment,
    description: String(source.description || "").replace(/\s+/g, " ").trim(),
    supportedTypes,
    treatment,
    createdAt: String(source.createdAt || now),
    updatedAt: String(source.updatedAt || now)
  };

  if (source.definition) {
    normalized.definition = normalizeLayoutDefinition(source.definition, supportedTypes);
  }

  return normalized;
}

function normalizeLayoutDefinition(definition: unknown, supportedTypes: string[] = []): LayoutDefinition {
  const source = asRecord(definition);
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
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value) && value >= 0 && value <= 3)
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

function normalizeInteger(value: unknown, fallback: number, min: number, max: number, label: string): number {
  const number = value === undefined || value === null || value === ""
    ? fallback
    : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return Number(number);
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }
  return value === true;
}

function normalizeEnum(value: unknown, allowedValues: Set<string>, fallback: string, label: string): string {
  const normalized = String(value || fallback || "").trim();
  if (!allowedValues.has(normalized)) {
    throw new Error(`${label} must be one of: ${Array.from(allowedValues).join(", ")}`);
  }
  return normalized;
}

function normalizeSlotId(value: unknown, fallback = "slot"): string {
  return slugPart(String(value || fallback).replace(/\./g, "-"), fallback);
}

function normalizeSlotRegionLayoutDefinition(source: JsonRecord, supportedTypes: string[], type: string): LayoutDefinition {
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

  const slotIds = new Set<string>();
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

function normalizeSlotDefinition(slot: unknown, index: number): SlotDefinition {
  const source = asRecord(slot);
  const role = normalizeEnum(source.role, knownSlotRoles, "body", `slots[${index}].role`);
  return {
    id: normalizeSlotId(source.id, role),
    maxLines: source.maxLines === undefined
      ? null
      : normalizeInteger(source.maxLines, 1, 1, 12, `slots[${index}].maxLines`),
    required: normalizeBoolean(source.required, true),
    role
  };
}

function normalizeRegionDefinition(region: unknown, index: number, slotIds: Set<string>): RegionDefinition {
  const source = asRecord(region);
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

function normalizeTypographyMap(typography: unknown, slotIds: Set<string>): Record<string, string> {
  const source = asRecord(typography);
  const normalized: Record<string, string> = {};
  Object.entries(source).forEach(([slotId, role]) => {
    const normalizedSlotId = normalizeSlotId(slotId, "");
    if (!normalizedSlotId || !slotIds.has(normalizedSlotId)) {
      return;
    }
    normalized[normalizedSlotId] = normalizeEnum(role, knownTypographyRoles, "body", `typography.${slotId}`);
  });
  return normalized;
}

function normalizeMediaTreatment(mediaTreatment: unknown) {
  const source = asRecord(mediaTreatment);
  return {
    fit: normalizeEnum(source.fit, knownMediaFits, "contain", "mediaTreatment.fit"),
    focalPoint: String(source.focalPoint || "center").replace(/\s+/g, " ").trim() || "center"
  };
}

function normalizeLayoutConstraints(constraints: unknown) {
  const source = asRecord(constraints);
  return {
    captionAttached: normalizeBoolean(source.captionAttached, true),
    maxLines: normalizeInteger(source.maxLines, 6, 1, 12, "constraints.maxLines"),
    minFontSize: normalizeInteger(source.minFontSize, 18, 12, 44, "constraints.minFontSize"),
    progressClearance: normalizeBoolean(source.progressClearance, true)
  };
}

function normalizeLayoutCollectionId(layout: Layout, existingLayouts: unknown, preferredId: unknown = null): Layout {
  const existingIds = new Set(
    (Array.isArray(existingLayouts) ? existingLayouts : [])
      .map((entry) => asRecord(entry).id)
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

function createLayoutExchangeDocument(layout: unknown) {
  const normalized = normalizeLayout(layout);
  return {
    exportedAt: new Date().toISOString(),
    kind: exchangeKind,
    layout: normalized,
    schemaVersion
  };
}

function createLayoutPackExchangeDocument(layouts: unknown, fields: LayoutFields = {}) {
  const normalizedLayouts = (Array.isArray(layouts) ? layouts : []).map((layout) => normalizeLayout(layout));
  return {
    exportedAt: new Date().toISOString(),
    kind: packExchangeKind,
    layouts: normalizedLayouts,
    name: String(fields.name || "Layout pack").replace(/\s+/g, " ").trim() || "Layout pack",
    schemaVersion
  };
}

function readLayoutFromExchangeDocument(document: unknown): Layout {
  const source = asRecord(document);

  if (source.kind === exchangeKind || source.layout) {
    if (source.schemaVersion !== schemaVersion) {
      throw new Error(`Layout exchange schemaVersion must be ${schemaVersion}`);
    }

    return normalizeLayout(source.layout);
  }

  return normalizeLayout(source);
}

function readLayoutsFromExchangeDocument(document: unknown): Layout[] {
  const source = asRecord(document);

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

function normalizeLayoutTreatment(value: unknown): string {
  const treatment = String(value || "").trim().toLowerCase();
  return treatment === "default" || !treatment ? "standard" : treatment;
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

function applyPhotoGridArrangement(mediaItems: unknown, definition: LayoutDefinition) {
  const items: JsonRecord[] = Array.isArray(mediaItems) ? mediaItems.map((item) => ({ ...asRecord(item) })) : [];
  if (!items.length) {
    return [];
  }

  const used = new Set<number>();
  const ordered: JsonRecord[] = [];
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
  createCustomLayoutDraftDefinition,
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
    createCustomLayoutDraftDefinition,
    createLayoutExchangeDocument,
    createLayoutPackExchangeDocument,
    readLayoutFromExchangeDocument,
    readLayoutsFromExchangeDocument,
    normalizeLayoutDefinition,
    normalizeLayoutTreatment,
    normalizeLayoutCollectionId,
    normalizeLayout
  }
};
