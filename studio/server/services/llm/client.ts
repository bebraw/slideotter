import { loadEnvFiles } from "../env.ts";
import {
  getRuntimeLlmSettings,
  saveRuntimeLlmSettings
} from "../presentations.ts";

loadEnvFiles();

const defaultProvider = process.env.STUDIO_LLM_PROVIDER || "openai";

type JsonRecord = Record<string, unknown>;

type LlmConfig = {
  apiKey?: string;
  available?: boolean;
  baseUrl: string;
  configured: boolean;
  configuredReason: string;
  model: string;
  provider: string;
};

type ProviderSettings = Omit<LlmConfig, "available" | "provider">;

type LlmModelList = {
  count: number;
  models: string[];
};

type LlmModelState = {
  activeModel: string;
  baseUrl: string;
  configuredModel: string;
  error?: string;
  models: string[];
  provider: string;
  runtimeOverride: string;
};

type HttpError = Error & {
  code?: string;
  statusCode?: number;
};

type PromptBudget = JsonRecord & {
  responseCharCount?: number | null;
};

type StructuredResponseOptions = {
  developerPrompt: string;
  maxOutputTokens?: number;
  model?: string;
  onProgress?: ((event: JsonRecord) => void) | undefined;
  promptBudget?: PromptBudget;
  promptContext?: unknown;
  schema: unknown;
  schemaName: string;
  userPrompt: string;
  workflowName?: string;
};

type StructuredResponseResult = {
  data: JsonRecord;
  model: string;
  promptBudget: PromptBudget;
  provider: string;
  responseId: unknown;
};

type ProgressDetail = JsonRecord & {
  chunks?: unknown;
  detail?: unknown;
  llmPromptBudget?: unknown;
  message?: unknown;
  receivedChars?: unknown;
  retryCount?: unknown;
  retryReason?: unknown;
  responseCharCount?: unknown;
  stage?: unknown;
  status?: unknown;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function createHttpError(message: string, statusCode: number, code: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeProvider(value: unknown): string {
  const provider = String(value || "").trim().toLowerCase();
  return provider || "openai";
}

function normalizeBaseUrl(value: unknown, fallback: string): string {
  const raw = String(value || fallback || "").trim();
  if (!raw) {
    return "";
  }

  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function normalizeOpenRouterBaseUrl(value: unknown): string {
  const raw = String(value || "https://openrouter.ai/api/v1").trim();
  if (!raw) {
    return "";
  }

  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/v1") || trimmed.endsWith("/v1")) {
    return trimmed;
  }
  if (trimmed.endsWith("/api")) {
    return `${trimmed}/v1`;
  }

  return `${trimmed}/api/v1`;
}

function getProviderSettings(provider: string): ProviderSettings {
  switch (provider) {
    case "openai":
      return {
        apiKey: process.env.OPENAI_API_KEY || "",
        baseUrl: "https://api.openai.com/v1",
        configuredReason: "Set OPENAI_API_KEY to enable the OpenAI provider.",
        configured: Boolean(process.env.OPENAI_API_KEY || ""),
        model: process.env.STUDIO_LLM_MODEL || process.env.OPENAI_MODEL || "gpt-5.2"
      };
    case "lmstudio": {
      const configuredModel = process.env.STUDIO_LLM_MODEL || process.env.LMSTUDIO_MODEL || process.env.OPENAI_MODEL || "";
      const runtimeSettings = asRecord(getRuntimeLlmSettings());
      const runtimeModelOverride = typeof runtimeSettings.modelOverride === "string"
        ? runtimeSettings.modelOverride.trim()
        : "";
      const model = runtimeModelOverride || configuredModel;
      return {
        apiKey: process.env.LMSTUDIO_API_KEY || "",
        baseUrl: normalizeBaseUrl(
          process.env.STUDIO_LLM_BASE_URL || process.env.LMSTUDIO_BASE_URL,
          "http://127.0.0.1:1234/v1"
        ),
        configuredReason: "Set LMSTUDIO_MODEL or STUDIO_LLM_MODEL to the loaded LM Studio model identifier.",
        configured: Boolean(model),
        model
      };
    }
    case "openrouter": {
      const model = process.env.STUDIO_LLM_MODEL || process.env.OPENROUTER_MODEL || "";
      return {
        apiKey: process.env.OPENROUTER_API_KEY || "",
        baseUrl: normalizeOpenRouterBaseUrl(process.env.STUDIO_LLM_BASE_URL || process.env.OPENROUTER_BASE_URL),
        configuredReason: "Set OPENROUTER_API_KEY and OPENROUTER_MODEL or STUDIO_LLM_MODEL to enable the OpenRouter provider.",
        configured: Boolean((process.env.OPENROUTER_API_KEY || "") && model),
        model
      };
    }
    default:
      return {
        apiKey: "",
        baseUrl: "",
        configuredReason: `Unsupported LLM provider "${provider}".`,
        configured: false,
        model: ""
      };
  }
}

function getLlmConfig(): LlmConfig {
  const provider = normalizeProvider(process.env.STUDIO_LLM_PROVIDER || defaultProvider);
  const settings = getProviderSettings(provider);

  return {
    available: settings.configured,
    baseUrl: settings.baseUrl,
    configured: settings.configured,
    configuredReason: settings.configuredReason,
    model: settings.model,
    provider
  };
}

function getLlmStatus() {
  const config = getLlmConfig();
  return {
    available: config.configured,
    baseUrl: config.baseUrl,
    configuredReason: config.configuredReason,
    model: config.model,
    provider: config.provider
  };
}

function createAuthHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (config.provider === "openai" && process.env.OPENAI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }

  if (config.provider === "lmstudio" && process.env.LMSTUDIO_API_KEY) {
    headers.Authorization = `Bearer ${process.env.LMSTUDIO_API_KEY}`;
  }

  if (config.provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    if (process.env.OPENROUTER_HTTP_REFERER) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
    }
    if (process.env.OPENROUTER_APP_TITLE) {
      headers["X-Title"] = process.env.OPENROUTER_APP_TITLE;
    }
  }

  return headers;
}

