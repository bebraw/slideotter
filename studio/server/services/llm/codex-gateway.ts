import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

type JsonRecord = Record<string, unknown>;

export type CodexGatewayReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type CodexGatewayThreadOptions = {
  approvalPolicy: "never";
  model: string;
  modelReasoningEffort: CodexGatewayReasoningEffort;
  networkAccessEnabled: false;
  sandboxMode: "read-only";
  skipGitRepoCheck: true;
  webSearchEnabled: false;
  webSearchMode: "disabled";
  workingDirectory: string;
};

export type CodexGatewayRunRequest = {
  outputSchema: JsonRecord;
  prompt: string;
  signal: AbortSignal;
  threadOptions: CodexGatewayThreadOptions;
};

export type CodexGatewayRunResult = {
  finalResponse: string;
};

export type CodexGatewayRunner = {
  run(request: CodexGatewayRunRequest): Promise<CodexGatewayRunResult>;
};

type CodexSdkTurnOptions = {
  outputSchema?: unknown;
  signal?: AbortSignal;
};

type CodexSdkThread = {
  run(input: string, options?: CodexSdkTurnOptions): Promise<CodexGatewayRunResult>;
};

export type CodexSdkClient = {
  startThread(options?: CodexGatewayThreadOptions): CodexSdkThread;
};

type CodexSdkConfigValue = string | number | boolean | CodexSdkConfigValue[] | CodexSdkConfigObject;

type CodexSdkConfigObject = {
  [key: string]: CodexSdkConfigValue;
};

export type CodexSdkProcessOptions = {
  config: CodexSdkConfigObject;
  env: Record<string, string>;
};

export const CODEX_CHILD_ENV_ALLOWLIST = [
  "ALL_PROXY",
  "APPDATA",
  "CODEX_CA_CERTIFICATE",
  "COMSPEC",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "LOGNAME",
  "NODE_EXTRA_CA_CERTS",
  "NO_PROXY",
  "PATH",
  "PATHEXT",
  "PROGRAMDATA",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
  "USER",
  "all_proxy",
  "http_proxy",
  "https_proxy",
  "no_proxy"
] as const;

export function createCodexSdkProcessOptions(
  codexHome: string,
  sourceEnvironment: NodeJS.ProcessEnv = process.env
): CodexSdkProcessOptions {
  if (!isAbsolute(codexHome)) {
    throw new Error("The Codex gateway home must be an absolute path.");
  }

  const env: Record<string, string> = {};

  for (const key of CODEX_CHILD_ENV_ALLOWLIST) {
    const value = sourceEnvironment[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env.CODEX_HOME = codexHome;
  // Codex also discovers user skills beneath HOME, so both home variables must
  // stay inside the separately validated gateway directory.
  env.HOME = codexHome;
  env.USERPROFILE = codexHome;

  return {
    // Keep these overrides aligned with the Codex CLI bundled by the pinned SDK.
    // Audit the complete set with `codex app-server --strict-config` on upgrades.
    config: {
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
      project_root_markers: [GATEWAY_PROJECT_ROOT_MARKER],
      tools: {
        web_search: false
      }
    },
    env
  };
}

export function createCodexSdkRunner(client: CodexSdkClient): CodexGatewayRunner {
  return {
    async run(request) {
      const thread = client.startThread(request.threadOptions);
      const result = await thread.run(request.prompt, {
        outputSchema: request.outputSchema,
        signal: request.signal
      });

      return {
        finalResponse: result.finalResponse
      };
    }
  };
}

type LoopbackHost = "127.0.0.1" | "::1";

export type StartCodexGatewayOptions = {
  bearerToken: string;
  host?: LoopbackHost;
  maxBodyBytes?: number;
  maxConcurrentRequests?: number;
  model: string;
  modelReasoningEffort?: CodexGatewayReasoningEffort;
  port?: number;
  requestTimeoutMs?: number;
  runner: CodexGatewayRunner;
};

export type CodexGatewayAddress = {
  host: LoopbackHost;
  port: number;
  url: string;
};

export type StartedCodexGateway = {
  address: CodexGatewayAddress;
  close(): Promise<void>;
};

type ChatRole = "assistant" | "developer" | "system" | "user";

type ChatMessage = {
  content: string;
  role: ChatRole;
};

type ParsedChatCompletion = {
  maxOutputTokens: number;
  messages: ChatMessage[];
  model: string;
  outputSchema: JsonRecord;
};

type GatewayErrorType =
  | "authentication_error"
  | "invalid_request_error"
  | "server_error";

class GatewayRequestError extends Error {
  readonly code: string;
  readonly errorType: GatewayErrorType;
  readonly statusCode: number;

  constructor(statusCode: number, code: string, message: string, errorType: GatewayErrorType) {
    super(message);
    this.name = "GatewayRequestError";
    this.code = code;
    this.errorType = errorType;
    this.statusCode = statusCode;
  }
}

const DEFAULT_MAX_BODY_BYTES = 1_048_576;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2_600;
const GATEWAY_PROJECT_ROOT_MARKER = ".slideotter-codex-gateway-root";
const MAX_RESPONSE_BYTES = 262_144;
const MAX_TOKEN_LENGTH = 512;
const MIN_TOKEN_LENGTH = 24;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertSafeToken(token: string): void {
  if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) {
    throw new Error(`Gateway bearer token must contain ${MIN_TOKEN_LENGTH}-${MAX_TOKEN_LENGTH} characters.`);
  }

  for (const character of token) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || codePoint < 0x21 || codePoint > 0x7e) {
      throw new Error("Gateway bearer token must contain only visible ASCII characters without spaces.");
    }
  }
}

