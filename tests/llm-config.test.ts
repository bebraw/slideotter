const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createStructuredResponse,
  getLlmModelState,
  getLlmStatus,
  setLlmModelOverride
} = require("../studio/server/services/llm/client.ts");
const {
  getRuntimeLlmSettings,
  saveRuntimeLlmSettings
} = require("../studio/server/services/presentations.ts");

const trackedEnvKeys = [
  "LMSTUDIO_API_KEY",
  "LMSTUDIO_BASE_URL",
  "LMSTUDIO_MODEL",
  "OPENAI_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_MODEL",
  "STUDIO_LLM_BASE_URL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalEnv = Object.fromEntries(trackedEnvKeys.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;
const originalRuntimeLlmSettings = getRuntimeLlmSettings();

type ProgressEvent = {
  llm?: {
    chunks?: number;
    status?: string;
  };
};

type ChatRequest = {
  max_tokens?: number;
  messages: {
    content: string;
  }[];
  stream?: boolean;
};

function readJsonRequestBody(init: RequestInit | undefined): ChatRequest {
  if (typeof init?.body !== "string") {
    throw new Error("Expected JSON request body");
  }

  return JSON.parse(init.body) as ChatRequest;
}

function restoreEnv() {
  trackedEnvKeys.forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  });
}

test.after(() => {
  restoreEnv();
  saveRuntimeLlmSettings(originalRuntimeLlmSettings);
  global.fetch = originalFetch;
});

test("OpenRouter provider reports configuration from environment", () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_MODEL = "openai/gpt-4o";

  const status = getLlmStatus();

  assert.equal(status.available, true);
  assert.equal(status.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(status.model, "openai/gpt-4o");
  assert.equal(status.provider, "openrouter");
});

test("OpenRouter provider normalizes public base URL variants", () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_MODEL = "openai/gpt-4o";
  process.env.OPENROUTER_BASE_URL = "https://openrouter.ai";

  assert.equal(getLlmStatus().baseUrl, "https://openrouter.ai/api/v1");

  process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api";

  assert.equal(getLlmStatus().baseUrl, "https://openrouter.ai/api/v1");
});

test("OpenRouter provider requires both API key and model", () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  delete process.env.OPENROUTER_MODEL;
  delete process.env.STUDIO_LLM_MODEL;

  const status = getLlmStatus();

  assert.equal(status.available, false);
  assert.match(status.configuredReason, /OPENROUTER_API_KEY and OPENROUTER_MODEL/);
});

test("LM Studio structured responses stream progress updates", async () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL = "loaded-local-model";

  const progressEvents: ProgressEvent[] = [];
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "http://127.0.0.1:1234/v1/chat/completions");
    const requestBody = readJsonRequestBody(init);
    assert.equal(requestBody.stream, true);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        [
          "data: {\"id\":\"chatcmpl-test\",\"model\":\"loaded-local-model\",\"choices\":[{\"delta\":{\"content\":\"{\\\"status\\\":\\\"ok\\\"\"},\"finish_reason\":null}]}\n\n",
          "data: {\"choices\":[{\"delta\":{\"content\":\",\\\"provider\\\":\\\"lmstudio\\\"}\"},\"finish_reason\":null}]}\n\n",
          "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
          "data: [DONE]\n\n"
        ].forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream"
      },
      status: 200
    });
  };

  const result = await createStructuredResponse({
    developerPrompt: "Return JSON.",
    onProgress: (event: ProgressEvent) => progressEvents.push(event),
    schema: {
      additionalProperties: false,
      properties: {
        provider: { type: "string" },
        status: { type: "string" }
      },
      required: ["status", "provider"],
      type: "object"
    },
    schemaName: "lmstudio_stream_test",
    userPrompt: "Return ok."
  });

  assert.deepEqual(result.data, {
    provider: "lmstudio",
    status: "ok"
  });
  assert.equal(result.model, "loaded-local-model");
  assert.equal(result.provider, "lmstudio");
  assert.ok(progressEvents.some((event) => event.llm && event.llm.status === "submitting"));
  assert.ok(progressEvents.some((event) => event.llm && event.llm.status === "receiving" && event.llm.chunks === 1));
  assert.ok(progressEvents.some((event) => event.llm && event.llm.status === "parsing"));

  global.fetch = originalFetch;
});

