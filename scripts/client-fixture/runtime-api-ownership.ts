import { createRequire } from "node:module";
import { clientModuleLazyLoaded, clientModuleLoaded, readClientSource } from "./source-utils.ts";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = readClientSource("app-composition.ts");
const appCallbacksSource = readClientSource("core/app-callbacks.ts");
const apiExplorerActionsSource = readClientSource("api/api-explorer-actions.ts");
const apiExplorerStateSource = readClientSource("api/api-explorer-state.ts");
const apiExplorerSource = readClientSource("api/api-explorer.ts");
const llmStatusSource = readClientSource("runtime/llm-status.ts");
const mainSource = readClientSource("main.ts");
const navigationShellSource = readClientSource("shell/navigation-shell.ts");
const runtimeStatusActionsSource = readClientSource("runtime/runtime-status-actions.ts");
const runtimeStatusWorkbenchSource = readClientSource("runtime/runtime-status-workbench.ts");
const validationReportActionsSource = readClientSource("runtime/validation-report-actions.ts");
const validationReportSource = readClientSource("runtime/validation-report.ts");
const validationReportWorkbenchSource = readClientSource("runtime/validation-report-workbench.ts");
const eagerLoadSources = [mainSource, appSource, navigationShellSource];

function validateClientRuntimeApiOwnership(): void {
  assert(
    /namespace StudioClientApiExplorer/.test(apiExplorerSource)
      && /function createApiExplorer/.test(apiExplorerSource)
      && /function mount\(\)/.test(apiExplorerSource)
      && /import\("\.\/api-explorer\.ts"\)/.test(apiExplorerActionsSource)
      && /async function getApiExplorer/.test(apiExplorerActionsSource)
      && /const lazyWorkbench = StudioClientLazyWorkbench\.createLazyWorkbenchModule/.test(apiExplorerActionsSource)
      && !/async function getApiExplorer/.test(appSource)
      && !clientModuleLoaded("api/api-explorer.ts", eagerLoadSources),
    "API Explorer behavior should live in a lazily loaded feature script with its own mount"
  );
  assert(
    /namespace StudioClientApiExplorerState/.test(apiExplorerStateSource)
      && /function getExplorerState/.test(apiExplorerStateSource)
      && /StudioClientApiExplorerState\.getExplorerState\(state\)/.test(apiExplorerActionsSource)
      && !/StudioClientApiExplorerState\.getExplorerState\(state\)/.test(appSource)
      && !/state\.hypermedia = \{ activePresentation: null/.test(appSource),
    "API Explorer state initialization should live outside the main app orchestrator"
  );
  assert(
    /namespace StudioClientLlmStatus/.test(llmStatusSource)
      && /function createLlmStatus/.test(llmStatusSource)
      && /function getConnectionView/.test(llmStatusSource)
      && /function togglePopover/.test(llmStatusSource)
      && /await import\("\.\/llm-status\.ts"\)/.test(runtimeStatusActionsSource)
      && /StudioClientLlmStatus\.createLlmStatus/.test(runtimeStatusActionsSource)
      && !clientModuleLoaded("runtime/llm-status.ts", eagerLoadSources)
      && !/const llmStatus = StudioClientLlmStatus\.createLlmStatus/.test(appSource)
      && /llmStatus\.getConnectionView\(llm\)/.test(runtimeStatusWorkbenchSource),
    "LLM status view and popover state should live behind runtime status actions"
  );
  assert(
    /namespace StudioClientRuntimeStatusWorkbench/.test(runtimeStatusWorkbenchSource)
      && /function createRuntimeStatusWorkbench/.test(runtimeStatusWorkbenchSource)
      && /function renderStatus\(\)/.test(runtimeStatusWorkbenchSource)
      && /function renderWorkflowHistory\(\)/.test(runtimeStatusWorkbenchSource)
      && /function renderSourceRetrieval\(\)/.test(runtimeStatusWorkbenchSource)
      && /function renderPromptBudget\(\)/.test(runtimeStatusWorkbenchSource)
      && /function connectRuntimeStream\(\)/.test(runtimeStatusWorkbenchSource)
      && /async function checkLlmProvider/.test(runtimeStatusWorkbenchSource)
      && /namespace StudioClientRuntimeStatusActions/.test(runtimeStatusActionsSource)
      && /import\("\.\/runtime-status-workbench\.ts"\)/.test(runtimeStatusActionsSource)
      && /const lazyWorkbench = StudioClientLazyWorkbench\.createLazyWorkbench/.test(runtimeStatusActionsSource)
      && /const runtimeStatusActions = StudioClientRuntimeStatusActions\.createRuntimeStatusActions/.test(appSource)
      && /getRuntimeStatusActions: registry\.getRuntimeStatusActions/.test(appSource)
      && /getRuntimeStatusActions\(\)\.renderStatus\(\)/.test(appCallbacksSource)
      && !clientModuleLoaded("runtime/runtime-status-workbench.ts", eagerLoadSources)
      && !clientModuleLazyLoaded("runtime/runtime-status-workbench.ts", appSource)
      && !/const llmView = llmStatus\.getConnectionView\(llm\)/.test(appSource)
      && !/let runtimeEventSource/.test(appSource)
      && !/new window\.EventSource\("\/api\/runtime\/stream"\)/.test(appSource)
      && !/function formatCharCount\(value\)/.test(appSource),
    "Runtime status, diagnostics rendering, LLM checking, and runtime stream lifecycle should live behind the runtime status action split point"
  );
  assert(
    /namespace StudioClientValidationReport/.test(validationReportSource)
      && /function renderValidationReport/.test(validationReportSource)
      && /namespace StudioClientValidationReportWorkbench/.test(validationReportWorkbenchSource)
      && /function createValidationReportWorkbench/.test(validationReportWorkbenchSource)
      && /function suggestValidationRemediation/.test(validationReportWorkbenchSource)
      && /validation-summary-card/.test(validationReportSource)
      && /No checks run yet/.test(validationReportSource)
      && /import\("\.\/validation-report-workbench\.ts"\)/.test(validationReportActionsSource)
      && /lazyWorkbench\.load\(\)\.then/.test(validationReportActionsSource)
      && !/validationReportWorkbench\.load\(\)\.then/.test(appSource)
      && !/async function getValidationReportRenderer/.test(appSource)
      && !/function suggestValidationRemediation/.test(appSource)
      && !clientModuleLoaded("validation-report-control.ts", eagerLoadSources)
      && !/elements\.validationSummary\.replaceChildren\(\)/.test(appSource)
      && !clientModuleLazyLoaded("runtime/validation-report.ts", appSource)
      && !clientModuleLoaded("runtime/validation-report.ts", eagerLoadSources),
    "Validation report rendering and remediation control flow should live in a lazily loaded feature script"
  );
}

export { validateClientRuntimeApiOwnership };
