const { getVariants, saveVariants } = require("./state");
const { readSlideSource, writeSlideSource } = require("./slides");

function listVariantsForSlide(slideId) {
  return getVariants().variants.filter((variant) => variant.slideId === slideId);
}

function captureVariant(options) {
  const slideId = options.slideId;
  const source = typeof options.source === "string" ? options.source : readSlideSource(slideId);
  const store = getVariants();
  const timestamp = new Date().toISOString();
  const nextVariant = {
    createdAt: timestamp,
    id: `variant-${Date.now()}`,
    label: options.label || `Snapshot ${store.variants.length + 1}`,
    notes: options.notes || "",
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

function applyVariant(variantId) {
  const store = getVariants();
  const variant = store.variants.find((entry) => entry.id === variantId);

  if (!variant) {
    throw new Error(`Unknown variant: ${variantId}`);
  }

  writeSlideSource(variant.slideId, variant.source);
  return variant;
}

module.exports = {
  applyVariant,
  captureVariant,
  listVariantsForSlide
};