test("LM Studio runtime model override wins over environment model", async () => {
  restoreEnv();
  saveRuntimeLlmSettings({
    modelOverride: ""
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL = "env-local-model";

  global.fetch = async (url: string | URL | Request) => {
    assert.equal(url, "http://127.0.0.1:1234/v1/models");
    return Response.json({
      data: [
        { id: "env-local-model" },
        { id: "runtime-local-model" }
      ]
    });
  };

  const updated = await setLlmModelOverride("runtime-local-model");
  assert.equal(updated.configuredModel, "env-local-model");
  assert.equal(updated.runtimeOverride, "runtime-local-model");
  assert.equal(updated.activeModel, "runtime-local-model");
  assert.deepEqual(updated.models, ["env-local-model", "runtime-local-model"]);

  const status = getLlmStatus();
  assert.equal(status.model, "runtime-local-model");

  const cleared = await setLlmModelOverride("");
  assert.equal(cleared.activeModel, "env-local-model");
  assert.equal(cleared.runtimeOverride, "");

  global.fetch = originalFetch;
});

test("LM Studio model override rejects unknown loaded model ids", async () => {
  restoreEnv();
  saveRuntimeLlmSettings({
    modelOverride: ""
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL = "env-local-model";

  global.fetch = async (url: string | URL | Request) => {
    assert.equal(url, "http://127.0.0.1:1234/v1/models");
    return Response.json({
      data: [
        { id: "env-local-model" }
      ]
    });
  };

  await assert.rejects(
    () => setLlmModelOverride("missing-local-model"),
    /does not list model "missing-local-model"/
  );
  assert.equal(getLlmStatus().model, "env-local-model");

  global.fetch = originalFetch;
});

test("runtime model selection is exposed only for LM Studio provider", async () => {
  restoreEnv();
  saveRuntimeLlmSettings({
    modelOverride: "ignored-local-model"
  });
  process.env.STUDIO_LLM_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.OPENROUTER_MODEL = "openai/gpt-4o";

  const modelState = await getLlmModelState();
  assert.equal(modelState.provider, "openrouter");
  assert.equal(modelState.activeModel, "openai/gpt-4o");
  assert.equal(modelState.configuredModel, "openai/gpt-4o");
  assert.equal(modelState.runtimeOverride, "");
  assert.deepEqual(modelState.models, []);

  await assert.rejects(
    () => setLlmModelOverride("other-model"),
    /only available for the LM Studio provider/
  );
});

test("LM Studio retries invalid streamed structured JSON once", async () => {
  restoreEnv();
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
  process.env.LMSTUDIO_MODEL = "loaded-local-model";

  const progressEvents: ProgressEvent[] = [];
  const requests: ChatRequest[] = [];
  global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "http://127.0.0.1:1234/v1/chat/completions");
    const requestBody = readJsonRequestBody(init);
    requests.push(requestBody);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const chunks = requests.length === 1
          ? [
              "data: {\"id\":\"chatcmpl-test\",\"model\":\"loaded-local-model\",\"choices\":[{\"delta\":{\"content\":\"{\\\"status\\\":\"},\"finish_reason\":null}]}\n\n",
              "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"length\"}]}\n\n",
              "data: [DONE]\n\n"
            ]
          : [
              "data: {\"id\":\"chatcmpl-retry\",\"model\":\"loaded-local-model\",\"choices\":[{\"delta\":{\"content\":\"{\\\"status\\\":\\\"ok\\\"}\"},\"finish_reason\":null}]}\n\n",
              "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
              "data: [DONE]\n\n"
            ];
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream"
      },
      status: 200
    });
  };

  const result = await createStructuredResponse({
    developerPrompt: "Return JSON.",
    maxOutputTokens: 120,
    onProgress: (event: ProgressEvent) => progressEvents.push(event),
    schema: {
      additionalProperties: false,
      properties: {
        status: { type: "string" }
      },
      required: ["status"],
      type: "object"
    },
    schemaName: "lmstudio_retry_test",
    userPrompt: "Return ok."
  });

  assert.deepEqual(result.data, {
    status: "ok"
  });
  assert.equal(requests.length, 2);
  const firstRequest = requests[0];
  const retryRequest = requests[1];
  if (!firstRequest || !retryRequest) {
    throw new Error("Expected initial and retry requests");
  }
  const retryMessage = retryRequest.messages[0];
  if (!retryMessage) {
    throw new Error("Expected retry message");
  }
  assert.equal(firstRequest.max_tokens, 120);
  assert.equal(retryRequest.max_tokens, 2720);
  assert.match(retryMessage.content, /Retry once with compact complete JSON/);
  assert.ok(progressEvents.some((event) => event.llm && event.llm.status === "retrying"));

  global.fetch = originalFetch;
});
