import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assert } = require("../fixture-helpers.ts");

const appSource = fs.readFileSync(path.join(process.cwd(), "studio/client/app.ts"), "utf8");
const appCallbacksSource = fs.readFileSync(path.join(process.cwd(), "studio/client/core/app-callbacks.ts"), "utf8");
const apiExplorerActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/api-explorer-actions.ts"), "utf8");
const apiExplorerStateSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/api-explorer-state.ts"), "utf8");
const apiExplorerSource = fs.readFileSync(path.join(process.cwd(), "studio/client/api/api-explorer.ts"), "utf8");
const llmStatusSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/llm-status.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(process.cwd(), "studio/client/main.ts"), "utf8");
const navigationShellSource = fs.readFileSync(path.join(process.cwd(), "studio/client/shell/navigation-shell.ts"), "utf8");
const runtimeStatusActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/runtime-status-actions.ts"), "utf8");
const runtimeStatusWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/runtime-status-workbench.ts"), "utf8");
const validationReportActionsSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report-actions.ts"), "utf8");
const validationReportSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report.ts"), "utf8");
const validationReportWorkbenchSource = fs.readFileSync(path.join(process.cwd(), "studio/client/runtime/validation-report-workbench.ts"), "utf8");

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

function validateClientRuntimeApiOwnership(): void {
  assert(
    /namespace StudioClientApiExplorer/.test(apiExplorerSource)
      && /function createApiExplorer/.test(apiExplorerSource)
      && /function mount\(\)/.test(apiExplorerSource)
      && /import\("\.\/api-explorer\.ts"\)/.test(apiExplorerActionsSource)
      && /async function getApiExplorer/.test(apiExplorerActionsSource)
      && /const lazyWorkbench = StudioClientLazyWorkbench\.createLazyWorkbenchModule/.test(apiExplorerActionsSource)
      && !/async function getApiExplorer/.test(appSource)
      && !clientModuleLoaded("api/api-explorer.ts"),
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
      && !clientModuleLoaded("runtime/llm-status.ts")
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
      && /runtimeStatusActions = StudioClientRuntimeStatusActions\.createRuntimeStatusActions/.test(appSource)
      && /getRuntimeStatusActions: \(\) => runtimeStatusActions/.test(appSource)
      && /getRuntimeStatusActions\(\)\.renderStatus\(\)/.test(appCallbacksSource)
      && !clientModuleLoaded("runtime/runtime-status-workbench.ts")
      && !clientModuleLazyLoaded("runtime/runtime-status-workbench.ts")
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
      && !clientModuleLoaded("validation-report-control.ts")
      && !/elements\.validationSummary\.replaceChildren\(\)/.test(appSource)
      && !clientModuleLazyLoaded("runtime/validation-report.ts")
      && !clientModuleLoaded("runtime/validation-report.ts"),
    "Validation report rendering and remediation control flow should live in a lazily loaded feature script"
  );
}

export { validateClientRuntimeApiOwnership };
