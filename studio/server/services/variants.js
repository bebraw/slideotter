const { getVariants, saveVariants } = require("./state");
const { readSlideSource, writeSlideSource } = require("./slides");

function assertValidSource(source) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`Variant source is invalid: ${error.message}`);
  }
}

function listVariantsForSlide(slideId) {
  return getVariants().variants.filter((variant) => variant.slideId === slideId);
}

function createVariantId() {
  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function captureVariant(options) {
  const slideId = options.slideId;
  const source = typeof options.source === "string" ? options.source : readSlideSource(slideId);
  assertValidSource(source);
  const store = getVariants();
  const timestamp = new Date().toISOString();
  const nextVariant = {
    createdAt: timestamp,
    id: createVariantId(),
    kind: options.kind || "snapshot",
    label: options.label || `Snapshot ${store.variants.length + 1}`,
    notes: options.notes || "",
    operation: options.operation || null,
    previewImage: options.previewImage || null,
    promptSummary: options.promptSummary || "",
    slideId,
    source,
    updatedAt: timestamp
  };

  const nextStore = {
    variants: [nextVariant, ...store.variants]
  };

  saveVariants(nextStore);
  return nextVariant;
}

function updateVariant(variantId, fields) {
  const store = getVariants();
  let updated = null;

  const variants = store.variants.map((variant) => {
    if (variant.id !== variantId) {
      return variant;
    }

    updated = {
      ...variant,
      ...fields,
      updatedAt: new Date().toISOString()
    };

    return updated;
  });

  if (!updated) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  saveVariants({ variants });
  return updated;
}

function applyVariant(variantId) {
  const store = getVariants();
  const variant = store.variants.find((entry) => entry.id === variantId);

  if (!variant) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  assertValidSource(variant.source);
  writeSlideSource(variant.slideId, variant.source);
  return variant;
}

module.exports = {
  applyVariant,
  captureVariant,
  listVariantsForSlide,
  updateVariant
};
