import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const coreSource = fs.readFileSync(path.join(process.cwd(), "studio/client/platform/core.ts"), "utf8");
const deckPlanningActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-planning-actions.ts"), "utf8");
const deckPlanningWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-planning-workbench.ts"), "utf8");
const deckStructurePreviewRenderingSource = fs.readFileSync(path.join(process.cwd(), "studio/client/planning/deck-structure-preview-rendering.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const stateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/state.ts"), "utf8");
const workflowActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/workflow-actions.ts"), "utf8");
const workflowWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/workflow-workbench.ts"), "utf8");
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

function validateClientDeckPlanningOwnership(): void {
  assert(
    /namespace StudioClientWorkflows/.test(workflowSource)
      && /function createWorkflowRunners/.test(workflowSource)
      && /function runSlideCandidate/.test(workflowSource)
      && /function runDeckStructure/.test(workflowSource)
      && /namespace StudioClientWorkflowWorkbench/.test(workflowWorkbenchSource)
      && /function createWorkflowWorkbench/.test(workflowWorkbenchSource)
      && /namespace StudioClientWorkflowActions/.test(workflowActionsSource)
      && /import\("\.\/workflow-workbench\.ts"\)/.test(workflowActionsSource)
      && !clientModuleLazyLoaded("runtime/workflow-workbench.ts")
      && /StudioClientWorkflows\.createWorkflowRunners/.test(workflowWorkbenchSource)
      && !/let workflowRunners: WorkflowRunners \| null = null/.test(appSource)
      && !/async function getWorkflowRunners/.test(appSource)
      && !/StudioClientWorkflows\.createWorkflowRunners/.test(appSource)
      && !clientModuleLazyLoaded("runtime/workflows.ts")
      && !clientModuleLoaded("runtime/workflows.ts"),
    "Shared candidate workflow runners and command wiring should live in a lazily loaded feature script"
  );
  assert(
    /ideateDeckStructure: workflowActions\.ideateDeckStructure/.test(appSource)
      && /ideateDeckStructure: \(\) => runners\.runDeckStructure\(\{/.test(workflowWorkbenchSource),
    "Deck-structure generation should use the shared deck workflow runner"
  );
  const deckStructureWorkflowFunction = workflowSource.match(/async function runDeckStructure\(\{ button, endpoint \}(?:: [^)]+)?\): Promise<void> \{[\s\S]*?\n    \}/);
  assert(deckStructureWorkflowFunction, "Expected shared deck-structure workflow runner");
  if (!deckStructureWorkflowFunction) {
    throw new Error("Expected shared deck-structure workflow runner");
  }
  assert(
    /candidateCount:\s*await getRequestedCandidateCount\(\)/.test(deckStructureWorkflowFunction[0]),
    "Deck-structure workflow should send the requested candidate count"
  );
  assert(
    /deckStructureAbortController/.test(workflowSource)
      && /deckStructureRequestSeq/.test(workflowSource)
      && /signal: abortController\.signal/.test(deckStructureWorkflowFunction[0]),
    "Deck-structure workflow should combine abort controllers with sequence guards"
  );
  assert(
    /function applyDeckStructurePayload\(payload(?:: [^)]+)?\)/.test(workflowSource)
      && /applyDeckStructurePayload\(payload\)/.test(deckStructureWorkflowFunction[0])
      && !/function applyDeckStructureWorkflowPayload\(payload\)/.test(appSource),
    "Deck-structure workflow payload application should live in the workflow runner module"
  );
  assert(
    /function runDeckStructure/.test(workflowSource)
      && /function runSlideCandidate/.test(workflowSource)
      && /postJson\(endpoint/.test(workflowSource),
    "Candidate workflow runners should use the shared JSON POST helper"
  );
  assert(
    /setDeckStructureCandidates: \(candidates: unknown\[\] \| undefined\)/.test(deckPlanningActionsSource)
      && !/state\.deckStructureCandidates = payload\.deckStructureCandidates/.test(appSource),
    "Deck-structure payload application should use the candidate selection helper"
  );

  ["ideateSlide", "ideateTheme", "ideateStructure", "redoLayout"].forEach((functionName) => {
    const appPattern = new RegExp(`${functionName}: workflowActions\\.${functionName}`);
    const workbenchPattern = new RegExp(`${functionName}: \\(\\) => runners\\.runSlideCandidate\\(\\{`);
    assert(
      appPattern.test(appSource) && workbenchPattern.test(workflowWorkbenchSource),
      `${functionName} should use the shared slide candidate workflow runner`
    );
  });

  assert(
    /function applySlidePayload\(payload(?:: [^,]+)?, slideId(?:: [^)]+)?\)/.test(workflowSource)
      && /applySlidePayload\(payload, slideId\)/.test(workflowSource)
      && !/function applySlideWorkflowPayload\(payload, slideId\)/.test(appSource),
    "Slide workflow payload application should live in the workflow runner module"
  );
  assert(
    /slideWorkflowAbortController/.test(workflowSource)
      && /slideWorkflowRequestSeq/.test(workflowSource)
      && /signal: abortController\.signal/.test(workflowSource),
    "Slide candidate workflows should combine abort controllers with sequence guards"
  );
  assert(
    /isAbortError/.test(coreSource)
      && /StudioClientCore\.isAbortError/.test(workflowActionsSource)
      && !/isAbortError/.test(appSource),
    "Expected shared abort error helper to be wired in workflow actions"
  );
  assert(
    /function beginAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, requestSeqKey(?:: [^)]+)?\)/.test(stateSource)
      && /function isCurrentAbortableRequest\(\s*state(?:: [^,]+)?,\s*controllerKey(?:: [^,]+)?,\s*requestSeqKey(?:: [^,]+)?,\s*requestSeq(?:: [^,]+)?,\s*abortController(?:: [^)]+)?\s*\)/.test(stateSource)
      && /function clearAbortableRequest\(state(?:: [^,]+)?, controllerKey(?:: [^,]+)?, abortController(?:: [^)]+)?\)/.test(stateSource)
      && /beginAbortableRequest\(state, "slideWorkflowAbortController", "slideWorkflowRequestSeq"\)/.test(workflowSource),
    "Abortable workflow guards should use shared request guard helpers"
  );
  assert(
    /namespace StudioClientDeckPlanningWorkbench/.test(deckPlanningWorkbenchSource)
      && /function createDeckPlanningWorkbench/.test(deckPlanningWorkbenchSource)
      && /function renderDeckStructureCandidates/.test(deckPlanningWorkbenchSource)
      && /function renderDeckLengthPlan/.test(deckPlanningWorkbenchSource)
      && /function renderOutlinePlans/.test(deckPlanningWorkbenchSource)
      && /function renderSources/.test(deckPlanningWorkbenchSource)
      && /async function applyDeckStructureCandidate/.test(deckPlanningWorkbenchSource)
      && /async function generateOutlinePlan/.test(deckPlanningWorkbenchSource)
      && /async function addSource/.test(deckPlanningWorkbenchSource)
      && /function mount\(\)/.test(deckPlanningWorkbenchSource)
      && /import\("\.\/deck-planning-workbench\.ts"\)/.test(deckPlanningActionsSource)
      && !clientModuleLazyLoaded("planning/deck-planning-workbench.ts")
      && /async function getWorkbench/.test(deckPlanningActionsSource)
      && !/async function getDeckPlanningWorkbench/.test(appSource)
      && /onOutlineOpen: deckPlanningActions\.load/.test(appSource)
      && /mount: \(workbench\) => workbench\.mount\(\)/.test(deckPlanningActionsSource)
      && !clientModuleLoaded("planning/deck-planning-workbench.ts")
      && !/function buildDeckDiffSupport/.test(appSource)
      && !/function renderOutlinePlanComparison/.test(appSource)
      && !/async function applyDeckStructureCandidate/.test(appSource)
      && !/async function addSource/.test(appSource),
    "Deck planning, outline plans, deck length, and source-library actions should live in the deck planning workbench"
  );
  assert(
    /function renderDeckStructureStripCompare/.test(deckStructurePreviewRenderingSource)
      && /function renderDeckStructurePreviewHints/.test(deckStructurePreviewRenderingSource)
      && /renderDeckStructureStripCompare/.test(deckPlanningWorkbenchSource)
      && /renderDeckStructurePreviewHints/.test(deckPlanningWorkbenchSource)
      && !/deck-structure-preview-card/.test(deckPlanningWorkbenchSource),
    "Deck structure preview rendering should stay in a focused planning helper"
  );
}

export { validateClientDeckPlanningOwnership };
