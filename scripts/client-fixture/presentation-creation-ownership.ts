import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app-composition.ts"), "utf8");
const appCallbacksSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/app-callbacks.ts"), "utf8");
const presentationCreationActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-actions.ts"), "utf8");
const presentationCreationControlSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-control.ts"), "utf8");
const presentationCreationStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-state.ts"), "utf8");
const presentationCreationWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/creation/presentation-creation-workbench.ts"), "utf8");
const startupActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/startup-actions.ts"), "utf8");
const workspaceRefreshWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/workspace-refresh-workbench.ts"), "utf8");

function validateClientPresentationCreationOwnership(): void {
  assert(
    /namespace StudioClientPresentationCreationWorkbench/.test(presentationCreationWorkbenchSource)
      && /function createPresentationCreationWorkbench/.test(presentationCreationWorkbenchSource)
      && /function getFields/.test(presentationCreationWorkbenchSource)
      && /function applyFields/.test(presentationCreationWorkbenchSource)
      && /function mountInputs/.test(presentationCreationWorkbenchSource)
      && /function normalizeStage/.test(presentationCreationWorkbenchSource)
      && /function getStageAccess/.test(presentationCreationWorkbenchSource)
      && /function getEditableDeckPlan/.test(presentationCreationWorkbenchSource)
      && /function renderDraft/.test(presentationCreationWorkbenchSource)
      && /function renderCreationOutline/.test(presentationCreationWorkbenchSource)
      && /function saveEditableOutlineDraft/.test(presentationCreationWorkbenchSource)
      && /async function saveCreationDraft/.test(presentationCreationWorkbenchSource)
      && /async function generatePresentationOutline/.test(presentationCreationWorkbenchSource)
      && /async function approvePresentationOutline/.test(presentationCreationWorkbenchSource)
      && /async function createPresentationFromForm/.test(presentationCreationWorkbenchSource)
      && /function openCreatedPresentation/.test(presentationCreationWorkbenchSource)
      && /StudioClientPresentationCreationWorkbench\.createPresentationCreationWorkbench/.test(presentationCreationActionsSource)
      && /StudioClientCore\.createDomElement/.test(presentationCreationActionsSource)
      && /StudioClientCore\.request/.test(presentationCreationActionsSource)
      && /const presentationCreationWorkbench = StudioClientPresentationCreationActions\.createPresentationCreationWorkbench/.test(appSource)
      && /presentationCreationWorkbench\.mountInputs\(\);/.test(startupActionsSource)
      && !/function getCreationFields/.test(appSource)
      && !/function applyCreationFields/.test(appSource)
      && !/function normalizeCreationStage/.test(appSource)
      && !/function getCreationStageAccess/.test(appSource)
      && !/function getEditableDeckPlan/.test(appSource)
      && /getPresentationCreationWorkbench: \(\) => presentationCreationWorkbench/.test(appSource)
      && /getPresentationCreationWorkbench\(\)\.renderDraft\(\)/.test(appCallbacksSource)
      && !/function renderCreationOutline/.test(appSource)
      && !/function saveEditableOutlineDraft/.test(appSource)
      && !/async function saveCreationDraft/.test(appSource)
      && !/async function generatePresentationOutline/.test(appSource)
      && !/async function approvePresentationOutline/.test(appSource)
      && !/async function createPresentationFromForm/.test(appSource)
      && !/function openCreatedPresentation/.test(appSource)
      && !/function clearPresentationForm/.test(appSource)
      && !/function mountPresentationCreateInputs/.test(appSource)
      && !/creationDraftSaveTimer/.test(appSource),
    "Presentation creation field mapping, stage rules, outline rendering, staged actions, and input mounting should live in the creation workbench script"
  );
  assert(
    /namespace StudioClientPresentationCreationState/.test(presentationCreationStateSource)
      && /function getPresentationState/.test(presentationCreationStateSource)
      && /function isWorkflowRunning/.test(presentationCreationStateSource)
      && /function isEmptyCreationDraft/.test(presentationCreationStateSource)
      && /StudioClientPresentationCreationState\.getPresentationState\(state\)/.test(presentationCreationActionsSource)
      && /StudioClientPresentationCreationState\.isWorkflowRunning\(state\)/.test(presentationCreationActionsSource)
      && /StudioClientPresentationCreationState\.isEmptyCreationDraft\(draft\)/.test(presentationCreationActionsSource)
      && !/StudioClientPresentationCreationState\.getPresentationState\(state\)/.test(appSource)
      && !/StudioClientPresentationCreationState\.isWorkflowRunning\(state\)/.test(appSource)
      && !/StudioClientPresentationCreationState\.isEmptyCreationDraft\(draft\)/.test(appSource)
      && !/const imageSearch = isJsonRecord\(fields\.imageSearch\)/.test(appSource),
    "Presentation creation state projection and draft checks should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientPresentationCreationControl/.test(presentationCreationControlSource)
      && /function resetControl/.test(presentationCreationControlSource)
      && /function hydrateDraftFields/.test(presentationCreationControlSource)
      && /state\.ui\.creationContentSlideIndex = 1/.test(presentationCreationControlSource)
      && /state\.ui\.creationStage = workbench\.normalizeStage/.test(presentationCreationControlSource)
      && /StudioClientPresentationCreationControl\.resetControl/.test(presentationCreationActionsSource)
      && !/StudioClientPresentationCreationControl\.resetControl/.test(appSource)
      && /StudioClientPresentationCreationControl\.hydrateDraftFields/.test(workspaceRefreshWorkbenchSource)
      && !/StudioClientPresentationCreationControl\.hydrateDraftFields/.test(appSource)
      && !/elements\.presentationMaterialFile\.value = ""/.test(appSource)
      && !/presentationCreationWorkbench\.applyFields\(state\.creationDraft\.fields\)/.test(appSource)
      && !/state\.ui\.creationContentSlidePinned = false/.test(appSource),
    "Presentation creation reset and draft hydration wiring should live outside the main app orchestrator"
  );
}

export { validateClientPresentationCreationOwnership };
