const { loadEnvFiles } = require("../env.ts");

loadEnvFiles();

const defaultProvider = process.env.STUDIO_LLM_PROVIDER || "openai";
const defaultGenerationMode = process.env.STUDIO_IDEATE_MODE || "auto";

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return provider || "openai";
}

function normalizeBaseUrl(value, fallback) {
  const raw = String(value || fallback || "").trim();
  if (!raw) {
    return "";
  }

  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function normalizeOpenRouterBaseUrl(value) {
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

function getProviderSettings(provider) {
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
      const model = process.env.STUDIO_LLM_MODEL || process.env.LMSTUDIO_MODEL || process.env.OPENAI_MODEL || "";
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

function getLlmConfig() {
  const provider = normalizeProvider(process.env.STUDIO_LLM_PROVIDER || defaultProvider);
  const settings = getProviderSettings(provider);

  return {
    available: settings.configured,
    baseUrl: settings.baseUrl,
    configured: settings.configured,
    configuredReason: settings.configuredReason,
    defaultGenerationMode: process.env.STUDIO_IDEATE_MODE || defaultGenerationMode,
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
    defaultGenerationMode: config.defaultGenerationMode,
    model: config.model,
    provider: config.provider
  };
}

function createAuthHeaders(config) {
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

function extractResponseOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const texts = [];
  const output = Array.isArray(payload.output) ? payload.output : [];

  output.forEach((item) => {
    if (!item || item.type !== "message" || !Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (contentItem && contentItem.type === "output_text" && typeof contentItem.text === "string") {
        texts.push(contentItem.text);
      }
    });
  });

  return texts.join("\n").trim();
}

function extractChatCompletionText(payload) {
  const message = payload
    && Array.isArray(payload.choices)
    && payload.choices[0]
    && payload.choices[0].message
    ? payload.choices[0].message
    : null;

  const content = message ? message.content : null;

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

        if (typeof item.text === "string") {
          return item.text;
        }

        if (typeof item.content === "string") {
          return item.content;
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

  const reasoningContent = message ? message.reasoning_content : null;
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

        if (typeof item.text === "string") {
          return item.text;
        }

        if (typeof item.content === "string") {
          return item.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function parseStructuredText(text, options, config, payload) {
  if (!text) {
    throw new Error(`${config.provider} response did not contain structured text output`);
  }

  try {
    return {
      data: JSON.parse(text),
      model: payload.model || options.model || config.model,
      provider: config.provider,
      responseId: payload.id || null
    };
  } catch (error) {
    throw new Error(`${config.provider} response was not valid JSON: ${error.message}`);
  }
}

async function createOpenAiStructuredResponse(config, options) {
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parseStructuredText(extractResponseOutputText(payload), options, config, payload);
}

async function createLmStudioStructuredResponse(config, options) {
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : `LM Studio request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parseStructuredText(extractChatCompletionText(payload), options, config, payload);
}

async function createOpenRouterStructuredResponse(config, options) {
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : `OpenRouter request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parseStructuredText(extractChatCompletionText(payload), options, config, payload);
}

async function createStructuredResponse(options) {
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

async function listProviderModels(config) {
  const response = await fetch(`${config.baseUrl}/models`, {
    method: "GET",
    headers: createAuthHeaders(config)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload && payload.error && payload.error.message
      ? payload.error.message
      : `${config.provider} models request failed with status ${response.status}`;
    throw new Error(message);
  }

  const models = Array.isArray(payload.data)
    ? payload.data
        .map((item) => (item && (item.id || item.name)) ? String(item.id || item.name) : "")
        .filter(Boolean)
    : [];

  return {
    count: models.length,
    models
  };
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
      message: error.message,
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
      message: error.message,
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

module.exports = {
  createStructuredResponse,
  getLlmConfig,
  getLlmStatus,
  verifyLlmConnection
};
