type JsonSchema = {
  $schema?: string;
  additionalProperties?: boolean | JsonSchema;
  const?: unknown;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  maxItems?: number;
  minItems?: number;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: "array" | "boolean" | "null" | "number" | "object" | "string";
};

type JsonRecord = Record<string, unknown>;

type SchemaValidationIssue = {
  message: string;
  path: string;
};

type SchemaValidationResult = {
  issues: SchemaValidationIssue[];
  valid: boolean;
};

type SlideSpecSchemaOptions = {
  includeStorageFields?: boolean;
};

const allowedSlideLayouts = ["agenda", "bullets", "chapter", "checklist", "identity", "proof", "spotlight", "standard", "statement", "steps"];
const allowedCoverIntents = ["agenda", "chapter", "identity", "proof", "statement"];
const allowedCompositionArchetypes = ["agenda", "bullets", "chapter", "checklist", "compare", "evidence-stack", "identity", "image-split", "proof", "quote-pull", "spotlight", "standard", "statement", "steps"];
const allowedNarrationAdvanceModes = ["afterSpeech", "manual"];
const slideTypes = ["cover", "toc", "content", "summary", "divider", "quote", "photo", "photoGrid"];

function stringSchema(): JsonSchema {
  return { type: "string" };
}

function numberSchema(): JsonSchema {
  return { type: "number" };
}

function booleanSchema(): JsonSchema {
  return { type: "boolean" };
}

function openObjectSchema(): JsonSchema {
  return {
    additionalProperties: true,
    type: "object"
  };
}

function createCardSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      body: stringSchema(),
      id: stringSchema(),
      title: stringSchema()
    },
    required: ["id", "title", "body"],
    type: "object"
  };
}

function createTextItemSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      body: stringSchema(),
      id: stringSchema(),
      title: stringSchema()
    },
    required: ["id", "title", "body"],
    type: "object"
  };
}

function createLabeledValueItemSchema(valueSchema: JsonSchema): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      id: stringSchema(),
      label: stringSchema(),
      value: valueSchema
    },
    required: ["id", "label", "value"],
    type: "object"
  };
}

function createSignalSchema(): JsonSchema {
  return {
    oneOf: [
      createTextItemSchema(),
      createLabeledValueItemSchema(numberSchema())
    ]
  };
}

function createGuardrailSchema(): JsonSchema {
  return {
    oneOf: [
      createTextItemSchema(),
      createLabeledValueItemSchema(stringSchema())
    ]
  };
}

function createResourceSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      body: stringSchema(),
      bodyFontSize: numberSchema(),
      id: stringSchema(),
      title: stringSchema()
    },
    required: ["id", "title", "body"],
    type: "object"
  };
}

function createMediaSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      alt: stringSchema(),
      caption: stringSchema(),
      fit: stringSchema(),
      focalPoint: stringSchema(),
      id: stringSchema(),
      materialId: stringSchema(),
      source: stringSchema(),
      src: stringSchema(),
      title: stringSchema()
    },
    required: ["id", "src", "alt"],
    type: "object"
  };
}

function createCompositionIntentSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      archetype: {
        enum: allowedCompositionArchetypes,
        type: "string"
      },
      focalPoint: stringSchema(),
      rationale: stringSchema()
    },
    required: ["archetype", "focalPoint", "rationale"],
    type: "object"
  };
}

function createNarrationSchema(): JsonSchema {
  return {
    additionalProperties: false,
    description: "Reviewable presenter narration. Use natural spoken language, one clear idea, and a short implication or transition. Do not read the slide verbatim or include hidden authoring notes.",
    properties: {
      advance: {
        description: "Use afterSpeech when presentation mode may advance automatically after speaking this script; use manual when the presenter should control the transition.",
        enum: allowedNarrationAdvanceModes,
        type: "string"
      },
      durationSeconds: {
        ...numberSchema(),
        description: "Estimated spoken duration in seconds at a calm presentation pace."
      },
      script: {
        ...stringSchema(),
        description: "Concise spoken presenter copy in the slide language. Add context or a bridge instead of repeating visible slide text."
      }
    },
    required: ["script"],
    type: "object"
  };
}

function nullableSchema(schema: JsonSchema): JsonSchema {
  return {
    oneOf: [
      schema,
      { type: "null" }
    ]
  };
}

