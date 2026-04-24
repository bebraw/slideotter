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
} as const);

type ValidationSeverity = "error" | "warning";
type ValidationLevel = "error" | "warn";
type MediaValidationMode = "fast" | "complete";
type ValidationRule = keyof typeof validationRuleDefaults;

type ValidationSettings = {
  mediaValidationMode: MediaValidationMode;
  rules: Record<ValidationRule, ValidationSeverity>;
};

const defaultValidationSettings = Object.freeze({
  mediaValidationMode: "fast",
  rules: { ...validationRuleDefaults }
} as const satisfies ValidationSettings);

function normalizeSeverity(value: unknown, fallback: ValidationSeverity = "warning"): ValidationSeverity {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "error") {
    return "error";
  }

  if (normalized === "warning" || normalized === "warn") {
    return "warning";
  }

  return fallback;
}

function normalizeMediaValidationMode(value: unknown): MediaValidationMode {
  return String(value || "").trim().toLowerCase() === "complete" ? "complete" : "fast";
}

function normalizeValidationSettings(input: unknown = {}): ValidationSettings {
  const source = input && typeof input === "object" ? input : {};
  const sourceRecord = source as Record<string, unknown>;
  const rawRules = sourceRecord.rules && typeof sourceRecord.rules === "object"
    ? sourceRecord.rules as Record<string, unknown>
    : {};
  const rules = Object.fromEntries(
    Object.entries(validationRuleDefaults).map(([rule, fallback]) => [
      rule,
      normalizeSeverity(rawRules[rule], fallback)
    ])
  ) as Record<ValidationRule, ValidationSeverity>;

  return {
    mediaValidationMode: normalizeMediaValidationMode(sourceRecord.mediaValidationMode),
    rules
  };
}

function readValidationSettings(): ValidationSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(deckContextFile, "utf8"));
    return normalizeValidationSettings(raw && raw.deck && raw.deck.validationSettings);
  } catch (error) {
    return normalizeValidationSettings(defaultValidationSettings);
  }
}

function resolveValidationLevel(
  rule: string,
  fallbackLevel: ValidationLevel,
  settings: unknown
): ValidationLevel {
  const normalized = normalizeValidationSettings(settings);
  const configured = normalized.rules[rule as ValidationRule];
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
