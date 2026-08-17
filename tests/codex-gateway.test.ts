import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { request as nodeHttpRequest } from "node:http";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  createCodexSdkProcessOptions,
  createCodexSdkRunner,
  startCodexGateway,
  type CodexGatewayRunRequest,
  type CodexGatewayRunResult,
  type CodexGatewayRunner,
  type CodexSdkClient,
  type StartCodexGatewayOptions
} from "../studio/server/services/llm/codex-gateway.ts";
import { verifyLlmConnection } from "../studio/server/services/llm/client.ts";

type JsonRecord = Record<string, unknown>;

const BEARER_TOKEN = "slideotter-test-token-1234567890";
const MODEL = "gpt-test-codex";
const ISOLATED_CODEX_HOME = "/tmp/slideotter-isolated-codex-home";

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readJsonObject(response: Response): Promise<JsonRecord> {
  const value: unknown = await response.json();
  assert.ok(isJsonRecord(value));
  return value;
}

function authenticatedHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${BEARER_TOKEN}`,
    ...extra
  };
}

function requestStatusWithHost(urlValue: string, hostHeader: string): Promise<number> {
  const url = new URL(urlValue);
  return new Promise((resolve, reject) => {
    const request = nodeHttpRequest({
      headers: authenticatedHeaders({ Host: hostHeader }),
      hostname: url.hostname,
      method: "GET",
      path: url.pathname,
      port: url.port
    }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode ?? 0));
    });
    request.once("error", reject);
    request.end();
  });
}

async function startTestGateway(
  context: TestContext,
  runner: CodexGatewayRunner,
  overrides: Partial<StartCodexGatewayOptions> = {}
) {
  const gateway = await startCodexGateway({
    bearerToken: BEARER_TOKEN,
    model: MODEL,
    runner,
    ...overrides
  });
  context.after(() => gateway.close());
  return gateway;
}

function structuredChatBody(model = MODEL): JsonRecord {
  return {
    messages: [
      { content: "Return JSON.", role: "system" },
      { content: "Return ok.", role: "user" }
    ],
    model,
    response_format: {
      json_schema: {
        name: "gateway_test",
        schema: {
          additionalProperties: false,
          properties: {
            status: { type: "string" }
          },
          required: ["status"],
          type: "object"
        }
      },
      type: "json_schema"
    },
    stream: false
  };
}

function replaceEnvironment(
  context: TestContext,
  values: Record<string, string | undefined>
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  context.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

test("Codex SDK process options deny tools and copy only allowlisted child environment", () => {
  const options = createCodexSdkProcessOptions(ISOLATED_CODEX_HOME, {
    CODEX_HOME: "/tmp/codex-home",
    HOME: "/home/real-user",
    NODE_OPTIONS: "--require attacker.js",
    OPENAI_API_KEY: "test-key",
    PATH: "/usr/bin",
    SECRET_NOT_FOR_CODEX: "do-not-copy",
    USERPROFILE: "C:\\Users\\real-user",
    XDG_CONFIG_HOME: "/home/real-user/.config"
  });

  assert.deepEqual(options.env, {
    CODEX_HOME: ISOLATED_CODEX_HOME,
    HOME: ISOLATED_CODEX_HOME,
    PATH: "/usr/bin",
    USERPROFILE: ISOLATED_CODEX_HOME
  });
  assert.deepEqual(options.config, {
    cli_auth_credentials_store: "file",
    features: {
      apps: false,
      auth_elicitation: false,
      browser_use: false,
      browser_use_external: false,
      browser_use_full_cdp_access: false,
      code_mode: false,
      code_mode_host: false,
      computer_use: false,
      goals: false,
      hooks: false,
      image_generation: false,
      in_app_browser: false,
      memories: false,
      multi_agent: false,
      plugins: false,
      remote_plugin: false,
      shell_tool: false,
      shell_snapshot: false,
      skill_search: false,
      skill_mcp_dependency_install: false,
      tool_call_mcp_elicitation: false,
      tool_suggest: false,
      unified_exec: false,
      view_image: false,
      workspace_dependencies: false
    },
    history: {
      persistence: "none"
    },
    project_root_markers: [".slideotter-codex-gateway-root"],
    tools: {
      web_search: false
    }
  });
});

test("gateway maps structured chat completions to a locked-down Codex SDK thread", async (context) => {
  let capturedRequest: CodexGatewayRunRequest | undefined;
  let capturedPrompt = "";
  let capturedSchema: unknown;
  let workingDirectory = "";

  const client: CodexSdkClient = {
    startThread(options) {
      assert.ok(options);
      workingDirectory = options.workingDirectory;
      return {
        async run(prompt, turnOptions) {
          capturedPrompt = prompt;
          capturedSchema = turnOptions?.outputSchema;
          await access(options.workingDirectory);
          await access(join(options.workingDirectory, ".slideotter-codex-gateway-root"));
          return { finalResponse: "{\"status\":\"ok\"}" };
        }
      };
    }
  };
  const sdkRunner = createCodexSdkRunner(client);
  const runner: CodexGatewayRunner = {
    async run(request) {
      capturedRequest = request;
      return sdkRunner.run(request);
    }
  };
  const gateway = await startTestGateway(context, runner, {
    modelReasoningEffort: "high"
  });

  const response = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(structuredChatBody()),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  const body = await readJsonObject(response);

  assert.equal(response.status, 200);
  assert.equal(body.model, MODEL);
  assert.equal(body.object, "chat.completion");
  assert.ok(Array.isArray(body.choices));
  assert.deepEqual(body.choices[0], {
    finish_reason: "stop",
    index: 0,
    message: {
      content: "{\"status\":\"ok\"}",
      role: "assistant"
    }
  });
  assert.ok(capturedRequest);
  assert.deepEqual(capturedRequest.threadOptions, {
    approvalPolicy: "never",
    model: MODEL,
    modelReasoningEffort: "high",
    networkAccessEnabled: false,
    sandboxMode: "read-only",
    skipGitRepoCheck: true,
    webSearchEnabled: false,
    webSearchMode: "disabled",
    workingDirectory
  });
  assert.deepEqual(capturedSchema, {
    additionalProperties: false,
    properties: {
      status: { type: "string" }
    },
    required: ["status"],
    type: "object"
  });
  assert.match(capturedPrompt, /"role":"system"/);
  assert.match(capturedPrompt, /"content":"Return ok\."/);
  assert.match(capturedPrompt, /2600-token output budget/);
  await assert.rejects(access(workingDirectory));
});

test("health and model discovery require authentication and expose one configured model", async (context) => {
  const runner: CodexGatewayRunner = {
    async run() {
      return { finalResponse: "{\"status\":\"ok\"}" };
    }
  };
  const gateway = await startTestGateway(context, runner);

  const unauthenticated = await fetch(`${gateway.address.url}/health`);
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get("www-authenticate") ?? "", /^Bearer /);

  const health = await fetch(`${gateway.address.url}/health`, {
    headers: authenticatedHeaders()
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.has("access-control-allow-origin"), false);
  assert.deepEqual(await readJsonObject(health), {
    model: MODEL,
    service: "slideotter-codex-gateway",
    status: "ok"
  });

  const models = await fetch(`${gateway.address.url}/v1/models`, {
    headers: authenticatedHeaders()
  });
  assert.equal(models.status, 200);
  assert.deepEqual(await readJsonObject(models), {
    data: [
      {
        created: 0,
        id: MODEL,
        object: "model",
        owned_by: "openai-codex"
      }
    ],
    object: "list"
  });
});

test("gateway validates browser boundaries, request options, and scaled output budgets", async (context) => {
  let runCount = 0;
  const runner: CodexGatewayRunner = {
    async run() {
      runCount += 1;
      return { finalResponse: "{\"status\":\"ok\"}" };
    }
  };
  const gateway = await startTestGateway(context, runner);

  const originResponse = await fetch(`${gateway.address.url}/health`, {
    headers: authenticatedHeaders({ Origin: "https://attacker.example" })
  });
  assert.equal(originResponse.status, 403);
  assert.equal((await readJsonObject(originResponse)).error !== undefined, true);

  const invalidHostStatus = await requestStatusWithHost(
    `${gateway.address.url}/health`,
    "attacker.example"
  );
  assert.equal(invalidHostStatus, 403);

  const streamingBody = structuredChatBody();
  streamingBody.stream = true;
  const streaming = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(streamingBody),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  assert.equal(streaming.status, 400);
  assert.equal((await readJsonObject(streaming)).error !== undefined, true);

  const wrongModel = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(structuredChatBody("unconfigured-model")),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  assert.equal(wrongModel.status, 400);

  const wrongToken = await fetch(`${gateway.address.url}/health`, {
    headers: { Authorization: "Bearer definitely-not-the-right-token" }
  });
  assert.equal(wrongToken.status, 401);

  const malformedSchemaBody = structuredChatBody();
  malformedSchemaBody.response_format = {
    json_schema: { name: "missing_schema" },
    type: "json_schema"
  };
  const malformedSchema = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(malformedSchemaBody),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  assert.equal(malformedSchema.status, 400);

  const unsupportedSamplingBody = structuredChatBody();
  unsupportedSamplingBody.temperature = 0.5;
  const unsupportedSampling = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(unsupportedSamplingBody),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  assert.equal(unsupportedSampling.status, 400);

  const unsafeOutputBody = structuredChatBody();
  unsafeOutputBody.max_tokens = Number.MAX_SAFE_INTEGER + 1;
  const unsafeOutput = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(unsafeOutputBody),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  assert.equal(unsafeOutput.status, 400);

  const scaledDeckOutputBody = structuredChatBody();
  scaledDeckOutputBody.max_tokens = 17_100;
  const scaledDeckOutput = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(scaledDeckOutputBody),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  assert.equal(scaledDeckOutput.status, 200);
  assert.equal(runCount, 1);
});

test("gateway cleans temporary work after Codex failure and bounds returned output", async (context) => {
  let failedWorkingDirectory = "";
  const failingGateway = await startTestGateway(context, {
    async run(request) {
      failedWorkingDirectory = request.threadOptions.workingDirectory;
      throw new Error("sensitive upstream detail");
    }
  });
  const request = {
    body: JSON.stringify(structuredChatBody()),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  };

  const failed = await fetch(`${failingGateway.address.url}/v1/chat/completions`, request);
  const failedBody = await readJsonObject(failed);
  assert.equal(failed.status, 502);
  assert.doesNotMatch(JSON.stringify(failedBody), /sensitive upstream detail/);
  await assert.rejects(access(failedWorkingDirectory));

  const oversizedGateway = await startTestGateway(context, {
    async run() {
      return { finalResponse: "x".repeat(17) };
    }
  });
  const boundedBody = structuredChatBody();
  boundedBody.max_tokens = 1;
  const oversized = await fetch(`${oversizedGateway.address.url}/v1/chat/completions`, {
    ...request,
    body: JSON.stringify(boundedBody)
  });
  const oversizedBody = await readJsonObject(oversized);
  assert.equal(oversized.status, 502);
  assert.ok(isJsonRecord(oversizedBody.error));
  assert.equal(oversizedBody.error.code, "codex_response_too_large");
});

test("existing OpenAI-compatible provider verifies through the Codex gateway", async (context) => {
  let runCount = 0;
  const gateway = await startTestGateway(context, {
    async run() {
      runCount += 1;
      return {
        finalResponse: "{\"provider\":\"openai-compatible\",\"status\":\"ok\"}"
      };
    }
  });
  replaceEnvironment(context, {
    OPENAI_COMPATIBLE_API_KEY: BEARER_TOKEN,
    OPENAI_COMPATIBLE_BASE_URL: gateway.address.url,
    OPENAI_COMPATIBLE_MODEL: MODEL,
    STUDIO_LLM_BASE_URL: undefined,
    STUDIO_LLM_MODEL: undefined,
    STUDIO_LLM_PROVIDER: "openai-compatible"
  });

  const verification = await verifyLlmConnection();

  assert.equal(verification.ok, true);
  assert.equal(verification.model, MODEL);
  assert.equal(verification.provider, "openai-compatible");
  assert.equal(runCount, 1);
});

test("gateway enforces body, concurrency, and Codex execution limits", async (context) => {
  let resolveFirst: ((result: CodexGatewayRunResult) => void) | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pendingRun = new Promise<CodexGatewayRunResult>((resolve) => {
    resolveFirst = resolve;
  });
  const runner: CodexGatewayRunner = {
    run() {
      markStarted?.();
      return pendingRun;
    }
  };
  const gateway = await startTestGateway(context, runner, {
    maxBodyBytes: 2_048,
    maxConcurrentRequests: 1
  });
  const request = {
    body: JSON.stringify(structuredChatBody()),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  };

  const firstResponsePromise = fetch(`${gateway.address.url}/v1/chat/completions`, request);
  await started;

  const busy = await fetch(`${gateway.address.url}/v1/chat/completions`, request);
  assert.equal(busy.status, 429);

  assert.ok(resolveFirst);
  resolveFirst({ finalResponse: "{\"status\":\"ok\"}" });
  assert.equal((await firstResponsePromise).status, 200);

  const oversizedGateway = await startTestGateway(context, runner, {
    maxBodyBytes: 32
  });
  const oversized = await fetch(`${oversizedGateway.address.url}/v1/chat/completions`, request);
  assert.equal(oversized.status, 413);
});

test("gateway aborts a Codex run at its configured timeout", async (context) => {
  let observedAbort = false;
  const runner: CodexGatewayRunner = {
    run(request) {
      return new Promise((_resolve, reject) => {
        request.signal.addEventListener("abort", () => {
          observedAbort = true;
          reject(new Error("aborted"));
        }, { once: true });
      });
    }
  };
  const gateway = await startTestGateway(context, runner, {
    requestTimeoutMs: 20
  });

  const response = await fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(structuredChatBody()),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  });
  const body = await readJsonObject(response);

  assert.equal(response.status, 504);
  assert.equal(observedAbort, true);
  assert.ok(isJsonRecord(body.error));
  assert.equal(body.error.code, "codex_timeout");
});

test("closing the gateway aborts active Codex runs", async () => {
  let markStarted: (() => void) | undefined;
  let observedAbort = false;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const runner: CodexGatewayRunner = {
    run(request) {
      markStarted?.();
      return new Promise((_resolve, reject) => {
        request.signal.addEventListener("abort", () => {
          observedAbort = true;
          reject(new Error("gateway closed"));
        }, { once: true });
      });
    }
  };
  const gateway = await startCodexGateway({
    bearerToken: BEARER_TOKEN,
    model: MODEL,
    requestTimeoutMs: 5_000,
    runner
  });
  const responsePromise = fetch(`${gateway.address.url}/v1/chat/completions`, {
    body: JSON.stringify(structuredChatBody()),
    headers: authenticatedHeaders({ "Content-Type": "application/json" }),
    method: "POST"
  }).catch(() => undefined);

  await started;
  await gateway.close();
  await responsePromise;

  assert.equal(observedAbort, true);
});