function createCommonProperties(options: SlideSpecSchemaOptions): Record<string, JsonSchema> {
  const properties: Record<string, JsonSchema> = {
    attribution: stringSchema(),
    caption: stringSchema(),
    context: stringSchema(),
    customVisual: openObjectSchema(),
    compositionIntent: createCompositionIntentSchema(),
    layout: {
      enum: allowedSlideLayouts,
      type: "string"
    },
    layoutDefinition: openObjectSchema(),
    logo: stringSchema(),
    media: nullableSchema(createMediaSchema()),
    mediaItems: nullableSchema({
      items: createMediaSchema(),
      type: "array"
    }),
    narration: createNarrationSchema(),
    source: stringSchema(),
    title: stringSchema(),
    type: {
      enum: slideTypes,
      type: "string"
    }
  };

  if (options.includeStorageFields === true) {
    properties.archived = booleanSchema();
    properties.index = numberSchema();
    properties.skipMeta = openObjectSchema();
    properties.skipped = booleanSchema();
    properties.skipReason = stringSchema();
  }

  return properties;
}

function withCommonProperties(
  options: SlideSpecSchemaOptions,
  properties: Record<string, JsonSchema>,
  required: string[]
): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      ...createCommonProperties(options),
      ...properties
    },
    required,
    type: "object"
  };
}

function createDividerSlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        title: stringSchema(),
        type: { const: "divider", type: "string" }
  }, ["type", "title"]);
}

function createQuoteSlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        attribution: stringSchema(),
        context: stringSchema(),
        quote: stringSchema(),
        source: stringSchema(),
        title: stringSchema(),
        type: { const: "quote", type: "string" }
  }, ["type", "title", "quote"]);
}

function createPhotoSlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        caption: stringSchema(),
        media: createMediaSchema(),
        title: stringSchema(),
        type: { const: "photo", type: "string" }
  }, ["type", "title", "media"]);
}

function createPhotoGridSlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        caption: stringSchema(),
        mediaItems: {
          items: createMediaSchema(),
          maxItems: 3,
          minItems: 2,
          type: "array"
        },
        summary: stringSchema(),
        title: stringSchema(),
        type: { const: "photoGrid", type: "string" }
  }, ["type", "title", "mediaItems"]);
}

function createCoverSlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        cards: {
          items: createCardSchema(),
          maxItems: 3,
          minItems: 0,
          type: "array"
        },
        coverIntent: {
          enum: allowedCoverIntents,
          type: "string"
        },
        eyebrow: stringSchema(),
        note: stringSchema(),
        summary: stringSchema(),
        title: stringSchema(),
        type: { const: "cover", type: "string" }
  }, ["type", "title", "summary"]);
}

function createTocSlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        cards: {
          items: createCardSchema(),
          maxItems: 3,
          minItems: 3,
          type: "array"
        },
        eyebrow: stringSchema(),
        note: stringSchema(),
        summary: stringSchema(),
        title: stringSchema(),
        type: { const: "toc", type: "string" }
  }, ["type", "title", "summary", "note", "cards"]);
}

function createContentSlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        eyebrow: stringSchema(),
        guardrails: {
          items: createGuardrailSchema(),
          maxItems: 3,
          minItems: 3,
          type: "array"
        },
        guardrailsTitle: stringSchema(),
        signals: {
          items: createSignalSchema(),
          maxItems: 3,
          minItems: 3,
          type: "array"
        },
        signalsTitle: stringSchema(),
        summary: stringSchema(),
        title: stringSchema(),
        type: { const: "content", type: "string" }
  }, ["type", "title", "summary", "signalsTitle", "guardrailsTitle", "signals", "guardrails"]);
}

function createSummarySlideSchema(options: SlideSpecSchemaOptions): JsonSchema {
  return withCommonProperties(options, {
        bullets: {
          items: createCardSchema(),
          maxItems: 3,
          minItems: 3,
          type: "array"
        },
        eyebrow: stringSchema(),
        resources: {
          items: createResourceSchema(),
          maxItems: 2,
          minItems: 2,
          type: "array"
        },
        resourcesTitle: stringSchema(),
        summary: stringSchema(),
        title: stringSchema(),
        type: { const: "summary", type: "string" }
  }, ["type", "title", "summary", "resourcesTitle", "bullets", "resources"]);
}

function createTypedSlideSchema(type: string, options: SlideSpecSchemaOptions): JsonSchema {
  switch (type) {
    case "divider":
      return createDividerSlideSchema(options);
    case "quote":
      return createQuoteSlideSchema(options);
    case "photo":
      return createPhotoSlideSchema(options);
    case "photoGrid":
      return createPhotoGridSlideSchema(options);
    case "cover":
      return createCoverSlideSchema(options);
    case "toc":
      return createTocSlideSchema(options);
    case "content":
      return createContentSlideSchema(options);
    case "summary":
      return createSummarySlideSchema(options);
    default:
      throw new Error(`Unsupported slide type "${type}" for slide JSON schema`);
  }
}

function getSlideSpecJsonSchema(slideType?: string, options: SlideSpecSchemaOptions = {}): JsonSchema {
  if (slideType) {
    return createTypedSlideSchema(slideType, options);
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    oneOf: slideTypes.map((type) => createTypedSlideSchema(type, options))
  };
}