function extractResponseOutputText(payload: unknown): string {
  const response = asRecord(payload);
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const texts: string[] = [];
  const output = Array.isArray(response.output) ? response.output : [];

  output.forEach((item) => {
    const outputItem = asRecord(item);
    if (outputItem.type !== "message" || !Array.isArray(outputItem.content)) {
      return;
    }

    outputItem.content.forEach((contentItem) => {
      const content = asRecord(contentItem);
      if (content.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }
    });
  });

  return texts.join("\n").trim();
}

function extractChatCompletionText(payload: unknown): string {
  const response = asRecord(payload);
  const firstChoice = Array.isArray(response.choices) ? asRecord(response.choices[0]) : {};
  const message = asRecord(firstChoice.message);

  const content = message.content;

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((item) => {
        if (!item) {
          return "";
        }

        const contentItem = asRecord(item);
        if (typeof contentItem.text === "string") {
          return contentItem.text;
        }

        if (typeof contentItem.content === "string") {
          return contentItem.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();

    if (joined) {
      return joined;
    }
  }

  const reasoningContent = message.reasoning_content;
  if (typeof reasoningContent === "string") {
    return reasoningContent.trim();
  }

  if (Array.isArray(reasoningContent)) {
    return reasoningContent
      .map((item) => {
        if (!item) {
          return "";
        }

        if (typeof item === "string") {
          return item;
        }

        const contentItem = asRecord(item);
        if (typeof contentItem.text === "string") {
          return contentItem.text;
        }

        if (typeof contentItem.content === "string") {
          return contentItem.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function parseStructuredText(text: string, options: StructuredResponseOptions, config: LlmConfig, payload: unknown): StructuredResponseResult {
  const response = asRecord(payload);
  if (!text) {
    throw new Error(`${config.provider} response did not contain structured text output`);
  }

  try {
    return {
      data: JSON.parse(text),
      model: String(response.model || options.model || config.model),
      promptBudget: {
        ...(options.promptBudget || {}),
        responseCharCount: text.length
      },
      provider: config.provider,
      responseId: response.id || null
    };
  } catch (error) {
    throw new Error(`${config.provider} response was not valid JSON: ${errorMessage(error)}`);
  }
}

function countChars(value: unknown): number {
  return String(value || "").length;
}

function createPromptBudget(config: LlmConfig, options: StructuredResponseOptions, overrides: ProgressDetail = {}): PromptBudget {
  const promptContext = asRecord(options.promptContext);
  const developerPromptCharCount = countChars(options.developerPrompt);
  const userPromptCharCount = countChars(options.userPrompt);
  const schemaCharCount = countChars(JSON.stringify(options.schema || {}));
  const sourcePromptCharCount = countChars(promptContext.sourcePromptText || promptContext.sourcePrompt || "");
  const materialPromptCharCount = countChars(promptContext.materialPromptText || promptContext.materialPrompt || "");

  return {
    developerPromptCharCount,
    materialPromptCharCount,
    model: options.model || config.model,
    provider: config.provider,
    requestedMaxOutputTokens: Number(options.maxOutputTokens || 2600),
    responseCharCount: Number.isFinite(Number(overrides.responseCharCount)) ? Number(overrides.responseCharCount) : null,
    retryCount: Number.isFinite(Number(overrides.retryCount)) ? Number(overrides.retryCount) : 0,
    retryReason: overrides.retryReason || "",
    schemaCharCount,
    schemaName: options.schemaName || "",
    sourcePromptCharCount,
    totalPromptCharCount: developerPromptCharCount + userPromptCharCount + schemaCharCount,
    userPromptCharCount,
    workflowName: promptContext.workflowName || options.workflowName || options.schemaName || "structured-response"
  };
}

function formatProviderName(provider: unknown): string {
  const labels: Record<string, string> = {
    lmstudio: "LM Studio",
    openai: "OpenAI",
    openrouter: "OpenRouter"
  };
  const key = String(provider || "");
  return labels[key] || key || "LLM";
}

function reportLlmProgress(config: LlmConfig, options: StructuredResponseOptions, detail: ProgressDetail = {}) {
  if (typeof options.onProgress !== "function") {
    return;
  }

  const providerName = formatProviderName(config.provider);
  const llm = {
    chunks: Number.isFinite(Number(detail.chunks)) ? Number(detail.chunks) : undefined,
    detail: detail.detail || "",
    model: options.model || config.model,
    promptBudget: detail.llmPromptBudget || undefined,
    provider: config.provider,
    providerName,
    receivedChars: Number.isFinite(Number(detail.receivedChars)) ? Number(detail.receivedChars) : undefined,
    status: detail.status || "working"
  };

  options.onProgress({
    llm,
    message: detail.message || `${providerName}: ${llm.detail || llm.status}`,
    stage: detail.stage || `llm-${llm.status}`
  });
}

function formatReceivedTextProgress(providerName: string, receivedChars: number, chunks: number): string {
  const approxKb = Math.max(0.1, receivedChars / 1024);
  return `${providerName}: receiving response (${chunks} chunk${chunks === 1 ? "" : "s"}, ${approxKb.toFixed(1)} KB)`;
}

async function readChatCompletionStream(response: Response, config: LlmConfig, options: StructuredResponseOptions): Promise<JsonRecord> {
  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error(`${config.provider} streaming response did not expose a readable body`);
  }

  const providerName = formatProviderName(config.provider);
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let chunks = 0;
  let content = "";
  let responseId: unknown = null;
  let model = options.model || config.model;
  let lastReportedChars = 0;

  function handlePayload(payload: unknown): boolean {
    const event = asRecord(payload);
    if (!Object.keys(event).length) {
      return false;
    }

    responseId = responseId || event.id || null;
    model = String(event.model || model);

    const choice = Array.isArray(event.choices) ? asRecord(event.choices[0]) : {};
    const delta = asRecord(choice.delta);
    const text = typeof delta.content === "string"
      ? delta.content
      : typeof delta.reasoning_content === "string"
        ? delta.reasoning_content
        : "";

    if (text) {
      content += text;
      chunks += 1;
      if (chunks === 1 || content.length - lastReportedChars >= 900) {
        lastReportedChars = content.length;
        reportLlmProgress(config, options, {
          chunks,
          detail: `Receiving streamed response from ${providerName}.`,
          message: formatReceivedTextProgress(providerName, content.length, chunks),
          receivedChars: content.length,
          stage: "llm-receiving",
          status: "receiving"
        });
      }
    }

    return Boolean(choice.finish_reason);
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() || "";

    for (const eventText of events) {
      const dataLines = eventText
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === "[DONE]") {
          continue;
        }

        try {
          handlePayload(JSON.parse(dataLine));
        } catch (error) {
          // Ignore malformed stream fragments; the final parse will still validate complete JSON.
        }
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const dataLines = buffer
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    dataLines.forEach((dataLine) => {
      if (!dataLine || dataLine === "[DONE]") {
        return;
      }

      try {
        handlePayload(JSON.parse(dataLine));
      } catch (error) {
        // Ignore trailing malformed stream fragments.
      }
    });
  }

  reportLlmProgress(config, options, {
    chunks,
    detail: "Stream complete; parsing structured JSON.",
    message: `${providerName}: stream complete, parsing structured JSON.`,
    receivedChars: content.length,
    stage: "llm-parsing",
    status: "parsing"
  });

  return {
    choices: [
      {
        message: {
          content
        }
      }
    ],
    id: responseId,
    model
  };
}

async function createOpenAiStructuredResponse(config: LlmConfig, options: StructuredResponseOptions): Promise<StructuredResponseResult> {
  const promptBudget = createPromptBudget(config, options);
  options.promptBudget = promptBudget;
  reportLlmProgress(config, options, {
    detail: "Submitting structured response request.",
    llmPromptBudget: promptBudget,
    message: `${formatProviderName(config.provider)}: submitting structured response request.`,
    stage: "llm-submitting",
    status: "submitting"
  });
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: createAuthHeaders(config),
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: options.developerPrompt,
              type: "input_text"
            }
          ],
          role: "developer"
        },
        {
          content: [
            {
              text: options.userPrompt,
              type: "input_text"
            }
          ],
          role: "user"
        }
      ],
      max_output_tokens: options.maxOutputTokens || 2600,
      model: options.model || config.model,
      store: false,
      text: {
        format: {
          name: options.schemaName,
          schema: options.schema,
          strict: true,
          type: "json_schema"
        }
      }
    })
  });

  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    const error = asRecord(payload.error);
    const message = typeof error.message === "string"
      ? error.message
      : `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  reportLlmProgress(config, options, {
    detail: "Response received; parsing structured JSON.",
    message: `${formatProviderName(config.provider)}: response received, parsing structured JSON.`,
    stage: "llm-parsing",
    status: "parsing"
  });

  const parsed = parseStructuredText(extractResponseOutputText(payload), options, config, payload);
  reportLlmProgress(config, options, {
    detail: "Structured JSON parsed.",
    llmPromptBudget: parsed.promptBudget,
    message: `${formatProviderName(config.provider)}: structured JSON parsed.`,
    stage: "llm-parsed",
    status: "parsing"
  });
  return parsed;
}

async function createLmStudioStructuredResponse(config: LlmConfig, options: StructuredResponseOptions): Promise<StructuredResponseResult> {
  const promptBudget = createPromptBudget(config, options);
  options.promptBudget = promptBudget;
  reportLlmProgress(config, options, {
    detail: "Submitting streaming chat completion request.",
    llmPromptBudget: promptBudget,
    message: `${formatProviderName(config.provider)}: submitting streaming chat completion request.`,
    stage: "llm-submitting",
    status: "submitting"
  });
  const maxTokens = options.maxOutputTokens || 2600;
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: createAuthHeaders(config),
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [
        {
          content: options.developerPrompt,
          role: "system"
        },
        {
          content: options.userPrompt,
          role: "user"
        }
      ],
      model: options.model || config.model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          schema: options.schema,
          strict: true
        }
      },
      stream: true,
      temperature: 0
    })
  });

  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    const error = asRecord(payload.error);
    const message = typeof error.message === "string"
      ? error.message
      : `LM Studio request failed with status ${response.status}`;
    throw new Error(message);
  }

  const payload = await readChatCompletionStream(response, config, options);
  try {
    const parsed = parseStructuredText(extractChatCompletionText(payload), options, config, payload);
    reportLlmProgress(config, options, {
      detail: "Structured JSON parsed.",
      llmPromptBudget: parsed.promptBudget,
      message: `${formatProviderName(config.provider)}: structured JSON parsed.`,
      stage: "llm-parsed",
      status: "parsing"
    });
    return parsed;
  } catch (error) {
    if (!/not valid JSON/.test(errorMessage(error))) {
      throw error;
    }

    return retryLmStudioStructuredResponse(config, options, error, maxTokens);
  }
}

async function retryLmStudioStructuredResponse(config: LlmConfig, options: StructuredResponseOptions, originalError: unknown, previousMaxTokens: number): Promise<StructuredResponseResult> {
  const retryMaxTokens = Math.max(previousMaxTokens * 2, previousMaxTokens + 2600);
  const retryOptions = {
    ...options,
    developerPrompt: [
      options.developerPrompt,
      "",
      "Your previous structured response was invalid or truncated.",
      "Retry once with compact complete JSON only.",
      "Use short strings while preserving required fields and schema validity."
    ].join("\n"),
    maxOutputTokens: retryMaxTokens
  };
  retryOptions.promptBudget = createPromptBudget(config, retryOptions, {
    retryCount: 1,
    retryReason: errorMessage(originalError) || "invalid structured JSON"
  });

  reportLlmProgress(config, options, {
    detail: "Retrying after invalid structured JSON.",
    llmPromptBudget: retryOptions.promptBudget,
    message: `${formatProviderName(config.provider)}: retrying invalid structured JSON response.`,
    stage: "llm-retrying",
    status: "retrying"
  });

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: createAuthHeaders(config),
    body: JSON.stringify({
      max_tokens: retryMaxTokens,
      messages: [
        {
          content: retryOptions.developerPrompt,
          role: "system"
        },
        {
          content: retryOptions.userPrompt,
          role: "user"
        }
      ],
      model: retryOptions.model || config.model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: retryOptions.schemaName,
          schema: retryOptions.schema,
          strict: true
        }
      },
      stream: true,
      temperature: 0
    })
  });

  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    const error = asRecord(payload.error);
    const message = typeof error.message === "string"
      ? error.message
      : `LM Studio retry request failed with status ${response.status}`;
    throw new Error(`${errorMessage(originalError)}; retry failed: ${message}`);
  }

  const payload = await readChatCompletionStream(response, config, retryOptions);
  try {
    const parsed = parseStructuredText(extractChatCompletionText(payload), retryOptions, config, payload);
    reportLlmProgress(config, retryOptions, {
      detail: "Structured JSON parsed after retry.",
      llmPromptBudget: parsed.promptBudget,
      message: `${formatProviderName(config.provider)}: structured JSON parsed after retry.`,
      stage: "llm-parsed",
      status: "parsing"
    });
    return parsed;
  } catch (retryError) {
    throw new Error(`${errorMessage(originalError)}; retry also failed: ${errorMessage(retryError)}`);
  }
}

async function createOpenRouterStructuredResponse(config: LlmConfig, options: StructuredResponseOptions): Promise<StructuredResponseResult> {
  const promptBudget = createPromptBudget(config, options);
  options.promptBudget = promptBudget;
  reportLlmProgress(config, options, {
    detail: "Submitting structured chat completion request.",
    llmPromptBudget: promptBudget,
    message: `${formatProviderName(config.provider)}: submitting structured chat completion request.`,
    stage: "llm-submitting",
    status: "submitting"
  });
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: createAuthHeaders(config),
    body: JSON.stringify({
      max_tokens: options.maxOutputTokens || 2600,
      messages: [
        {
          content: options.developerPrompt,
          role: "system"
        },
        {
          content: options.userPrompt,
          role: "user"
        }
      ],
      model: options.model || config.model,
      provider: {
        require_parameters: true
      },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          schema: options.schema,
          strict: true
        }
      },
      stream: false,
      temperature: 0
    })
  });

  const payload = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    const error = asRecord(payload.error);
    const message = typeof error.message === "string"
      ? error.message
      : `OpenRouter request failed with status ${response.status}`;
    throw new Error(message);
  }

  reportLlmProgress(config, options, {
    detail: "Response received; parsing structured JSON.",
    message: `${formatProviderName(config.provider)}: response received, parsing structured JSON.`,
    stage: "llm-parsing",
    status: "parsing"
  });

  const parsed = parseStructuredText(extractChatCompletionText(payload), options, config, payload);
  reportLlmProgress(config, options, {
    detail: "Structured JSON parsed.",
    llmPromptBudget: parsed.promptBudget,
    message: `${formatProviderName(config.provider)}: structured JSON parsed.`,
    stage: "llm-parsed",
    status: "parsing"
  });
  return parsed;
}

async function createStructuredResponse(options: StructuredResponseOptions): Promise<StructuredResponseResult> {
  const config = getLlmConfig();
  if (!config.configured) {
    throw new Error(`LLM generation is not configured. ${config.configuredReason}`);
  }

  switch (config.provider) {
    case "openai":
      return createOpenAiStructuredResponse(config, options);
    case "lmstudio":
      return createLmStudioStructuredResponse(config, options);
    case "openrouter":
      return createOpenRouterStructuredResponse(config, options);
    default:
      throw new Error(`Unsupported LLM provider "${config.provider}"`);
  }
}

async function listProviderModels(config: LlmConfig): Promise<LlmModelList> {
  const response = await fetch(`${config.baseUrl}/models`, {
    method: "GET",
    headers: createAuthHeaders(config)
  });
  const payload = asRecord(await response.json().catch(() => ({})));

  if (!response.ok) {
    const error = asRecord(payload.error);
    const message = typeof error.message === "string"
      ? error.message
      : `${config.provider} models request failed with status ${response.status}`;
    throw new Error(message);
  }

  const models = Array.isArray(payload.data)
    ? payload.data
        .map((item) => {
          const model = asRecord(item);
          return model.id || model.name ? String(model.id || model.name) : "";
        })
        .filter(Boolean)
    : [];

  return {
    count: models.length,
    models
  };
}

function getConfiguredLlmModel(provider = normalizeProvider(process.env.STUDIO_LLM_PROVIDER || defaultProvider)): string {
  switch (provider) {
    case "openai":
      return process.env.STUDIO_LLM_MODEL || process.env.OPENAI_MODEL || "gpt-5.2";
    case "lmstudio":
      return process.env.STUDIO_LLM_MODEL || process.env.LMSTUDIO_MODEL || process.env.OPENAI_MODEL || "";
    case "openrouter":
      return process.env.STUDIO_LLM_MODEL || process.env.OPENROUTER_MODEL || "";
    default:
      return "";
  }
}

async function getLlmModelState(): Promise<LlmModelState> {
  const config = getLlmConfig();
  const runtimeSettings = asRecord(getRuntimeLlmSettings());
  const runtimeOverride = config.provider === "lmstudio" && typeof runtimeSettings.modelOverride === "string"
    ? runtimeSettings.modelOverride.trim()
    : "";
  const state: LlmModelState = {
    activeModel: config.model,
    baseUrl: config.baseUrl,
    configuredModel: getConfiguredLlmModel(config.provider),
    models: [],
    provider: config.provider,
    runtimeOverride
  };

  if (config.provider !== "lmstudio") {
    return state;
  }

  try {
    const modelInfo = await listProviderModels(config);
    return {
      ...state,
      models: modelInfo.models
    };
  } catch (error) {
    return {
      ...state,
      error: errorMessage(error)
    };
  }
}

async function setLlmModelOverride(modelOverride: unknown): Promise<LlmModelState> {
  const config = getLlmConfig();
  if (config.provider !== "lmstudio") {
    throw createHttpError("Runtime model selection is only available for the LM Studio provider.", 400, "UNSUPPORTED_PROVIDER");
  }

  const model = typeof modelOverride === "string" ? modelOverride.trim() : "";
  if (!model) {
    saveRuntimeLlmSettings({
      modelOverride: ""
    });
    return getLlmModelState();
  }

  const modelInfo = await listProviderModels(config);
  if (!modelInfo.models.includes(model)) {
    throw createHttpError(`LM Studio does not list model "${model}". Refresh models and select a loaded model.`, 400, "UNKNOWN_LMSTUDIO_MODEL");
  }

  saveRuntimeLlmSettings({
    modelOverride: model
  });
  return getLlmModelState();
}

async function verifyLlmConnection() {
  const config = getLlmConfig();
  const checks = [];

  if (!config.configured) {
    return {
      baseUrl: config.baseUrl,
      checks: [
        {
          message: config.configuredReason,
          ok: false,
          step: "configuration"
        }
      ],
      model: config.model,
      ok: false,
      provider: config.provider,
      summary: config.configuredReason,
      testedAt: new Date().toISOString()
    };
  }

  checks.push({
    message: `Using provider ${config.provider} with model ${config.model}.`,
    ok: true,
    step: "configuration"
  });

  let modelInfo;
  try {
    modelInfo = await listProviderModels(config);
    const configuredModelFound = modelInfo.models.includes(config.model);
    checks.push({
      message: configuredModelFound
        ? `Provider responded with ${modelInfo.count} models and found the configured model.`
        : `Provider responded with ${modelInfo.count} models but did not list the configured model.`,
      ok: configuredModelFound,
      step: "models"
    });
  } catch (error) {
    checks.push({
      message: errorMessage(error),
      ok: false,
      step: "models"
    });

    return {
      baseUrl: config.baseUrl,
      checks,
      model: config.model,
      ok: false,
      provider: config.provider,
      summary: `Could not reach ${config.provider} models endpoint.`,
      testedAt: new Date().toISOString()
    };
  }

  try {
    const verification = await createStructuredResponse({
      developerPrompt: "Return strict JSON matching the provided schema. Do not add any extra keys.",
      maxOutputTokens: 120,
      model: config.model,
      schema: {
        additionalProperties: false,
        properties: {
          provider: { type: "string" },
          status: { type: "string" }
        },
        required: ["status", "provider"],
        type: "object"
      },
      schemaName: "studio_llm_verification",
      userPrompt: `Reply with status \"ok\" and provider \"${config.provider}\".`
    });

    const data = verification.data || {};
    const structuredOk = data.status === "ok" && typeof data.provider === "string";
    checks.push({
      message: structuredOk
        ? `Structured output succeeded through ${verification.provider} using model ${verification.model}.`
        : "Structured output returned unexpected content.",
      ok: structuredOk,
      step: "structured-output"
    });

    return {
      baseUrl: config.baseUrl,
      checks,
      model: verification.model,
      ok: checks.every((check) => check.ok),
      provider: verification.provider,
      summary: checks.every((check) => check.ok)
        ? `Verified ${verification.provider} connectivity and structured output for ${verification.model}.`
        : `Reached ${verification.provider}, but one or more verification steps failed for ${verification.model}.`,
      testedAt: new Date().toISOString()
    };
  } catch (error) {
    checks.push({
      message: errorMessage(error),
      ok: false,
      step: "structured-output"
    });

    return {
      baseUrl: config.baseUrl,
      checks,
      model: config.model,
      ok: false,
      provider: config.provider,
      summary: `Reached ${config.provider}, but structured output verification failed for ${config.model}.`,
      testedAt: new Date().toISOString()
    };
  }
}

export {
  createStructuredResponse,
  getLlmModelState,
  getLlmConfig,
  getLlmStatus,
  setLlmModelOverride,
  verifyLlmConnection
};
