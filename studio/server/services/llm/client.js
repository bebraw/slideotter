const defaultProvider = process.env.STUDIO_LLM_PROVIDER || "openai";
const defaultModel = process.env.OPENAI_MODEL || "gpt-5.2";
const defaultGenerationMode = process.env.STUDIO_IDEATE_MODE || "auto";

function getLlmConfig() {
  const provider = process.env.STUDIO_LLM_PROVIDER || defaultProvider;
  const model = process.env.OPENAI_MODEL || defaultModel;
  const apiKey = process.env.OPENAI_API_KEY || "";
  const configured = provider === "openai" && Boolean(apiKey);

  return {
    configured,
    defaultGenerationMode: process.env.STUDIO_IDEATE_MODE || defaultGenerationMode,
    model,
    provider
  };
}

function getLlmStatus() {
  const config = getLlmConfig();
  return {
    available: config.configured,
    defaultGenerationMode: config.defaultGenerationMode,
    model: config.model,
    provider: config.provider
  };
}

function extractOutputText(payload) {
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

async function createStructuredResponse(options) {
  const config = getLlmConfig();
  if (!config.configured) {
    throw new Error("LLM generation is not configured. Set OPENAI_API_KEY to enable it.");
  }

  if (config.provider !== "openai") {
    throw new Error(`Unsupported LLM provider "${config.provider}"`);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
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

  const text = extractOutputText(payload);
  if (!text) {
    throw new Error("OpenAI response did not contain structured text output");
  }

  try {
    return {
      data: JSON.parse(text),
      model: payload.model || options.model || config.model,
      provider: config.provider,
      responseId: payload.id || null
    };
  } catch (error) {
    throw new Error(`OpenAI response was not valid JSON: ${error.message}`);
  }
}

module.exports = {
  createStructuredResponse,
  getLlmConfig,
  getLlmStatus
};
