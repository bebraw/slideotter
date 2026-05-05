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

export type GeneratedPlanSlide = {
  eyebrow?: string;
  guardrails?: GeneratedPlanPoint[];
  guardrailsTitle?: string;
  keyPoints?: GeneratedPlanPoint[];
  mediaMaterialId?: string;
  note?: string;
  resources?: GeneratedPlanPoint[];
  resourcesTitle?: string;
  role?: string;
  signalsTitle?: string;
  sourceNeed?: string;
  sourceNeeds?: string;
  summary?: string;
  title?: string;
  type?: string;
  value?: string;
  visualNeed?: string;
  visualNeeds?: string;
};

export type GeneratedPlan = {
  outline: string;
  references: unknown[];
  slides: GeneratedPlanSlide[];
  summary: string;
};

export type GeneratedPlanOptions = {
  mediaMaterialId?: string;
  mediaSlideIndex?: number;
  sourceText?: string;
  startIndex?: number;
  total?: number;
};

export type GeneratedDeckPlanSlide = {
  intent: string;
  keyMessage: string;
  role?: string;
  sourceNeed?: string;
  title: string;
  type?: string;
  visualNeed: string;
};

export type GeneratedDeckPlan = {
  audience: string;
  language: string;
  narrativeArc: string;
  outline: string;
  slides: GeneratedDeckPlanSlide[];
  thesis: string;
};

export function withVisiblePlanFields(slide: GeneratedPlanSlide, fields: GeneratedPlanSlide = {}): GeneratedPlanSlide {
  return {
    eyebrow: fields.eyebrow || "Section",
    guardrails: fields.guardrails || [
      { body: "Keep the slide focused on one useful idea.", title: "Focus" },
      { body: "Make the claim concrete enough to discuss.", title: "Concrete" },
      { body: "Avoid adding unsupported details.", title: "Evidence" }
    ],
    guardrailsTitle: fields.guardrailsTitle || "Checks",
    mediaMaterialId: fields.mediaMaterialId || "",
    note: fields.note || "Introduce the slide in one clear sentence.",
    resources: fields.resources || [
      { body: "Use the next action while reviewing the draft.", title: "Action" },
      { body: "Keep one example ready for questions.", title: "Example" }
    ],
    resourcesTitle: fields.resourcesTitle || "Cues",
    signalsTitle: fields.signalsTitle || "Points",
    type: fields.type || "content",
    ...slide
  };
}

export function createGeneratedPlan(title: string, slideCount: number, options: GeneratedPlanOptions = {}): GeneratedPlan {
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Number(options.startIndex) : 0;
  const total = Number.isFinite(Number(options.total)) ? Number(options.total) : slideCount;
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const absoluteIndex = startIndex + index;
    const isFirst = absoluteIndex === 0;
    const isLast = absoluteIndex === total - 1 && total > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : (["context", "concept", "mechanics", "example", "tradeoff"][(absoluteIndex - 1) % 5] ?? "context");
    const label = `${title} ${absoluteIndex + 1}`;
    const sourceBody = options.sourceText && index === 1 ? options.sourceText : `${label} carries generated draft content.`;
    const mediaMaterialId = options.mediaMaterialId && index === (options.mediaSlideIndex || 1) ? options.mediaMaterialId : "";

    return withVisiblePlanFields({
      keyPoints: [
        { body: sourceBody, title: `${label} point A` },
        { body: `${label} adds a second distinct idea.`, title: `${label} point B` },
        { body: `${label} adds a third distinct idea.`, title: `${label} point C` }
      ],
      mediaMaterialId,
      role,
      summary: `${label} summarizes one useful generated idea.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content"
    }, {
      eyebrow: isFirst ? "Opening" : isLast ? "Close" : `Section ${index + 1}`,
      guardrails: [
        { body: `${label} guardrail one is specific.`, title: `${label} check A` },
        { body: `${label} guardrail two is specific.`, title: `${label} check B` },
        { body: `${label} guardrail three is specific.`, title: `${label} check C` }
      ],
      guardrailsTitle: `${label} checks`,
      note: `${label} has a speaker note.`,
      resources: [
        { body: `${label} resource one.`, title: `${label} resource A` },
        { body: `${label} resource two.`, title: `${label} resource B` }
      ],
      resourcesTitle: `${label} resources`,
      signalsTitle: `${label} points`
    });
  });

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: [],
    slides,
    summary: `${title} generated plan`
  };
}

export function createGeneratedDeckPlan(title: string, slideCount: number): GeneratedDeckPlan {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : (["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5] ?? "context");
    const label = `${title} ${index + 1}`;

    return {
      intent: `${label} has a distinct planning intent.`,
      keyMessage: `${label} carries one clear generated message.`,
      role,
      sourceNeed: `${label} should use supplied context when relevant.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content",
      visualNeed: `${label} may use fitting supplied imagery.`
    };
  });

  return {
    audience: "Coverage audience",
    language: "English",
    narrativeArc: `${title} moves from context to action.`,
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: `${title} should exercise phased generation.`
  };
}
