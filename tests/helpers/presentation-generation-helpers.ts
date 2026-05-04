export type JsonRecord = Record<string, unknown>;

export type MockChatRequest = JsonRecord & {
  max_tokens?: number;
  messages: Array<{
    content: string;
  }>;
  response_format: {
    json_schema: {
      name: string;
    };
  };
};

export type GeneratedPlanPoint = {
  body?: string;
  title?: string;
};

export type GeneratedSlideSpec = JsonRecord & {
  bullets?: GeneratedPlanPoint[];
  cards?: GeneratedPlanPoint[];
  eyebrow?: string;
  guardrails?: GeneratedPlanPoint[];
  guardrailsTitle?: string;
  media?: Array<JsonRecord & { caption?: string; materialId?: string; url?: string }>;
  note?: string;
  resources?: GeneratedPlanPoint[];
  resourcesTitle?: string;
  signals?: GeneratedPlanPoint[];
  signalsTitle?: string;
  summary?: string;
  title?: string;
  type?: string;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseMockRequestBody(init: RequestInit | undefined): JsonRecord {
  const body = init?.body;
  if (typeof body !== "string") {
    throw new Error("mocked LLM request should provide a JSON string body");
  }
  const parsed: unknown = JSON.parse(body);
  if (!isJsonRecord(parsed)) {
    throw new Error("mocked LLM request body should parse to an object");
  }
  return parsed;
}

export function parseMockChatRequest(init: RequestInit | undefined): MockChatRequest {
  const body = parseMockRequestBody(init);
  const responseFormat = body.response_format;
  if (!isJsonRecord(responseFormat)) {
    throw new Error("mocked LLM request should include response_format");
  }
  const jsonSchema = responseFormat.json_schema;
  if (!isJsonRecord(jsonSchema) || typeof jsonSchema.name !== "string") {
    throw new Error("mocked LLM request should include a schema name");
  }
  if (!Array.isArray(body.messages)) {
    throw new Error("mocked LLM request should include messages");
  }

  const request: MockChatRequest = {
    ...body,
    messages: body.messages.map((message: unknown) => {
      if (!isJsonRecord(message)) {
        throw new Error("mocked LLM message should be an object");
      }
      return {
        content: String(message.content || "")
      };
    }),
    response_format: {
      json_schema: {
        name: jsonSchema.name
      }
    }
  };
  if (typeof body.max_tokens === "number") {
    request.max_tokens = body.max_tokens;
  }
  return request;
}

export function collectGeneratedVisibleText(slideSpecs: GeneratedSlideSpec[]): string[] {
  return slideSpecs.flatMap((slideSpec: GeneratedSlideSpec) => [
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle,
    ...(slideSpec.cards || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.signals || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.guardrails || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.bullets || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body]),
    ...(slideSpec.resources || []).flatMap((item: GeneratedPlanPoint) => [item.title, item.body])
  ].filter((value): value is string => Boolean(value)));
}
