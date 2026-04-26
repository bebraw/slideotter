function createBaseVariantSchema(slideSpecSchema) {
  return {
    additionalProperties: false,
    properties: {
      changeSummary: {
        items: {
          type: "string"
        },
        maxItems: 4,
        minItems: 2,
        type: "array"
      },
      label: {
        type: "string"
      },
      notes: {
        type: "string"
      },
      promptSummary: {
        type: "string"
      },
      slideSpec: slideSpecSchema
    },
    required: ["label", "promptSummary", "notes", "changeSummary", "slideSpec"],
    type: "object"
  };
}

function createCardSchema() {
  return {
    additionalProperties: false,
    properties: {
      body: { type: "string" },
      id: { type: "string" },
      title: { type: "string" }
    },
    required: ["id", "title", "body"],
    type: "object"
  };
}

function createSignalSchema() {
  return {
    additionalProperties: false,
    properties: {
      body: { type: "string" },
      id: { type: "string" },
      title: { type: "string" }
    },
    required: ["id", "title", "body"],
    type: "object"
  };
}

function createGuardrailSchema() {
  return {
    additionalProperties: false,
    properties: {
      body: { type: "string" },
      id: { type: "string" },
      title: { type: "string" }
    },
    required: ["id", "title", "body"],
    type: "object"
  };
}

function createResourceSchema() {
  return {
    additionalProperties: false,
    properties: {
      body: { type: "string" },
      bodyFontSize: { type: "number" },
      id: { type: "string" },
      title: { type: "string" }
    },
    required: ["id", "title", "body", "bodyFontSize"],
    type: "object"
  };
}

function createLayoutSchema() {
  return {
    enum: ["callout", "checklist", "focus", "standard", "steps", "strip"],
    type: "string"
  };
}

function createMediaSchema() {
  return {
    additionalProperties: false,
    properties: {
      alt: { type: "string" },
      caption: { type: "string" },
      id: { type: "string" },
      materialId: { type: "string" },
      source: { type: "string" },
      src: { type: "string" },
      title: { type: "string" }
    },
    required: ["id", "src", "alt"],
    type: "object"
  };
}

function createMediaItemsSchema() {
  return {
    items: createMediaSchema(),
    type: "array"
  };
}

function getSlideSpecSchema(slideType) {
  switch (slideType) {
    case "divider":
      return {
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          type: { const: "divider", type: "string" }
        },
        required: ["type", "title"],
        type: "object"
      };
    case "quote":
      return {
        additionalProperties: false,
        properties: {
          attribution: { type: "string" },
          context: { type: "string" },
          quote: { type: "string" },
          source: { type: "string" },
          title: { type: "string" },
          type: { const: "quote", type: "string" }
        },
        required: ["type", "title", "quote"],
        type: "object"
      };
    case "photo":
      return {
        additionalProperties: false,
        properties: {
          caption: { type: "string" },
          media: createMediaSchema(),
          mediaItems: createMediaItemsSchema(),
          title: { type: "string" },
          type: { const: "photo", type: "string" }
        },
        required: ["type", "title"],
        type: "object"
      };
    case "photoGrid":
      return {
        additionalProperties: false,
        properties: {
          caption: { type: "string" },
          mediaItems: {
            items: createMediaSchema(),
            maxItems: 4,
            minItems: 2,
            type: "array"
          },
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "photoGrid", type: "string" }
        },
        required: ["type", "title", "mediaItems"],
        type: "object"
      };
    case "cover":
      return {
        additionalProperties: false,
        properties: {
          cards: {
            items: createCardSchema(),
            maxItems: 3,
            minItems: 3,
            type: "array"
          },
          eyebrow: { type: "string" },
          layout: createLayoutSchema(),
          mediaItems: createMediaItemsSchema(),
          note: { type: "string" },
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "cover", type: "string" }
        },
        required: ["type", "title", "eyebrow", "summary", "note", "cards"],
        type: "object"
      };
    case "toc":
      return {
        additionalProperties: false,
        properties: {
          cards: {
            items: createCardSchema(),
            maxItems: 3,
            minItems: 3,
            type: "array"
          },
          eyebrow: { type: "string" },
          layout: createLayoutSchema(),
          mediaItems: createMediaItemsSchema(),
          note: { type: "string" },
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "toc", type: "string" }
        },
        required: ["type", "title", "eyebrow", "summary", "note", "cards"],
        type: "object"
      };
    case "content":
      return {
        additionalProperties: false,
        properties: {
          eyebrow: { type: "string" },
          guardrails: {
            items: createGuardrailSchema(),
            maxItems: 3,
            minItems: 3,
            type: "array"
          },
          guardrailsTitle: { type: "string" },
          layout: createLayoutSchema(),
          mediaItems: createMediaItemsSchema(),
          signals: {
            items: createSignalSchema(),
            maxItems: 4,
            minItems: 4,
            type: "array"
          },
          signalsTitle: { type: "string" },
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "content", type: "string" }
        },
        required: ["type", "title", "eyebrow", "summary", "signalsTitle", "guardrailsTitle", "signals", "guardrails"],
        type: "object"
      };
    case "summary":
      return {
        additionalProperties: false,
        properties: {
          bullets: {
            items: createCardSchema(),
            maxItems: 3,
            minItems: 3,
            type: "array"
          },
          eyebrow: { type: "string" },
          layout: createLayoutSchema(),
          mediaItems: createMediaItemsSchema(),
          resources: {
            items: createResourceSchema(),
            maxItems: 2,
            minItems: 2,
            type: "array"
          },
          resourcesTitle: { type: "string" },
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "summary", type: "string" }
        },
        required: ["type", "title", "eyebrow", "summary", "resourcesTitle", "bullets", "resources"],
        type: "object"
      };
    default:
      throw new Error(`Unsupported slide type "${slideType}" for LLM schema generation`);
  }
}

function getIdeateSlideResponseSchema(slideType, candidateCount = 3) {
  return {
    additionalProperties: false,
    properties: {
      variants: {
        items: createBaseVariantSchema(getSlideSpecSchema(slideType)),
        maxItems: candidateCount,
        minItems: candidateCount,
        type: "array"
      }
    },
    required: ["variants"],
    type: "object"
  };
}

module.exports = {
  getIdeateSlideResponseSchema
};
