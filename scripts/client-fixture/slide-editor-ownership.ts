import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const commandControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/command-controls.ts"), "utf8");
const inlineTextEditingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/inline-text-editing.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "studio/client/index.html"), "utf8");
const manualSlideFormRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/manual-slide-form-rendering.ts"), "utf8");
const materialPanelRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/material-panel-rendering.ts"), "utf8");
const slideEditorActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-editor-actions.ts"), "utf8");
const slideEditorWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-editor-workbench.ts"), "utf8");
const slideLoadActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-actions.ts"), "utf8");
const slideLoadStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-state.ts"), "utf8");
const slideLoadWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-load-workbench.ts"), "utf8");
const slideSelectionActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-selection-actions.ts"), "utf8");
const slideSelectionStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-selection-state.ts"), "utf8");
const slideSpecEditorActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-spec-editor-actions.ts"), "utf8");
const slideSpecPathSource = fs.readFileSync(path.join(process.cwd(), "studio/client/editor/slide-spec-path.ts"), "utf8");
const urlStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/url-state.ts"), "utf8");

function validateClientSlideEditorOwnership(): void {
  assert(
    /slideLoadRequestSeq/.test(slideLoadWorkbenchSource)
      && /isCurrentAbortableRequest\(\s*state,\s*"slideLoadAbortController",\s*"slideLoadRequestSeq",\s*requestSeq,\s*abortController\s*\)/.test(slideLoadWorkbenchSource)
      && !/isCurrentAbortableRequest\(state, "slideLoadAbortController", "slideLoadRequestSeq", requestSeq, abortController\)/.test(appSource),
    "loadSlide should guard against stale slide responses"
  );
  assert(
    /namespace StudioClientUrlState/.test(urlStateSource)
      && /function getSlideParam/.test(urlStateSource)
      && /function setSlideParam/.test(urlStateSource)
      && /function getUrlSlideParam/.test(slideSelectionActionsSource)
      && /StudioClientUrlState\.getSlideParam\(windowRef\)/.test(slideSelectionActionsSource)
      && /StudioClientUrlState\.setSlideParam\(windowRef, slideId\)/.test(slideSelectionActionsSource)
      && !/function getUrlSlideParam/.test(appSource)
      && !/StudioClientUrlState\.getSlideParam\(window\)/.test(appSource)
      && !/StudioClientUrlState\.setSlideParam\(window, slideId\)/.test(appSource)
      && /namespace StudioClientSlideSelectionState/.test(slideSelectionStateSource)
      && /function resolveRequestedSlide/.test(slideSelectionStateSource)
      && /function getSlideByIndex/.test(slideSelectionStateSource)
      && /function syncSelectedSlideToActiveList/.test(slideSelectionStateSource)
      && /StudioClientSlideSelectionState\.getSlideByIndex\(state, index\)/.test(slideSelectionActionsSource)
      && /StudioClientSlideSelectionState\.syncSelectedSlideToActiveList\(state, getUrlSlideParam\(\)\)/.test(slideSelectionActionsSource)
      && !/StudioClientSlideSelectionState\.getSlideByIndex\(state, index\)/.test(appSource)
      && !/StudioClientSlideSelectionState\.syncSelectedSlideToActiveList\(state, getUrlSlideParam\(\)\)/.test(appSource),
    "Slide Studio should persist and restore the selected slide through the URL query"
  );
  assert(
    /slideLoadAbortController/.test(slideLoadWorkbenchSource)
      && /request(?:<[^>]+>)?\(`\/api\/v1\/slides\/\$\{slideId\}`,\s*\{\s*signal: abortController\.signal\s*\}\)/.test(slideLoadWorkbenchSource)
      && /namespace StudioClientSlideLoadActions/.test(slideLoadActionsSource)
      && /import\("\.\/slide-load-workbench\.ts"\)/.test(slideLoadActionsSource)
      && !/import\("\.\/editor\/slide-load-workbench\.ts"\)/.test(appSource)
      && !/request(?:<[^>]+>)?\(`\/api\/slides\/\$\{slideId\}`,\s*\{\s*signal: abortController\.signal\s*\}\)/.test(appSource),
    "loadSlide should abort superseded slide requests"
  );
  assert(
    /namespace StudioClientSlideLoadState/.test(slideLoadStateSource)
      && /type SlidePayload/.test(slideLoadStateSource)
      && /function applySlidePayload/.test(slideLoadStateSource)
      && /StudioClientSlideLoadState\.applySlidePayload\(state, slideId, payload\)/.test(slideLoadWorkbenchSource)
      && !/StudioClientSlideLoadState\.applySlidePayload\(state, slideId, payload\)/.test(appSource)
      && !/state\.selectedSlideIndex = payload\.slide\.index/.test(appSource),
    "Loaded slide payload state updates should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientSlideEditorWorkbench/.test(slideEditorWorkbenchSource)
      && /function createSlideEditorWorkbench/.test(slideEditorWorkbenchSource)
      && /function renderSlideFields/.test(slideEditorWorkbenchSource)
      && /function beginInlineTextEdit/.test(inlineTextEditingSource)
      && /function parseSlideSpecEditor/.test(slideSpecEditorActionsSource)
      && /function renderMaterials/.test(materialPanelRenderingSource)
      && /async function createSystemSlide/.test(slideEditorWorkbenchSource)
      && /async function deleteSlideFromDeck/.test(slideEditorWorkbenchSource)
      && /function mount\(\)/.test(slideEditorWorkbenchSource)
      && /from "\.\/slide-editor-workbench\.ts"/.test(slideEditorActionsSource)
      && /StudioClientSlideEditorActions\.createSlideEditorWorkbench/.test(appSource)
      && /StudioClientSlideEditorWorkbench\.createSlideEditorWorkbench/.test(slideEditorActionsSource)
      && /StudioClientCore\.formatSourceCodeNodes/.test(slideEditorActionsSource)
      && /slideEditorWorkbench\.mount\(\);/.test(commandControlsSource)
      && !/function beginInlineTextEdit/.test(appSource)
      && !/async function saveSlideSpec/.test(appSource)
      && !/async function createSystemSlide/.test(appSource)
      && !/async function attachMaterialToSlide/.test(appSource)
      && !/function getSelectedSlideMaterialId/.test(appSource),
    "Current-slide editing, inline edit, JSON editor, manual slide, and material actions should live in the slide editor workbench"
  );
  assert(
    /function updateStructuredDraftFromInlineEdit/.test(inlineTextEditingSource)
      && /element\.addEventListener\("input", handleInput\)/.test(inlineTextEditingSource)
      && /Previewing inline text edits/.test(inlineTextEditingSource),
    "Inline slide text editing should keep the structured draft JSON synchronized before save"
  );
  assert(
    /namespace StudioClientSlideSpecPath/.test(slideSpecPathSource)
      && /function pathToArray/.test(slideSpecPathSource)
      && /function getPathValue/.test(slideSpecPathSource)
      && /function cloneWithPath/.test(slideSpecPathSource)
      && /StudioClientSlideSpecPath\.getPathValue/.test(slideEditorWorkbenchSource)
      && /StudioClientSlideSpecPath\.cloneWithPath/.test(inlineTextEditingSource),
    "Slide spec path parsing and cloning should live in pure editor helpers"
  );
  assert(
    /Add after current slide/.test(indexSource)
      && /Add as subslide in vertical stack/.test(indexSource)
      && /Create subslide/.test(manualSlideFormRenderingSource),
    "Slide Studio should expose subslide creation through the manual slide form"
  );
}

export { validateClientSlideEditorOwnership };
