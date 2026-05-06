const schemaVersion = 1;
const exchangeKind = "slideotter.layout";
const packExchangeKind = "slideotter.layoutPack";
const knownTreatments = new Set(["agenda", "chapter", "checklist", "identity", "proof", "standard", "statement", "steps"]);
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

type JsonRecord = Record<string, unknown>;

type LayoutDefinition = JsonRecord & {
  arrangement?: unknown;
  mediaOrder?: unknown;
  type?: unknown;
};

type Layout = JsonRecord & {
  compatibility?: JsonRecord;
  createdAt: string;
  definition?: LayoutDefinition;
  description: string;
  id: string;
  name: string;
  provenance?: JsonRecord;
  schemaVersion: number;
  supportedTypes: string[];
  treatment: string;
  updatedAt: string;
  validationEvidence?: JsonRecord;
};

type LayoutFields = JsonRecord & {
  compatibility?: unknown;
  definition?: unknown;
  description?: unknown;
  id?: unknown;
  name?: unknown;
  provenance?: unknown;
  validationEvidence?: unknown;
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

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function slugPart(value: unknown, fallback = "layout"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || fallback;
}

function normalizeMetadataRecord(value: unknown, label: string): JsonRecord | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
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

  const compatibility = normalizeMetadataRecord(source.compatibility, "Layout compatibility metadata");
  if (compatibility) {
    normalized.compatibility = compatibility;
  }

  const provenance = normalizeMetadataRecord(source.provenance, "Layout provenance metadata");
  if (provenance) {
    normalized.provenance = provenance;
  }

  const validationEvidence = normalizeMetadataRecord(source.validationEvidence, "Layout validation evidence");
  if (validationEvidence) {
    normalized.validationEvidence = validationEvidence;
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
        .filter((value: number) => Number.isInteger(value) && value >= 0 && value <= 2)
      : [];

    return {
      arrangement,
      captionRole: String(source.captionRole || "context").replace(/\s+/g, " ").trim() || "context",
      mediaOrder: mediaOrder.length ? Array.from(new Set(mediaOrder)).slice(0, 3) : [],
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

function normalizeLayoutTreatment(value: unknown): string {
  const treatment = String(value || "").trim().toLowerCase();
  return treatment || "standard";
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
      ? [1, 0, 2]
      : definition.arrangement === "evidence"
        ? [2, 0, 1]
        : [0, 1, 2];

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

  return ordered.slice(0, 3);
}

export {
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
  type LayoutDefinition,
  type LayoutFields
};
