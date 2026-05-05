import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app-composition.ts"), "utf8");
const candidateCountSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/candidate-count.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/platform/core.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const variantActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-actions.ts"), "utf8");
const variantGenerationControlsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-generation-controls.ts"), "utf8");
const variantReviewActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-review-actions.ts"), "utf8");
const variantReviewWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-review-workbench.ts"), "utf8");
const variantStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/variants/variant-state.ts"), "utf8");
const workflowSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/workflows.ts"), "utf8");

function clientModuleLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`import (?:\\{[^}]+\\} from )?"\\./${escaped}";`);
  return pattern.test(mainSource)
    || pattern.test(appSource)
    || pattern.test(navigationShellSource);
}

function clientModuleLazyLoaded(fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`import\\("\\./${escaped}"\\)`).test(appSource);
}

function validateClientVariantOwnership(): void {
  assert(
    /namespace StudioClientCandidateCount/.test(candidateCountSource)
      && /function readNormalized/.test(candidateCountSource)
      && /StudioClientCandidateCount\.readNormalized\(elements\.ideateCandidateCount\)/.test(variantActionsSource)
      && /import\("\.\/candidate-count\.ts"\)/.test(variantActionsSource)
      && !clientModuleLazyLoaded("variants/candidate-count.ts")
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
      && !clientModuleLazyLoaded("variants/variant-generation-controls.ts")
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
      && !clientModuleLazyLoaded("variants/variant-review-workbench.ts")
      && /async function getLoadedWorkbench/.test(variantReviewActionsSource)
      && !/async function getVariantReviewWorkbench/.test(appSource)
      && !/function loadVariantReviewWorkbench/.test(appSource)
      && /mount: \(workbench\) => workbench\.mount\(\)/.test(variantReviewActionsSource)
      && !clientModuleLoaded("variants/variant-review-workbench.ts")
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
