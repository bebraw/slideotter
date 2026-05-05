import type { StudioClientState } from "../core/state.ts";

export type WorkflowSnapshot = StudioClientState.WorkflowState | null | undefined;

function isRunning(workflow: WorkflowSnapshot): boolean {
  return Boolean(workflow && workflow.status === "running");
}

function isRuntimeWorkflowRunning(runtime: StudioClientState.RuntimeState | null | undefined): boolean {
  return isRunning(runtime && runtime.workflow);
}

function hasActiveSlideWorkflow(
  state: Pick<StudioClientState.State, "runtime" | "slideWorkflowAbortController">
): boolean {
  return Boolean(state.slideWorkflowAbortController || isRuntimeWorkflowRunning(state.runtime));
}

export const StudioClientWorkflowStatus = {
  hasActiveSlideWorkflow,
  isRunning,
  isRuntimeWorkflowRunning
};
