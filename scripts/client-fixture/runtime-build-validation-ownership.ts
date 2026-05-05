import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app-composition.ts"), "utf8");
const buildValidationActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/build-validation-actions.ts"), "utf8");
const buildValidationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/build-validation-workbench.ts"), "utf8");
const checkRemediationStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/check-remediation-state.ts"), "utf8");
const deckContextFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-context-form.ts"), "utf8");
const exportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/exports/export-workbench.ts"), "utf8");
const runtimePayloadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/runtime-payload-state.ts"), "utf8");
const validationReportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report-workbench.ts"), "utf8");
const validationSettingsFormSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-settings-form.ts"), "utf8");

function clientModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(appSource);
}

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
      && !clientModuleLazyLoaded("runtime/build-validation-workbench.ts")
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