function valueType(value: unknown): JsonSchema["type"] {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value as JsonSchema["type"];
}

function formatPath(path: string): string {
  return path || "slideSpec";
}

function validateOneOfSchema(value: unknown, schema: JsonSchema, path: string): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];
  const candidateResults = (schema.oneOf || []).map((candidate) => ({
    issues: validateAgainstSchema(value, candidate, path),
    schema: candidate
  }));
  const matchingSchemas = candidateResults.filter((candidate) => candidate.issues.length === 0);

  if (matchingSchemas.length !== 1) {
    const matchingTypeResults = candidateResults.filter((candidate) => {
      return candidate.schema.type === undefined || candidate.schema.type === valueType(value);
    });
    const closestResult = matchingTypeResults[0];
    if (matchingSchemas.length === 0 && matchingTypeResults.length === 1 && closestResult) {
      issues.push(...closestResult.issues);
      return issues;
    }
    issues.push({
      message: `must match exactly one slide type schema; matched ${matchingSchemas.length}`,
      path: formatPath(path)
    });
  }

  return issues;
}

function validateLiteralSchema(value: unknown, schema: JsonSchema, path: string): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];

  if (schema.const !== undefined && value !== schema.const) {
    issues.push({
      message: `must be ${JSON.stringify(schema.const)}`,
      path: formatPath(path)
    });
    return issues;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    issues.push({
      message: `must be one of: ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}`,
      path: formatPath(path)
    });
    return issues;
  }

  if (schema.type && valueType(value) !== schema.type) {
    issues.push({
      message: `must be a ${schema.type}`,
      path: formatPath(path)
    });
    return issues;
  }

  return issues;
}

function validateObjectSchema(value: unknown, schema: JsonSchema, path: string): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];

  if (schema.type === "object") {
    const record = value as JsonRecord;
    const properties = schema.properties || {};
    const required = schema.required || [];

    required.forEach((key) => {
      if (!(key in record)) {
        issues.push({
          message: "is required",
          path: `${formatPath(path)}.${key}`
        });
      }
    });

    if (schema.additionalProperties === false) {
      Object.keys(record).forEach((key) => {
        if (!(key in properties)) {
          issues.push({
            message: "is not allowed",
            path: `${formatPath(path)}.${key}`
          });
        }
      });
    }

    Object.entries(properties).forEach(([key, childSchema]) => {
      if (record[key] !== undefined) {
        issues.push(...validateAgainstSchema(record[key], childSchema, `${formatPath(path)}.${key}`));
      }
    });
  }

  return issues;
}

function validateArraySchema(value: unknown, schema: JsonSchema, path: string): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];

  if (schema.type === "array") {
    const items = value as unknown[];
    if (typeof schema.minItems === "number" && items.length < schema.minItems) {
      issues.push({
        message: `must contain at least ${schema.minItems} items`,
        path: formatPath(path)
      });
    }
    if (typeof schema.maxItems === "number" && items.length > schema.maxItems) {
      issues.push({
        message: `must contain at most ${schema.maxItems} items`,
        path: formatPath(path)
      });
    }
    if (schema.items) {
      items.forEach((item, index) => {
        issues.push(...validateAgainstSchema(item, schema.items as JsonSchema, `${formatPath(path)}[${index}]`));
      });
    }
  }

  return issues;
}

function validateAgainstSchema(value: unknown, schema: JsonSchema, path = "slideSpec"): SchemaValidationIssue[] {
  if (schema.oneOf) {
    return validateOneOfSchema(value, schema, path);
  }

  const literalIssues = validateLiteralSchema(value, schema, path);
  if (literalIssues.length) {
    return literalIssues;
  }

  return [
    ...validateObjectSchema(value, schema, path),
    ...validateArraySchema(value, schema, path)
  ];
}

function validateSlideJsonWithSchema(value: unknown, label = "slideSpec"): SchemaValidationResult {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
  const slideType = typeof record?.type === "string" && slideTypes.includes(record.type)
    ? record.type
    : undefined;
  const schema = getSlideSpecJsonSchema(slideType, { includeStorageFields: true });
  const issues = validateAgainstSchema(value, schema, label);

  return {
    issues,
    valid: issues.length === 0
  };
}

function assertSlideJsonMatchesSchema(value: unknown, label = "slideSpec"): void {
  const result = validateSlideJsonWithSchema(value, label);
  if (!result.valid) {
    const detail = result.issues
      .slice(0, 8)
      .map((issue) => `${issue.path} ${issue.message}`)
      .join("; ");
    throw new Error(`${label} does not match the slide JSON schema: ${detail}`);
  }
}

export {
  assertSlideJsonMatchesSchema,
  getSlideSpecJsonSchema,
  validateSlideJsonWithSchema
};
