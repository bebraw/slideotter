import { getLlmStatus } from "./services/llm/client.ts";

type JsonObject = Record<string, unknown>;

type SseSubscriber = {
  end: () => unknown;
  write: (chunk: string) => unknown;
};

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;

type WorkflowEvent = JsonObject & {
  id?: number;
  message?: string;
  operation?: string;
  slideId?: string | null;
  stage?: string;
  status?: string;
  updatedAt?: string;
};

type WorkflowProgress = JsonObject & {
  llm?: {
    promptBudget?: JsonObject;
  };
  message?: string;
  operation?: string;
  slideId?: string | null;
  stage?: string;
  status?: string;
};

type RuntimeState = {
  build: {
    ok: boolean;
    updatedAt: string | null;
  };
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
  llmCheck: unknown;
  promptBudget: JsonObject | null;
  sourceRetrieval: unknown;
  validation: JsonObject | null;
  workflow: WorkflowEvent | null;
  workflowHistory: WorkflowEvent[];
  workflowSequence: number;
};

export const runtimeState: RuntimeState = {
  build: {
    ok: false,
    updatedAt: null
  },
  lastError: null,
  llmCheck: null,
  promptBudget: null,
  sourceRetrieval: null,
  validation: null,
  workflow: null,
  workflowHistory: [],
  workflowSequence: 0
};

const runtimeSubscribers: Set<SseSubscriber> = new Set();

export function writeSseEvent(res: SseSubscriber, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function publishSseEvent(event: string, payload: unknown): void {
  for (const subscriber of runtimeSubscribers) {
    try {
      writeSseEvent(subscriber, event, payload);
    } catch (error) {
      runtimeSubscribers.delete(subscriber);
      try {
        subscriber.end();
      } catch (endError) {
        // Ignore subscriber cleanup failures.
      }
    }
  }
}

export function publishCreationDraftUpdate(draft: unknown): void {
  publishSseEvent("creationDraft", {
    creationDraft: draft
  });
}

export function publishRuntimeState(): void {
  publishSseEvent("runtime", {
    runtime: serializeRuntimeState()
  });
}

function publishWorkflowEvent(event: WorkflowEvent): void {
  publishSseEvent("workflow", {
    workflowEvent: event
  });
}

function recordWorkflowEvent(workflow: WorkflowEvent | null): void {
  if (!workflow || !workflow.status) {
    return;
  }

  const previous = runtimeState.workflowHistory[runtimeState.workflowHistory.length - 1] || null;
  const nextEvent = {
    id: ++runtimeState.workflowSequence,
    message: workflow.message || "",
    operation: workflow.operation || "",
    slideId: workflow.slideId || null,
    stage: workflow.stage || "",
    status: workflow.status,
    updatedAt: workflow.updatedAt || new Date().toISOString()
  };

  if (
    previous
    && previous.message === nextEvent.message
    && previous.operation === nextEvent.operation
    && previous.slideId === nextEvent.slideId
    && previous.stage === nextEvent.stage
    && previous.status === nextEvent.status
  ) {
    return;
  }

  runtimeState.workflowHistory = [
    ...runtimeState.workflowHistory.slice(-11),
    nextEvent
  ];
  publishWorkflowEvent(nextEvent);
}

export function updateWorkflowState(nextWorkflow: WorkflowEvent): void {
  runtimeState.workflow = {
    ...(runtimeState.workflow || {}),
    ...nextWorkflow,
    updatedAt: new Date().toISOString()
  };
  recordWorkflowEvent(runtimeState.workflow);
  publishRuntimeState();
}

export function createWorkflowProgressReporter(baseState: WorkflowEvent): (progress: WorkflowProgress) => void {
  return (progress: WorkflowProgress): void => {
    if (progress && progress.llm && progress.llm.promptBudget) {
      runtimeState.promptBudget = {
        ...progress.llm.promptBudget,
        updatedAt: new Date().toISOString()
      };
    }

    updateWorkflowState({
      ...baseState,
      ok: false,
      status: "running",
      ...progress
    });
  };
}

export function serializeRuntimeState(): JsonObject {
  const llm = getLlmStatus();
  return {
    ...runtimeState,
    llm: {
      ...llm,
      lastCheck: runtimeState.llmCheck
    },
    workflowHistory: runtimeState.workflowHistory
  };
}

export function resetPresentationRuntime(): void {
  runtimeState.build = {
    ok: false,
    updatedAt: null
  };
  runtimeState.lastError = null;
  runtimeState.validation = null;
  runtimeState.sourceRetrieval = null;
  runtimeState.promptBudget = null;
  runtimeState.workflow = null;
  runtimeState.workflowHistory = [];
  runtimeState.workflowSequence = 0;
  publishRuntimeState();
}

export function registerRuntimeStream(
  req: ServerRequest,
  res: ServerResponse,
  creationDraft: unknown
): void {
  res.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8"
  });
  res.write("retry: 1000\n\n");
  runtimeSubscribers.add(res);
  writeSseEvent(res, "runtime", {
    runtime: serializeRuntimeState()
  });
  writeSseEvent(res, "creationDraft", {
    creationDraft
  });
  const heartbeat = setInterval(() => {
    try {
      res.write(": keep-alive\n\n");
    } catch (error) {
      clearInterval(heartbeat);
    }
  }, 15000);
  req.on("close", () => {
    clearInterval(heartbeat);
    runtimeSubscribers.delete(res);
  });
}