function assertIntegerInRange(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
}

function firstHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

function isAuthorized(request: IncomingMessage, expectedToken: string): boolean {
  const authorization = firstHeader(request, "authorization");
  if (!authorization) {
    return false;
  }

  const separator = authorization.indexOf(" ");
  if (separator <= 0 || authorization.indexOf(" ", separator + 1) !== -1) {
    return false;
  }

  const scheme = authorization.slice(0, separator);
  const suppliedToken = authorization.slice(separator + 1);
  if (scheme.toLowerCase() !== "bearer" || !suppliedToken) {
    return false;
  }

  const expected = Buffer.from(expectedToken, "utf8");
  const supplied = Buffer.from(suppliedToken, "utf8");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {}
): void {
  if (response.headersSent || response.writableEnded || response.destroyed) {
    return;
  }

  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": String(Buffer.byteLength(body)),
    "Content-Type": "application/json; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  response.end(body);
}

function writeError(response: ServerResponse, error: GatewayRequestError): void {
  const headers = error.statusCode === 401
    ? { "WWW-Authenticate": "Bearer realm=\"slideotter-codex-gateway\"" }
    : {};

  writeJson(response, error.statusCode, {
    error: {
      code: error.code,
      message: error.message,
      param: null,
      type: error.errorType
    }
  }, headers);
}

function parseChatRole(value: unknown, index: number): ChatRole {
  if (value === "assistant" || value === "developer" || value === "system" || value === "user") {
    return value;
  }

  throw new GatewayRequestError(
    400,
    "invalid_messages",
    `messages[${index}].role must be assistant, developer, system, or user.`,
    "invalid_request_error"
  );
}

