const fs = require("fs");
const path = require("path");

const deckContextFile = path.join(__dirname, "..", "state", "deck-context.json");

const validationRuleDefaults = Object.freeze({
  "baseline-missing": "error",
  bounds: "error",
  "caption-source-spacing": "warning",
  "content-gap-tight": "warning",
  "contrast-low": "error",
  "contrast-tight": "warning",
  "dom-validation-failed": "error",
  "font-size-small": "warning",
  "media-legibility": "warning",
  "render-mismatch": "error",
  "render-page-count": "error",
  "slide-word-count": "warning",
  "text-padding": "warning",
  "vertical-balance": "warning"
});

const defaultValidationSettings = Object.freeze({
  mediaValidationMode: "fast",
  rules: { ...validationRuleDefaults }
});

function normalizeSeverity(value, fallback = "warning") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "error") {
    return "error";
  }

  if (normalized === "warning" || normalized === "warn") {
    return "warning";
  }

  return fallback;
}

function normalizeMediaValidationMode(value) {
  return String(value || "").trim().toLowerCase() === "complete" ? "complete" : "fast";
}

function normalizeValidationSettings(input: any = {}) {
  /** @type {any} */
  const source = input && typeof input === "object" ? input : {};
  const rawRules = source.rules && typeof source.rules === "object" ? source.rules : {};
  const rules = Object.fromEntries(
    Object.entries(validationRuleDefaults).map(([rule, fallback]) => [
      rule,
      normalizeSeverity(rawRules[rule], fallback)
    ])
  );

  return {
    mediaValidationMode: normalizeMediaValidationMode(source.mediaValidationMode),
    rules
  };
}

function readValidationSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(deckContextFile, "utf8"));
    return normalizeValidationSettings(raw && raw.deck && raw.deck.validationSettings);
  } catch (error) {
    return normalizeValidationSettings(defaultValidationSettings);
  }
}

function resolveValidationLevel(rule, fallbackLevel, settings) {
  const normalized = normalizeValidationSettings(settings);
  const configured = normalized.rules && normalized.rules[rule];
  return configured === "error"
    ? "error"
    : (configured === "warning" ? "warn" : fallbackLevel);
}

module.exports = {
  defaultValidationSettings,
  normalizeValidationSettings,
  readValidationSettings,
  resolveValidationLevel,
  validationRuleDefaults
};
