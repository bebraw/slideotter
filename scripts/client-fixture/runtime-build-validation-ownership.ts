import { createRequire } from "node:module";
import { clientModuleLazyLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const buildValidationActionsSource = readClientSource("runtime/build-validation-actions.ts");
const buildValidationWorkbenchSource = readClientSource("runtime/build-validation-workbench.ts");
const checkRemediationStateSource = readClientSource("runtime/check-remediation-state.ts");
const deckContextFormSource = readClientSource("planning/deck-context-form.ts");
const exportWorkbenchSource = readClientSource("exports/export-workbench.ts");
const runtimePayloadStateSource = readClientSource("runtime/runtime-payload-state.ts");
const validationReportWorkbenchSource = readClientSource("runtime/validation-report-workbench.ts");
const validationSettingsFormSource = readClientSource("runtime/validation-settings-form.ts");

function validateClientRuntimeBuildValidationOwnership(): void {
  assert(
    /namespace StudioClientCheckRemediationState/.test(checkRemediationStateSource)
      && /function getSlideIdForIssue/.test(checkRemediationStateSource)
      && /function applyPayload/.test(checkRemediationStateSource)
      && /StudioClientCheckRemediationState\.getSlideIdForIssue\(state, issue\)/.test(validationReportWorkbenchSource)
      && /StudioClientCheckRemediationState\.applyPayload\(state, payload, slideId\)/.test(validationReportWorkbenchSource)
      && !/StudioClientCheckRemediationState\.getSlideIdForIssue\(state, issue\)/.test(appSource)
      && !/StudioClientCheckRemediationState\.applyPayload\(state, payload, slideId\)/.test(appSource),
    "Check remediation state updates should live inside the lazy validation report workbench"
  );
  assert(
    /namespace StudioClientValidationSettingsForm/.test(validationSettingsFormSource)
      && /function apply/.test(validationSettingsFormSource)
      && /function read/.test(validationSettingsFormSource)
      && /StudioClientValidationSettingsForm\.apply\(documentRef, elements, deck\.validationSettings \|\| \{\}\)/.test(deckContextFormSource)
      && /StudioClientValidationSettingsForm\.read\(documentRef, elements\)/.test(buildValidationWorkbenchSource)
      && /namespace StudioClientBuildValidationActions/.test(buildValidationActionsSource)
      && /import\("\.\/build-validation-workbench\.ts"\)/.test(buildValidationActionsSource)
      && !clientModuleLazyLoaded("runtime/build-validation-workbench.ts", appSource)
      && !/StudioClientValidationSettingsForm\.read\(window\.document, elements\)/.test(appSource)
      && !/function getValidationRuleSelects/.test(appSource),
    "Validation settings form state should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientRuntimePayloadState/.test(runtimePayloadStateSource)
      && /function applyBuildPayload/.test(runtimePayloadStateSource)
      && /function applyValidationPayload/.test(runtimePayloadStateSource)
      && /function applyRuntimePayload/.test(runtimePayloadStateSource)
      && /StudioClientRuntimePayloadState\.applyBuildPayload\(state, payload\)/.test(buildValidationWorkbenchSource)
      && /StudioClientRuntimePayloadState\.applyValidationPayload\(state, payload\)/.test(buildValidationWorkbenchSource)
      && /StudioClientRuntimePayloadState\.applyRuntimePayload\(state, payload\)/.test(exportWorkbenchSource)
      && !/StudioClientRuntimePayloadState\.applyBuildPayload\(state, payload\)/.test(appSource)
      && !/StudioClientRuntimePayloadState\.applyValidationPayload\(state, payload\)/.test(appSource)
      && !/state\.previews = payload\.previews/.test(appSource),
    "Runtime/build/validation response state updates should live outside the main app orchestrator"
  );
}

export { validateClientRuntimeBuildValidationOwnership };