function parseChatCompletion(value: unknown, configuredModel: string): ParsedChatCompletion {
  if (!isJsonRecord(value)) {
    throw new GatewayRequestError(400, "invalid_json", "Request body must be a JSON object.", "invalid_request_error");
  }

  if (value.stream !== undefined && value.stream !== false) {
    throw new GatewayRequestError(
      400,
      "streaming_not_supported",
      "This gateway supports only non-streaming chat completions.",
      "invalid_request_error"
    );
  }

  if (value.temperature !== undefined && value.temperature !== 0) {
    throw new GatewayRequestError(
      400,
      "temperature_not_supported",
      "temperature must be 0 when provided.",
      "invalid_request_error"
    );
  }

  const maxOutputTokens = value.max_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  if (
    typeof maxOutputTokens !== "number" ||
    !Number.isSafeInteger(maxOutputTokens) ||
    maxOutputTokens < 1
  ) {
    throw new GatewayRequestError(
      400,
      "invalid_max_tokens",
      "max_tokens must be a positive safe integer.",
      "invalid_request_error"
    );
  }

  if (typeof value.model !== "string" || !value.model.trim()) {
    throw new GatewayRequestError(400, "invalid_model", "model must be a non-empty string.", "invalid_request_error");
  }

  const model = value.model.trim();
  if (model !== configuredModel) {
    throw new GatewayRequestError(
      400,
      "model_not_allowed",
      `The gateway is configured for model ${configuredModel}.`,
      "invalid_request_error"
    );
  }

  if (!Array.isArray(value.messages) || value.messages.length === 0 || value.messages.length > 64) {
    throw new GatewayRequestError(
      400,
      "invalid_messages",
      "messages must contain between 1 and 64 chat messages.",
      "invalid_request_error"
    );
  }

  const messages = value.messages.map((message, index): ChatMessage => {
    if (!isJsonRecord(message) || typeof message.content !== "string") {
      throw new GatewayRequestError(
        400,
        "invalid_messages",
        `messages[${index}] must contain a string content field.`,
        "invalid_request_error"
      );
    }

    return {
      content: message.content,
      role: parseChatRole(message.role, index)
    };
  });

  if (!isJsonRecord(value.response_format) || value.response_format.type !== "json_schema") {
    throw new GatewayRequestError(
      400,
      "invalid_response_format",
      "response_format.type must be json_schema.",
      "invalid_request_error"
    );
  }

  const jsonSchema = value.response_format.json_schema;
  if (!isJsonRecord(jsonSchema) || typeof jsonSchema.name !== "string" || !jsonSchema.name.trim()) {
    throw new GatewayRequestError(
      400,
      "invalid_response_format",
      "response_format.json_schema.name must be a non-empty string.",
      "invalid_request_error"
    );
  }

  if (!isJsonRecord(jsonSchema.schema)) {
    throw new GatewayRequestError(
      400,
      "invalid_response_format",
      "response_format.json_schema.schema must be a JSON object.",
      "invalid_request_error"
    );
  }

  if (jsonSchema.strict !== undefined && typeof jsonSchema.strict !== "boolean") {
    throw new GatewayRequestError(
      400,
      "invalid_response_format",
      "response_format.json_schema.strict must be a boolean when provided.",
      "invalid_request_error"
    );
  }

  return {
    maxOutputTokens,
    messages,
    model,
    outputSchema: jsonSchema.schema
  };
}

function buildCodexPrompt(messages: ChatMessage[], maxOutputTokens: number): string {
  return [
    "Complete the structured chat request represented by the ordered JSON messages below.",
    "Honor system and developer instructions before user instructions.",
    "Return only the JSON value required by the separately supplied output schema.",
    `Keep the response within the caller's ${maxOutputTokens}-token output budget.`,
    JSON.stringify(messages)
  ].join("\n\n");
}

function readRequestBody(request: IncomingMessage, maxBodyBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let byteLength = 0;
    let exceededLimit = false;
    let settled = false;

    request.setEncoding("utf8");

    const cleanup = () => {
      request.off("aborted", onAborted);
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
    };

    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onAborted = () => {
      rejectOnce(new GatewayRequestError(400, "request_aborted", "Request body was interrupted.", "invalid_request_error"));
    };

    const onData = (chunk: string) => {
      if (exceededLimit) {
        return;
      }

      byteLength += Buffer.byteLength(chunk);
      if (byteLength > maxBodyBytes) {
        body = "";
        exceededLimit = true;
        return;
      }

      body += chunk;
    };

    const onEnd = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (exceededLimit) {
        reject(new GatewayRequestError(
          413,
          "request_too_large",
          `Request body exceeds the ${maxBodyBytes}-byte limit.`,
          "invalid_request_error"
        ));
        return;
      }

      resolve(body);
    };

    const onError = (error: Error) => {
      rejectOnce(error);
    };

    request.on("aborted", onAborted);
    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
  });
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new GatewayRequestError(400, "invalid_json", "Request body is not valid JSON.", "invalid_request_error");
  }
}

