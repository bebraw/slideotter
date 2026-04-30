const { getVariants, saveVariants } = require("./state.ts");
const { validateSlideSpec } = require("./slide-specs/index.ts");
const {
  getSlide,
  readSlideSource,
  readSlideSpec,
  writeSlideSource,
  writeSlideSpec
} = require("./slides.ts");

type VariantRecord = {
  changeSummary: unknown[];
  createdAt: string;
  generator: string | null;
  id: string;
  kind: string;
  label: string;
  model: string | null;
  notes: string;
  operation: string | null;
  operationScope: Record<string, unknown> | null;
  persisted: boolean;
  previewImage: string | null;
  promptSummary: string;
  provider: string | null;
  slideId: string;
  slideSpec: Record<string, unknown> | null;
  source: string | null;
  updatedAt: string;
  visualTheme: Record<string, unknown> | null;
};

type VariantOptions = Partial<VariantRecord> & {
  slideId: string;
};

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown, fallback: string | null = null): string | null {
  return typeof value === "string" ? value : fallback;
}

function serializeSlideSpec(slideSpec: unknown): string {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

function assertValidSource(source: string): void {
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`Variant source is invalid: ${formatErrorMessage(error)}`);
  }
}

function parseStructuredSource(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Structured variant source is invalid JSON: ${formatErrorMessage(error)}`);
  }
}

function sortVariants(variants: VariantRecord[]): VariantRecord[] {
  return [...variants].sort((left: VariantRecord, right: VariantRecord) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || "1970-01-01T00:00:00.000Z");
    const rightTime = Date.parse(right.updatedAt || right.createdAt || "1970-01-01T00:00:00.000Z");
    return rightTime - leftTime;
  });
}

function createVariantId() {
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createVariantRecord(options: VariantOptions): VariantRecord {
  const timestamp = new Date().toISOString();
  const slideSpec = asRecord(options.slideSpec);
  const source = typeof options.source === "string"
    ? options.source
    : slideSpec
      ? serializeSlideSpec(slideSpec)
      : null;

  return {
    changeSummary: Array.isArray(options.changeSummary) ? options.changeSummary : [],
    createdAt: options.createdAt || timestamp,
    generator: asString(options.generator),
    id: options.id || createVariantId(),
    kind: options.kind || "snapshot",
    label: options.label || "",
    model: asString(options.model),
    notes: options.notes || "",
    operation: asString(options.operation),
    operationScope: asRecord(options.operationScope),
    persisted: options.persisted !== false,
    previewImage: asString(options.previewImage),
    promptSummary: options.promptSummary || "",
    provider: asString(options.provider),
    slideId: options.slideId,
    slideSpec,
    source,
    updatedAt: options.updatedAt || timestamp,
    visualTheme: asRecord(options.visualTheme)
  };
}

function normalizeStoredVariant(variant: unknown): VariantRecord | null {
  const record = asRecord(variant);
  if (!record || typeof record.slideId !== "string") {
    return null;
  }

  try {
    const slide = getSlide(record.slideId, { includeArchived: true, includeSkipped: true });
    let slideSpec: Record<string, unknown> | null = null;
    let source = typeof record.source === "string" ? record.source : null;

    if (slide.structured) {
      if (asRecord(record.slideSpec)) {
        slideSpec = validateSlideSpec(record.slideSpec) as Record<string, unknown>;
      } else if (source && source.trim()) {
        slideSpec = validateSlideSpec(parseStructuredSource(source)) as Record<string, unknown>;
      }

      if (!slideSpec) {
        return null;
      }

      source = serializeSlideSpec(slideSpec);
    } else if (source) {
      assertValidSource(source);
    } else {
      return null;
    }

    return createVariantRecord({
      ...record,
      persisted: true,
      slideId: slide.id,
      slideSpec,
      source
    });
  } catch (error) {
    return null;
  }
}

function readStoredVariants(): VariantRecord[] {
  const store = getVariants();
  return Array.isArray(store.variants)
    ? store.variants.map(normalizeStoredVariant).filter(Boolean)
    : [];
}

function listVariantsForSlide(slideId: string): VariantRecord[] {
  return sortVariants(readStoredVariants().filter((variant: VariantRecord) => variant.slideId === slideId));
}

function listAllVariants(): VariantRecord[] {
  return sortVariants(readStoredVariants());
}

function migrateLegacyStructuredVariants() {
  const store = getVariants();
  const variants = Array.isArray(store.variants)
    ? store.variants.map(normalizeStoredVariant).filter(Boolean)
    : [];

  if (variants.length !== (Array.isArray(store.variants) ? store.variants.length : 0)) {
    saveVariants({ variants });
  }

  return {
    blocked: 0,
    migrated: 0,
    remainingLegacy: variants.length
  };
}

function getVariantStorageStatus() {
  const variants = readStoredVariants();
  return {
    blockedStructured: 0,
    legacyStructured: 0,
    legacyUnstructured: variants.length,
    slideLocalStructured: 0
  };
}

function captureVariant(options: VariantOptions): VariantRecord {
  const slideId = options.slideId;
  const slide = getSlide(slideId);
  let slideSpec: Record<string, unknown> | null = asRecord(options.slideSpec);
  let source = typeof options.source === "string" ? options.source : null;

  if (slide.structured) {
    if (!slideSpec && source && source.trim()) {
      slideSpec = asRecord(parseStructuredSource(source));
    }

    slideSpec = validateSlideSpec(slideSpec || readSlideSpec(slideId)) as Record<string, unknown>;
    source = serializeSlideSpec(slideSpec);
  } else {
    source = source || readSlideSource(slideId);
    if (!source) {
      throw new Error(`Slide ${slideId} has no variant source.`);
    }
    assertValidSource(source);
  }

  const store = getVariants();
  const currentVariants = Array.isArray(store.variants) ? store.variants : [];
  const nextVariant = createVariantRecord({
    ...options,
    label: options.label || `Snapshot ${currentVariants.length + 1}`,
    slideId,
    slideSpec,
    source
  });

  saveVariants({
    variants: [nextVariant, ...currentVariants.filter((variant: VariantRecord) => variant && variant.id !== nextVariant.id)]
  });

  return nextVariant;
}

function updateVariant(variantId: string, fields: Partial<VariantRecord>): VariantRecord {
  const store = getVariants();
  const currentVariants = Array.isArray(store.variants) ? store.variants : [];
  let updated: VariantRecord | null = null;

  const variants = currentVariants.map((variant: VariantRecord) => {
    if (!variant || variant.id !== variantId) {
      return variant;
    }

    const nextSlideSpec = fields.slideSpec
      ? validateSlideSpec(fields.slideSpec) as Record<string, unknown>
      : variant.slideSpec;

    updated = createVariantRecord({
      ...variant,
      ...fields,
      slideSpec: nextSlideSpec,
      source: nextSlideSpec ? serializeSlideSpec(nextSlideSpec) : fields.source || variant.source,
      updatedAt: new Date().toISOString()
    });

    return updated;
  });

  if (!updated) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  saveVariants({ variants });
  return updated;
}

function applyVariant(variantId: string): VariantRecord {
  const variant = listAllVariants().find((entry: VariantRecord) => entry.id === variantId);

  if (!variant) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  if (variant.slideSpec) {
    writeSlideSpec(variant.slideId, variant.slideSpec, { preservePlacement: true });
    return {
      ...variant,
      slideSpec: readSlideSpec(variant.slideId)
    };
  }

  writeSlideSource(variant.slideId, variant.source);
  return variant;
}

module.exports = {
  applyVariant,
  captureVariant,
  createVariantRecord,
  getVariantStorageStatus,
  listAllVariants,
  listVariantsForSlide,
  migrateLegacyStructuredVariants,
  serializeSlideSpec,
  updateVariant
};
