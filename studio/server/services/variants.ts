const { getVariants, saveVariants } = require("./state.ts");
const { validateSlideSpec } = require("./slide-specs/index.ts");
const {
  getSlide,
  readSlideSource,
  readSlideSpec,
  writeSlideSource,
  writeSlideSpec
} = require("./slides.ts");

function serializeSlideSpec(slideSpec) {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

function assertValidSource(source) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`Variant source is invalid: ${error.message}`);
  }
}

function parseStructuredSource(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Structured variant source is invalid JSON: ${error.message}`);
  }
}

function sortVariants(variants) {
  return [...variants].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || 0);
    const rightTime = Date.parse(right.updatedAt || right.createdAt || 0);
    return rightTime - leftTime;
  });
}

function createVariantId() {
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createVariantRecord(options) {
  const timestamp = new Date().toISOString();
  const slideSpec = options.slideSpec || null;
  const source = typeof options.source === "string"
    ? options.source
    : slideSpec
      ? serializeSlideSpec(slideSpec)
      : null;

  return {
    changeSummary: Array.isArray(options.changeSummary) ? options.changeSummary : [],
    createdAt: options.createdAt || timestamp,
    generator: options.generator || null,
    id: options.id || createVariantId(),
    kind: options.kind || "snapshot",
    label: options.label || "",
    model: options.model || null,
    notes: options.notes || "",
    operation: options.operation || null,
    persisted: options.persisted !== false,
    previewImage: options.previewImage || null,
    promptSummary: options.promptSummary || "",
    provider: options.provider || null,
    slideId: options.slideId,
    slideSpec,
    source,
    updatedAt: options.updatedAt || timestamp,
    visualTheme: options.visualTheme && typeof options.visualTheme === "object" && !Array.isArray(options.visualTheme)
      ? options.visualTheme
      : null
  };
}

function normalizeStoredVariant(variant) {
  if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
    return null;
  }

  try {
    const slide = getSlide(variant.slideId, { includeArchived: true });
    let slideSpec = null;
    let source = typeof variant.source === "string" ? variant.source : null;

    if (slide.structured) {
      if (variant.slideSpec && typeof variant.slideSpec === "object" && !Array.isArray(variant.slideSpec)) {
        slideSpec = validateSlideSpec(variant.slideSpec);
      } else if (source && source.trim()) {
        slideSpec = validateSlideSpec(parseStructuredSource(source));
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
      ...variant,
      persisted: true,
      slideId: slide.id,
      slideSpec,
      source
    });
  } catch (error) {
    return null;
  }
}

function readStoredVariants() {
  const store = getVariants();
  return Array.isArray(store.variants)
    ? store.variants.map(normalizeStoredVariant).filter(Boolean)
    : [];
}

function listVariantsForSlide(slideId) {
  return sortVariants(readStoredVariants().filter((variant) => variant.slideId === slideId));
}

function listAllVariants() {
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

function captureVariant(options) {
  const slideId = options.slideId;
  const slide = getSlide(slideId);
  let slideSpec = options.slideSpec || null;
  let source = typeof options.source === "string" ? options.source : null;

  if (slide.structured) {
    if (!slideSpec && source && source.trim()) {
      slideSpec = parseStructuredSource(source);
    }

    slideSpec = validateSlideSpec(slideSpec || readSlideSpec(slideId));
    source = serializeSlideSpec(slideSpec);
  } else {
    source = source || readSlideSource(slideId);
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
    variants: [nextVariant, ...currentVariants.filter((variant) => variant && variant.id !== nextVariant.id)]
  });

  return nextVariant;
}

function updateVariant(variantId, fields) {
  const store = getVariants();
  const currentVariants = Array.isArray(store.variants) ? store.variants : [];
  let updated = null;

  const variants = currentVariants.map((variant) => {
    if (!variant || variant.id !== variantId) {
      return variant;
    }

    const nextSlideSpec = fields.slideSpec
      ? validateSlideSpec(fields.slideSpec)
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

function applyVariant(variantId) {
  const variant = listAllVariants().find((entry) => entry.id === variantId);

  if (!variant) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  if (variant.slideSpec) {
    writeSlideSpec(variant.slideId, variant.slideSpec);
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