async function runWithTimeout(
  runner: CodexGatewayRunner,
  request: CodexGatewayRunRequest,
  timeoutMs: number,
  controller: AbortController
): Promise<CodexGatewayRunResult> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new GatewayRequestError(
        504,
        "codex_timeout",
        `Codex did not finish within ${timeoutMs}ms.`,
        "server_error"
      ));
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([runner.run(request), timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function formatLoopbackHost(host: LoopbackHost): string {
  return host === "::1" ? "[::1]" : host;
}

export async function startCodexGateway(options: StartCodexGatewayOptions): Promise<StartedCodexGateway> {
  assertSafeToken(options.bearerToken);

  const host = options.host ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new Error("Codex gateway host must be a loopback address.");
  }

  const model = options.model.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model)) {
    throw new Error("Codex gateway model must be a 1-128 character model identifier.");
  }

  const port = options.port ?? 0;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const maxConcurrentRequests = options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const modelReasoningEffort = options.modelReasoningEffort ?? "medium";

  assertIntegerInRange("port", port, 0, 65_535);
  assertIntegerInRange("maxBodyBytes", maxBodyBytes, 1, 16_777_216);
  assertIntegerInRange("maxConcurrentRequests", maxConcurrentRequests, 1, 32);
  assertIntegerInRange("requestTimeoutMs", requestTimeoutMs, 1, 900_000);

  let activeRequests = 0;
  const activeControllers = new Set<AbortController>();
  let expectedHostHeader = "";

  const server = createServer((request, response) => {
    const handleRequest = async () => {
      if (firstHeader(request, "host") !== expectedHostHeader) {
        throw new GatewayRequestError(403, "invalid_host", "Host header is not allowed.", "invalid_request_error");
      }

      if (firstHeader(request, "origin") !== undefined) {
        throw new GatewayRequestError(
          403,
          "origin_not_allowed",
          "Browser-origin requests are not allowed.",
          "invalid_request_error"
        );
      }

      if (!isAuthorized(request, options.bearerToken)) {
        throw new GatewayRequestError(401, "invalid_token", "A valid bearer token is required.", "authentication_error");
      }

      const requestUrl = new URL(request.url ?? "/", "http://gateway.invalid");
      const pathname = requestUrl.pathname;

      if (pathname === "/health") {
        if (request.method !== "GET") {
          throw new GatewayRequestError(405, "method_not_allowed", "Use GET for /health.", "invalid_request_error");
        }

        writeJson(response, 200, {
          model,
          service: "slideotter-codex-gateway",
          status: "ok"
        });
        return;
      }

      if (pathname === "/v1/models") {
        if (request.method !== "GET") {
          throw new GatewayRequestError(405, "method_not_allowed", "Use GET for /v1/models.", "invalid_request_error");
        }

        writeJson(response, 200, {
          data: [
            {
              created: 0,
              id: model,
              object: "model",
              owned_by: "openai-codex"
            }
          ],
          object: "list"
        });
        return;
      }

      if (pathname !== "/v1/chat/completions") {
        throw new GatewayRequestError(404, "not_found", "Endpoint not found.", "invalid_request_error");
      }

      if (request.method !== "POST") {
        throw new GatewayRequestError(
          405,
          "method_not_allowed",
          "Use POST for /v1/chat/completions.",
          "invalid_request_error"
        );
      }

      const contentType = firstHeader(request, "content-type")?.toLowerCase() ?? "";
      if (!contentType.startsWith("application/json")) {
        throw new GatewayRequestError(415, "unsupported_media_type", "Content-Type must be application/json.", "invalid_request_error");
      }

      const contentEncoding = firstHeader(request, "content-encoding")?.toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        throw new GatewayRequestError(
          415,
          "unsupported_content_encoding",
          "Compressed request bodies are not supported.",
          "invalid_request_error"
        );
      }

      const contentLength = firstHeader(request, "content-length");
      if (contentLength !== undefined && Number(contentLength) > maxBodyBytes) {
        request.resume();
        throw new GatewayRequestError(
          413,
          "request_too_large",
          `Request body exceeds the ${maxBodyBytes}-byte limit.`,
          "invalid_request_error"
        );
      }

      if (activeRequests >= maxConcurrentRequests) {
        request.resume();
        throw new GatewayRequestError(
          429,
          "gateway_busy",
          "The gateway has reached its concurrent request limit.",
          "server_error"
        );
      }

      activeRequests += 1;
      try {
        const body = await readRequestBody(request, maxBodyBytes);
        const parsed = parseChatCompletion(parseJsonBody(body), model);
        const controller = new AbortController();
        const onDisconnect = () => {
          if (!response.writableEnded) {
            controller.abort();
          }
        };
        request.once("aborted", onDisconnect);
        response.once("close", onDisconnect);

        const workingDirectory = await mkdtemp(join(tmpdir(), "slideotter-codex-gateway-"));
        try {
          await writeFile(join(workingDirectory, GATEWAY_PROJECT_ROOT_MARKER), "", {
            flag: "wx"
          });
        } catch (error) {
          await rm(workingDirectory, { force: true, recursive: true }).catch(() => undefined);
          throw error;
        }
        activeControllers.add(controller);
        try {
          let result: CodexGatewayRunResult;
          try {
            result = await runWithTimeout(options.runner, {
              outputSchema: parsed.outputSchema,
              prompt: buildCodexPrompt(parsed.messages, parsed.maxOutputTokens),
              signal: controller.signal,
              threadOptions: {
                approvalPolicy: "never",
                model,
                modelReasoningEffort,
                networkAccessEnabled: false,
                sandboxMode: "read-only",
                skipGitRepoCheck: true,
                webSearchEnabled: false,
                webSearchMode: "disabled",
                workingDirectory
              }
            }, requestTimeoutMs, controller);
          } catch (error) {
            if (error instanceof GatewayRequestError) {
              throw error;
            }
            throw new GatewayRequestError(
              502,
              "codex_error",
              "Codex could not complete the structured request.",
              "server_error"
            );
          }

          if (typeof result.finalResponse !== "string" || !result.finalResponse.trim()) {
            throw new GatewayRequestError(
              502,
              "invalid_codex_response",
              "Codex returned an empty structured response.",
              "server_error"
            );
          }

          const responseByteLimit = Math.min(
            MAX_RESPONSE_BYTES,
            parsed.maxOutputTokens * 16
          );
          if (Buffer.byteLength(result.finalResponse, "utf8") > responseByteLimit) {
            throw new GatewayRequestError(
              502,
              "codex_response_too_large",
              "Codex returned a structured response larger than the configured output bound.",
              "server_error"
            );
          }

          await rm(workingDirectory, { force: true, recursive: true });
          writeJson(response, 200, {
            choices: [
              {
                finish_reason: "stop",
                index: 0,
                message: {
                  content: result.finalResponse,
                  role: "assistant"
                }
              }
            ],
            created: Math.floor(Date.now() / 1000),
            id: `chatcmpl-codex-${randomUUID()}`,
            model: parsed.model,
            object: "chat.completion"
          });
        } finally {
          activeControllers.delete(controller);
          request.off("aborted", onDisconnect);
          response.off("close", onDisconnect);
          await rm(workingDirectory, { force: true, recursive: true }).catch(() => undefined);
        }
      } finally {
        activeRequests -= 1;
      }
    };

    void handleRequest().catch((error: unknown) => {
      if (error instanceof GatewayRequestError) {
        writeError(response, error);
        return;
      }

      writeError(response, new GatewayRequestError(
        500,
        "internal_error",
        "The gateway could not process the request.",
        "server_error"
      ));
    });
  });

  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;
  server.requestTimeout = requestTimeoutMs;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const rawAddress = server.address();
  if (!rawAddress || typeof rawAddress === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Codex gateway did not receive a TCP address.");
  }

  const address: CodexGatewayAddress = {
    host,
    port: rawAddress.port,
    url: `http://${formatLoopbackHost(host)}:${rawAddress.port}`
  };
  expectedHostHeader = `${formatLoopbackHost(host)}:${address.port}`;

  let closePromise: Promise<void> | undefined;
  return {
    address,
    close() {
      if (closePromise) {
        return closePromise;
      }

      closePromise = new Promise<void>((resolve, reject) => {
        for (const controller of activeControllers) {
          controller.abort();
        }

        if (!server.listening) {
          resolve();
          return;
        }

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
        server.closeAllConnections();
        server.closeIdleConnections();
      });
      return closePromise;
    }
  };
}
