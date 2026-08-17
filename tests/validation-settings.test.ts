import assert from "node:assert/strict";
import test from "node:test";

import "./helpers/isolated-user-data.mjs";
import {
  defaultValidationSettings,
  normalizeValidationSettings,
  readValidationSettings,
  resolveValidationLevel,
  validationRuleDefaults
} from "../studio/server/services/validation-settings.ts";
import {
  createPresentation,
  deletePresentation,
  listPresentations,
  setActivePresentation
} from "../studio/server/services/presentations.ts";
import { saveDeckContext } from "../studio/server/services/state.ts";

type ValidationSettingsPresentation = Record<string, unknown> & {
  id: string;
};

const createdPresentationIds = new Set<string>();
const originalActivePresentationId = listPresentations().activePresentationId;

function createValidationSettingsPresentation(suffix: string): ValidationSettingsPresentation {
  const presentation = createPresentation({
    audience: "Validation settings coverage",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise validation settings persistence.",
    title: `Validation Settings ${Date.now()} ${suffix}`
  }) as ValidationSettingsPresentation;
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function cleanupValidationSettingsPresentations(): void {
  const current = listPresentations();
  const currentPresentations = Array.isArray(current.presentations)
    ? current.presentations as ValidationSettingsPresentation[]
    : [];
  const knownIds = new Set(currentPresentations.map((presentation) => presentation.id));

  for (const id of createdPresentationIds) {
    if (!knownIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch {
      // Keep cleanup best-effort so the original assertion failure remains visible.
    }
  }

  const afterCleanup = listPresentations();
  const remainingPresentations = Array.isArray(afterCleanup.presentations)
    ? afterCleanup.presentations as ValidationSettingsPresentation[]
    : [];
  if (remainingPresentations.some((presentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

test.after(cleanupValidationSettingsPresentations);

test("validation settings expose stable defaults for all known rules", () => {
  const normalized = normalizeValidationSettings();

  assert.equal(normalized.mediaValidationMode, "fast");
  assert.deepEqual(normalized.rules, validationRuleDefaults);
  assert.deepEqual(defaultValidationSettings.rules, validationRuleDefaults);
});

test("validation settings normalize severity aliases and casing", () => {
  const normalized = normalizeValidationSettings({
    rules: {
      bounds: " WARNING ",
      "contrast-low": " ERROR ",
      "content-gap-tight": "error",
      "font-size-small": "warn"
    }
  });

  assert.equal(normalized.rules.bounds, "warning");
  assert.equal(normalized.rules["contrast-low"], "error");
  assert.equal(normalized.rules["content-gap-tight"], "error");
  assert.equal(normalized.rules["font-size-small"], "warning");
});

test("validation settings keep rule defaults for unsupported severity values", () => {
  const normalized = normalizeValidationSettings({
    rules: {
      bounds: "warn",
      "contrast-low": "not-a-severity",
      "font-size-small": "",
      "slide-word-count": false
    }
  });

  assert.equal(normalized.rules.bounds, "warning");
  assert.equal(normalized.rules["contrast-low"], "error");
  assert.equal(normalized.rules["font-size-small"], "warning");
  assert.equal(normalized.rules["slide-word-count"], "warning");
});

test("validation settings normalize media validation mode", () => {
  assert.equal(normalizeValidationSettings({
    mediaValidationMode: " COMPLETE "
  }).mediaValidationMode, "complete");
  assert.equal(normalizeValidationSettings({
    mediaValidationMode: "slow"
  }).mediaValidationMode, "fast");
  assert.equal(normalizeValidationSettings({
    mediaValidationMode: ""
  }).mediaValidationMode, "fast");
});

test("validation settings ignore non-object settings and rule maps", () => {
  assert.deepEqual(normalizeValidationSettings(null), defaultValidationSettings);
  assert.deepEqual(normalizeValidationSettings("complete"), defaultValidationSettings);
  assert.deepEqual(normalizeValidationSettings({
    mediaValidationMode: "complete",
    rules: "bounds:error"
  }), {
    mediaValidationMode: "complete",
    rules: validationRuleDefaults
  });
});

test("validation settings read active deck validation settings", () => {
  createValidationSettingsPresentation("active-deck");
  saveDeckContext({
    deck: {
      validationSettings: {
        mediaValidationMode: "complete",
        rules: {
          bounds: "warning",
          "content-gap-tight": "error"
        }
      }
    },
    slides: {}
  });

  const settings = readValidationSettings();

  assert.equal(settings.mediaValidationMode, "complete");
  assert.equal(settings.rules.bounds, "warning");
  assert.equal(settings.rules["content-gap-tight"], "error");
  assert.equal(settings.rules["contrast-low"], "error");
});

test("validation level resolution maps configured severities to validator levels", () => {
  assert.equal(resolveValidationLevel("bounds", "warn", {
    rules: {
      bounds: "error"
    }
  }), "error");
  assert.equal(resolveValidationLevel("contrast-low", "error", {
    rules: {
      "contrast-low": "warning"
    }
  }), "warn");
  assert.equal(resolveValidationLevel("unknown-rule", "error", {
    rules: {
      "unknown-rule": "warning"
    }
  }), "error");
});
