export const llmEnvKeys = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "LMSTUDIO_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];

export function createLmStudioStreamResponse(data: unknown, options: { id?: string; model?: string } = {}): Response {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const payload = {
        choices: [
          {
            delta: {
              content
            },
            finish_reason: null
          }
        ],
        id: options.id || "chatcmpl-coverage",
        model: options.model || "semantic-coverage-model"
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream"
    },
    status: 200
  });
}

export function createLlmRuntimeSnapshot() {
  const originalFetch = global.fetch;
  const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));

  function clearEnv(): void {
    llmEnvKeys.forEach((key) => {
      delete process.env[key];
    });
  }

  function restore(): void {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }

  return {
    clearEnv,
    restore
  };
}

type PresentationRecord = {
  id: string;
};

type PresentationRegistry<TPresentation extends PresentationRecord> = {
  activePresentationId: string;
  presentations: TPresentation[];
};

type PresentationCleanupServices<TPresentation extends PresentationRecord> = {
  deletePresentation: (id: string) => void;
  listPresentations: () => PresentationRegistry<TPresentation>;
  setActivePresentation: (id: string) => void;
};

export function createPresentationCleanup<TPresentation extends PresentationRecord>(services: PresentationCleanupServices<TPresentation>) {
  const createdPresentationIds = new Set<string>();
  const originalActivePresentationId = services.listPresentations().activePresentationId;

  function track(presentationId: string): void {
    createdPresentationIds.add(presentationId);
  }

  function cleanup(): void {
    const current = services.listPresentations();
    const knownIds = new Set(current.presentations.map((presentation: TPresentation) => presentation.id));

    for (const id of createdPresentationIds) {
      if (!knownIds.has(id)) {
        continue;
      }

      try {
        services.deletePresentation(id);
      } catch (error) {
        // Keep cleanup best-effort so the original assertion failure remains visible.
      }
    }

    const afterCleanup = services.listPresentations();
    if (afterCleanup.presentations.some((presentation: TPresentation) => presentation.id === originalActivePresentationId)) {
      services.setActivePresentation(originalActivePresentationId);
    }
  }

  return {
    cleanup,
    track
  };
}
