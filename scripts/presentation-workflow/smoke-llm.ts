type JsonRecord = Record<string, unknown>;

type LlmMessage = {
  content?: unknown;
};

type LlmRequestBody = {
  messages?: LlmMessage[];
  response_format?: {
    json_schema?: {
      name?: string;
      schema?: JsonRecord;
    };
  };
};

type SmokeSlidePlanOptions = {
  startIndex?: number;
  total?: number;
};

const smokePresentation = {
  baseId: "temporary-workflow-smoke",
  copyId: "temporary-workflow-smoke-copy",
  title: "Temporary workflow smoke"
} as const;
const smokePresentationIdPattern = /^temporary-workflow-smoke(?:-\d+|-copy.*)?$/;
const createdSmokePresentationIdPattern = /^temporary-workflow-smoke(?:-\d+)?$/;
const smokeIds: readonly string[] = [
  smokePresentation.copyId,
  smokePresentation.baseId
];
const originalFetch = global.fetch;
const llmEnvKeys = [
  "LMSTUDIO_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));

function isSmokePresentationId(id: string): boolean {
  return smokeIds.includes(id) || smokePresentationIdPattern.test(id);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function createLmStudioStreamResponse(data: unknown): Response {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{ delta: { content }, finish_reason: null }],
        id: "chatcmpl-workflow-smoke",
        model: "workflow-smoke-model"
      })}\n\n`));
      controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
    status: 200
  });
}

function roleForSmokeSlide(index: number, total: number): string {
  if (index === 0) {
    return "opening";
  }

  if (index === total - 1 && total > 1) {
    return "handoff";
  }

  const roles = ["context", "concept", "mechanics", "example", "tradeoff"];
  return roles[(index - 1) % roles.length] || "context";
}

function createSmokeDeckPlan(slideCount: number): JsonRecord {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const label = `Workflow smoke ${index + 1}`;
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;

    return {
      intent: `${label} validates one browser workflow step.`,
      keyMessage: `${label} keeps the smoke deck grounded and distinct.`,
      role: roleForSmokeSlide(index, slideCount),
      sourceNeed: `${label} should use the workflow validation source when useful.`,
      title: label,
      type: isFirst ? "cover" : isLast ? "summary" : "content",
      visualNeed: `${label} can use the uploaded workflow material when useful.`
    };
  });

  return {
    audience: "Workflow validation",
    language: "English",
    narrativeArc: "Move from workflow purpose to browser actions and cleanup.",
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: "The browser workflow can create, edit, ground, and clean up a presentation."
  };
}

function createSmokeSlidePlan(slideCount: number, options: SmokeSlidePlanOptions = {}): JsonRecord {
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Number(options.startIndex) : 0;
  const total = Number.isFinite(Number(options.total)) ? Number(options.total) : slideCount;
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const absoluteIndex = startIndex + index;
    const label = `Workflow smoke ${absoluteIndex + 1}`;
    const sourceBody = absoluteIndex === 1
      ? "Workflow validation source confirms browser UI management and grounded generation diagnostics."
      : `${label} verifies a distinct part of the browser workflow.`;

    return {
      eyebrow: absoluteIndex === 0 ? "Opening" : absoluteIndex === total - 1 ? "Close" : `Step ${absoluteIndex + 1}`,
      guardrails: [
        { body: `${label} keeps the smoke check focused.`, title: `${label} focus` },
        { body: `${label} avoids unrelated workflow edits.`, title: `${label} scope` },
        { body: `${label} leaves cleanup visible.`, title: `${label} cleanup` }
      ],
      guardrailsTitle: `${label} checks`,
      keyPoints: [
        { body: sourceBody, title: `${label} source` },
        { body: `${label} confirms slide creation remains functional.`, title: `${label} create` },
        { body: `${label} confirms editing remains functional.`, title: `${label} edit` },
        { body: `${label} confirms cleanup remains functional.`, title: `${label} clean` }
      ],
      mediaMaterialId: "",
      note: `${label} supports workflow smoke validation.`,
      resources: [
        { body: `${label} source note.`, title: `${label} source` },
        { body: `${label} cleanup note.`, title: `${label} cleanup` }
      ],
      resourcesTitle: `${label} resources`,
      role: roleForSmokeSlide(absoluteIndex, total),
      signalsTitle: `${label} points`,
      summary: `${label} checks one complete browser workflow step.`,
      title: label,
      type: absoluteIndex === 0 ? "cover" : absoluteIndex === total - 1 ? "summary" : "content"
    };
  });

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: [],
    slides,
    summary: "Workflow smoke generated plan"
  };
}

function createSmokeRedoLayoutPlan(requestBody: LlmRequestBody): JsonRecord {
  const prompt = String(requestBody.messages?.map((message) => message.content).join("\n") || "");
  const schema = requestBody.response_format?.json_schema?.schema || {};
  const schemaProperties = asRecord(schema.properties);
  const candidatesSchema = asRecord(schemaProperties.candidates);
  const minItems = candidatesSchema.minItems;
  const count = Number.isFinite(Number(minItems)) ? Number(minItems) : 5;
  const currentType = prompt.match(/Current slide type:\s*([a-zA-Z]+)/)?.[1] || "content";
  const photoGridIntents = [
    ["Lead image grid", "Use the first image as the lead visual with a compact context caption."],
    ["Comparison grid", "Arrange the images as a side-by-side comparison."],
    ["Evidence grid", "Group the images as supporting proof for the slide claim."]
  ];

  return {
    candidates: Array.from({ length: count }, (_unused, index) => {
      const photoGridIntent = photoGridIntents[index % photoGridIntents.length] || photoGridIntents[0];
      if (!photoGridIntent) {
        throw new Error("Smoke layout intents are not configured");
      }

      return {
        droppedFields: [],
        emphasis: currentType === "photoGrid"
          ? [photoGridIntent[1], "Keep every existing image attached."]
          : [
              index % 2 === 0 ? "Make the hierarchy easier to scan." : "Give supporting points more visual separation.",
              "Keep existing slide meaning intact."
            ],
        label: currentType === "photoGrid" ? photoGridIntent[0] : `Workflow layout ${index + 1}`,
        preservedFields: ["title", "summary", "keyPoints"],
        rationale: `Workflow smoke layout ${index + 1} validates LLM-only redo layout.`,
        targetFamily: currentType
      };
    })
  };
}

function getRequestedStructuredCandidateCount(requestBody: LlmRequestBody, fallback = 3): number {
  const schema = asRecord(requestBody.response_format?.json_schema?.schema);
  const properties = asRecord(schema.properties);
  const candidateSchema = asRecord(properties.candidates);
  const minItems = Number(candidateSchema?.minItems);
  const maxItems = Number(candidateSchema?.maxItems);
  if (Number.isFinite(minItems) && minItems > 0) {
    return minItems;
  }
  if (Number.isFinite(maxItems) && maxItems > 0) {
    return maxItems;
  }
  return fallback;
}

function createSmokeDeckStructurePlan(requestBody: LlmRequestBody): JsonRecord {
  const candidateCount = getRequestedStructuredCandidateCount(requestBody);
  const slideTitles = [
    "Workflow smoke opening",
    "Workflow smoke system",
    "Workflow smoke proof",
    "Workflow smoke handoff",
    "Workflow smoke appendix",
    "Workflow smoke source path",
    "Workflow smoke close"
  ];

  return {
    candidates: Array.from({ length: candidateCount }, (_unused, candidateIndex) => ({
      changeLead: `Smoke deck plan ${candidateIndex + 1} keeps the browser workflow deterministic.`,
      label: `Smoke deck plan ${candidateIndex + 1}`,
      notes: "Browser validation uses this mocked structured plan instead of live LM Studio output.",
      promptSummary: "Deterministic browser smoke deck-structure candidate.",
      slides: slideTitles.map((title, slideIndex) => ({
        action: "keep",
        currentIndex: slideIndex + 1,
        currentTitle: title,
        grounding: ["Workflow smoke source", "Saved outline"],
        proposedIndex: slideIndex + 1,
        proposedTitle: `${title} ${candidateIndex + 1}`,
        rationale: "Keep the existing smoke slide while exercising the deck-plan preview and apply path.",
        role: slideIndex === 0 ? "opening" : slideIndex === slideTitles.length - 1 ? "handoff" : "support",
        summary: "Preserve the current smoke slide and keep the plan apply path deterministic.",
        type: slideIndex === 0 ? "cover" : slideIndex === slideTitles.length - 1 ? "summary" : "content"
      })),
      summary: `Deterministic deck-structure candidate ${candidateIndex + 1} for browser validation.`
    }))
  };
}

function createSmokeTheme(): JsonRecord {
  return {
    name: "Workflow smoke theme",
    theme: {
      accent: "#09b5c4",
      bg: "#000000",
      fontFamily: "Avenir Next",
      light: "#183b40",
      muted: "#dcefed",
      panel: "#101820",
      primary: "#f7fcfb",
      progressFill: "#b6fff8",
      progressTrack: "#183b40",
      secondary: "#b6fff8",
      surface: "#f7fcfb"
    }
  };
}

function installSmokeLlmMock(): void {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "workflow-smoke-model";

  global.fetch = async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const urlText = String(url);
    if (!/\/chat\/completions$/.test(urlText)) {
      return originalFetch(url, init);
    }

    const requestBody = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as LlmRequestBody;
    const schemaName = requestBody.response_format?.json_schema?.name;
    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createSmokeDeckPlan(7));
    }

    if (schemaName === "initial_presentation_plan") {
      const prompt = String(requestBody.messages?.map((message) => message.content).join("\n") || "");
      const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
      if (targetMatch) {
        const slideNumber = Number.parseInt(targetMatch[1] || "1", 10);
        const total = Number.parseInt(targetMatch[2] || "1", 10);
        return createLmStudioStreamResponse(createSmokeSlidePlan(1, {
          startIndex: slideNumber - 1,
          total
        }));
      }

      return createLmStudioStreamResponse(createSmokeSlidePlan(7));
    }

    if (schemaName === "redo_layout_family_variants") {
      return createLmStudioStreamResponse(createSmokeRedoLayoutPlan(requestBody));
    }

    if (schemaName === "deck_structure_plan_candidates") {
      return createLmStudioStreamResponse(createSmokeDeckStructurePlan(requestBody));
    }

    if (schemaName === "deck_visual_theme") {
      return createLmStudioStreamResponse(createSmokeTheme());
    }

    return originalFetch(url, init);
  };
}

function restoreSmokeLlmMock(): void {
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
}

export {
  createdSmokePresentationIdPattern,
  installSmokeLlmMock,
  isSmokePresentationId,
  restoreSmokeLlmMock,
  smokePresentation
};
