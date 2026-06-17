import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const candidateCountSource = readClientSource("variants/candidate-count.ts");
const coreSource = readClientSource("platform/core.ts");
const mainSource = readClientSource("main.ts");
const navigationShellSource = readClientSource("shell/navigation-shell.ts");
const variantActionsSource = readClientSource("variants/variant-actions.ts");
const variantGenerationControlsSource = readClientSource("variants/variant-generation-controls.ts");
const variantReviewActionsSource = readClientSource("variants/variant-review-actions.ts");
const variantReviewWorkbenchSource = readClientSource("variants/variant-review-workbench.ts");
const variantStateSource = readClientSource("variants/variant-state.ts");
const workflowSource = readClientSource("runtime/workflows.ts");
const eagerLoadSources = [mainSource, appSource, navigationShellSource];

function validateClientVariantOwnership(): void {
  assert(
    /namespace StudioClientCandidateCount/.test(candidateCountSource)
      && /function readNormalized/.test(candidateCountSource)
      && /StudioClientCandidateCount\.readNormalized\(elements\.ideateCandidateCount\)/.test(variantActionsSource)
      && /import\("\.\/candidate-count\.ts"\)/.test(variantActionsSource)
      && !clientModuleLazyLoaded("variants/candidate-count.ts", appSource)
      && !/import \{ StudioClientCandidateCount \} from "\.\/variants\/candidate-count\.ts";/.test(appSource)
      && !/Number\.parseInt\(elements\.ideateCandidateCount\.value/.test(appSource),
    "Candidate count normalization should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientVariantGenerationControls/.test(variantGenerationControlsSource)
      && /function open/.test(variantGenerationControlsSource)
      && /StudioClientVariantGenerationControls\.open\(windowRef\.document\)/.test(variantActionsSource)
      && /StudioClientVariantGenerationControls\.open\(windowRef\.document\)/.test(variantReviewWorkbenchSource)
      && /import\("\.\/variant-generation-controls\.ts"\)/.test(variantActionsSource)
      && !clientModuleLazyLoaded("variants/variant-generation-controls.ts", appSource)
      && !/import \{ StudioClientVariantGenerationControls \} from "\.\/variants\/variant-generation-controls\.ts";/.test(appSource)
      && !/querySelector\("\.variant-generation-details"\)/.test(appSource)
      && !/querySelector\("\.variant-generation-details"\)/.test(variantReviewWorkbenchSource),
    "Variant generation details disclosure DOM handling should live in a shared helper"
  );

  const renderVariantsFunction = variantReviewWorkbenchSource.match(/function render\(\)(?:: [^{]+)? \{[\s\S]*?\n    function renderComparison/);
  assert(renderVariantsFunction, "Expected variant rendering in variant review workbench");
  if (!renderVariantsFunction) {
    throw new Error("Expected variant rendering in variant review workbench");
  }
  assert(/function createDomElement\(tagName/.test(coreSource), "Expected small DOM element builder helper");
  assert(
    /createDomElement\("button"[\s\S]*data-action/.test(renderVariantsFunction[0])
      && !/card\.innerHTML\s*=/.test(renderVariantsFunction[0]),
    "Variant cards should use DOM builders instead of dynamic innerHTML"
  );
  assert(
    /previousVariantListScrollTop = elements\.variantList\.scrollTop/.test(renderVariantsFunction[0])
      && /elements\.variantList\.scrollTop = previousVariantListScrollTop/.test(renderVariantsFunction[0]),
    "Variant selection should preserve the candidate rail scroll position while rerendering"
  );
  assert(
    /Generating \$\{candidateCount\} slide variant/.test(workflowSource)
      && /state\.ui\.variantReviewOpen = true/.test(workflowSource)
      && /renderVariants\(\);/.test(workflowSource)
      && /Generating candidates/.test(variantReviewWorkbenchSource)
      && /StudioClientWorkflowStatus\.hasActiveSlideWorkflow/.test(variantReviewWorkbenchSource),
    "Slide variant generation should show immediate progress while the LLM request is in flight"
  );
  assert(
    /namespace StudioClientVariantReviewWorkbench/.test(variantReviewWorkbenchSource)
      && /function createVariantReviewWorkbench/.test(variantReviewWorkbenchSource)
      && /function renderComparison/.test(variantReviewWorkbenchSource)
      && /async function captureVariant/.test(variantReviewWorkbenchSource)
      && /async function applyVariantById/.test(variantReviewWorkbenchSource)
      && /function mount\(\)/.test(variantReviewWorkbenchSource)
      && /import\("\.\/variant-review-workbench\.ts"\)/.test(variantReviewActionsSource)
      && !clientModuleLazyLoaded("variants/variant-review-workbench.ts", appSource)
      && /async function getLoadedWorkbench/.test(variantReviewActionsSource)
      && !/async function getVariantReviewWorkbench/.test(appSource)
      && !/function loadVariantReviewWorkbench/.test(appSource)
      && /mount: \(workbench\) => workbench\.mount\(\)/.test(variantReviewActionsSource)
      && !clientModuleLoaded("variants/variant-review-workbench.ts", eagerLoadSources)
      && !/async function captureVariant/.test(appSource)
      && !/async function applyVariantById/.test(appSource)
      && !/function canSaveVariantLayout/.test(appSource)
      && !/function describeVariantKind/.test(appSource),
    "Variant review rendering, comparison, and actions should live in the variant review workbench"
  );
  assert(
    /namespace StudioClientVariantState/.test(variantStateSource)
      && /function getSlideVariants/.test(variantStateSource)
      && /function getSelectedVariant/.test(variantStateSource)
      && /function clearTransientVariants/.test(variantStateSource)
      && /function replacePersistedVariantsForSlide/.test(variantStateSource)
      && /StudioClientVariantState\.getSlideVariants\(state\)/.test(variantActionsSource)
      && /StudioClientVariantState\.getSelectedVariant\(state\)/.test(variantActionsSource)
      && /StudioClientVariantState\.clearTransientVariants\(state, slideId\)/.test(variantActionsSource)
      && /StudioClientVariantState\.replacePersistedVariantsForSlide\(state, slideId, variants\)/.test(variantActionsSource)
      && /StudioClientVariantState\.getSlideVariants\(state\)/.test(variantReviewWorkbenchSource),
    "Slide variant state selection and replacement rules should be shared across app and variant review workbench"
  );
}

export { validateClientVariantOwnership };
