type JsonSchema = Record<string, unknown>;

function createBaseVariantSchema(slideSpecSchema: JsonSchema): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      changeSummary: {
        items: {
          maxLength: 120,
          type: "string"
        },
        maxItems: 3,
        minItems: 2,
        type: "array"
      },
      label: {
        maxLength: 48,
        type: "string"
      },
      notes: {
        maxLength: 160,
        type: "string"
      },
      promptSummary: {
        maxLength: 160,
        type: "string"
      },
      slideSpec: slideSpecSchema
    },
    required: ["label", "promptSummary", "notes", "changeSummary", "slideSpec"],
    type: "object"
  };
}

function createRedoLayoutIntentSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      droppedFields: {
        items: {
          type: "string"
        },
        maxItems: 12,
        type: "array"
      },
      label: {
        maxLength: 48,
        type: "string"
      },
      targetFamily: {
        enum: ["cover", "toc", "content", "summary", "divider", "quote", "photo", "photoGrid"],
        type: "string"
      },
      emphasis: {
        maxLength: 120,
        type: "string"
      },
      preservedFields: {
        items: {
          type: "string"
        },
        maxItems: 12,
        minItems: 1,
        type: "array"
      },
      rationale: {
        maxLength: 160,
        type: "string"
      }
    },
    required: ["targetFamily", "label", "rationale", "preservedFields", "droppedFields", "emphasis"],
    type: "object"
  };
}

function createThemeTokenSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      accent: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      bg: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      fontFamily: { enum: ["avenir", "editorial", "workshop", "mono"], type: "string" },
      light: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      muted: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      panel: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      primary: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      progressFill: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      progressTrack: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      secondary: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" },
      surface: { pattern: "^#?[0-9a-fA-F]{6}$", type: "string" }
    },
    required: ["primary", "secondary", "accent", "muted", "light", "bg", "panel", "surface", "progressTrack", "progressFill", "fontFamily"],
    type: "object"
  };
}

function createThemeCandidateSchema(slideSpecSchema: JsonSchema): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      changeSummary: {
        items: {
          maxLength: 120,
          type: "string"
        },
        maxItems: 3,
        minItems: 2,
        type: "array"
      },
      contextPatch: {
        additionalProperties: false,
        properties: {
          rationale: { maxLength: 160, type: "string" },
          themeBrief: { maxLength: 220, type: "string" },
          tone: { maxLength: 120, type: "string" }
        },
        type: "object"
      },
      label: {
        maxLength: 48,
        type: "string"
      },
      notes: {
        maxLength: 160,
        type: "string"
      },
      promptSummary: {
        maxLength: 160,
        type: "string"
      },
      slideSpec: slideSpecSchema,
      visualTheme: createThemeTokenSchema()
    },
    required: ["label", "promptSummary", "notes", "changeSummary", "slideSpec", "visualTheme"],
    type: "object"
  };
}

function createDeckContextPatchSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      constraints: { maxLength: 260, type: "string" },
      objective: { maxLength: 220, type: "string" },
      subject: { maxLength: 160, type: "string" },
      themeBrief: { maxLength: 220, type: "string" },
      tone: { maxLength: 120, type: "string" },
      visualTheme: createThemeTokenSchema()
    },
    type: "object"
  };
}

function createDeckStructureSlideIntentSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      action: {
        enum: ["keep", "skip", "restore", "insert", "replace", "retitle", "move", "move-and-retitle", "move-and-replace", "retitle-and-replace", "move-retitle-and-replace"],
        type: "string"
      },
      currentIndex: { type: "number" },
      currentTitle: { maxLength: 120, type: "string" },
      grounding: {
        items: {
          maxLength: 160,
          type: "string"
        },
        maxItems: 4,
        type: "array"
      },
      proposedIndex: { type: "number" },
      proposedTitle: { maxLength: 120, type: "string" },
      rationale: { maxLength: 180, type: "string" },
      role: { maxLength: 80, type: "string" },
      slideId: { type: "string" },
      summary: { maxLength: 180, type: "string" },
      type: {
        enum: ["cover", "toc", "content", "summary", "divider", "quote", "photo", "photoGrid"],
        type: "string"
      }
    },
    required: ["action", "proposedTitle", "rationale", "role", "summary", "type", "grounding"],
    type: "object"
  };
}

function createDeckStructureCandidateSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      changeLead: { maxLength: 180, type: "string" },
      deckPatch: createDeckContextPatchSchema(),
      label: { maxLength: 64, type: "string" },
      notes: { maxLength: 180, type: "string" },
      promptSummary: { maxLength: 180, type: "string" },
      slides: {
        items: createDeckStructureSlideIntentSchema(),
        maxItems: 40,
        minItems: 1,
        type: "array"
      },
      summary: { maxLength: 220, type: "string" }
    },
    required: ["label", "summary", "notes", "promptSummary", "changeLead", "slides"],
    type: "object"
  };
}

function createCardSchema(): JsonSchema {
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

function createSignalSchema(): JsonSchema {
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

function createGuardrailSchema(): JsonSchema {
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

function createResourceSchema(): JsonSchema {
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

function createLayoutSchema(): JsonSchema {
  return {
    enum: ["agenda", "bullets", "chapter", "checklist", "identity", "proof", "spotlight", "standard", "statement", "steps"],
    type: "string"
  };
}

function createCoverIntentSchema(): JsonSchema {
  return {
    enum: ["agenda", "chapter", "identity", "proof", "statement"],
    type: "string"
  };
}

function createCompositionIntentSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      archetype: {
        enum: ["agenda", "bullets", "chapter", "checklist", "compare", "evidence-stack", "identity", "image-split", "proof", "quote-pull", "spotlight", "standard", "statement", "steps"],
        type: "string"
      },
      focalPoint: { type: "string" },
      rationale: { type: "string" }
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
        enum: ["afterSpeech", "manual"],
        type: "string"
      },
      durationSeconds: {
        description: "Estimated spoken duration in seconds at a calm presentation pace.",
        type: "number"
      },
      script: {
        description: "Concise spoken presenter copy in the slide language. Add context or a bridge instead of repeating visible slide text.",
        type: "string"
      }
    },
    required: ["script"],
    type: "object"
  };
}

function getNarrationRefinementResponseSchema(): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      advance: {
        enum: ["afterSpeech", "manual"],
        type: "string"
      },
      durationSeconds: {
        maximum: 180,
        minimum: 8,
        type: "number"
      },
      rationale: {
        maxLength: 180,
        type: "string"
      },
      script: {
        maxLength: 1400,
        minLength: 40,
        type: "string"
      }
    },
    required: ["script", "durationSeconds", "advance", "rationale"],
    type: "object"
  };
}

function createMediaSchema(): JsonSchema {
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

function createMediaItemsSchema(): JsonSchema {
  return {
    items: createMediaSchema(),
    type: "array"
  };
}

function createDividerSlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          compositionIntent: createCompositionIntentSchema(),
          narration: createNarrationSchema(),
          title: { type: "string" },
          type: { const: "divider", type: "string" }
        },
        required: ["type", "title", "compositionIntent"],
        type: "object"
  };
}

function createQuoteSlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          attribution: { type: "string" },
          compositionIntent: createCompositionIntentSchema(),
          context: { type: "string" },
          narration: createNarrationSchema(),
          quote: { type: "string" },
          source: { type: "string" },
          title: { type: "string" },
          type: { const: "quote", type: "string" }
        },
        required: ["type", "title", "quote", "compositionIntent"],
        type: "object"
  };
}

function createPhotoSlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          caption: { type: "string" },
          compositionIntent: createCompositionIntentSchema(),
          narration: createNarrationSchema(),
          media: createMediaSchema(),
          mediaItems: createMediaItemsSchema(),
          title: { type: "string" },
          type: { const: "photo", type: "string" }
        },
        required: ["type", "title", "compositionIntent"],
        type: "object"
  };
}

function createPhotoGridSlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          caption: { type: "string" },
          compositionIntent: createCompositionIntentSchema(),
          narration: createNarrationSchema(),
          mediaItems: {
            items: createMediaSchema(),
            maxItems: 3,
            minItems: 2,
            type: "array"
          },
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "photoGrid", type: "string" }
        },
        required: ["type", "title", "mediaItems", "compositionIntent"],
        type: "object"
  };
}

function createCoverSlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          cards: {
            items: createCardSchema(),
            maxItems: 3,
            minItems: 0,
            type: "array"
          },
          compositionIntent: createCompositionIntentSchema(),
          coverIntent: createCoverIntentSchema(),
          eyebrow: { type: "string" },
          layout: createLayoutSchema(),
          logo: { type: "string" },
          mediaItems: createMediaItemsSchema(),
          note: { type: "string" },
          narration: createNarrationSchema(),
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "cover", type: "string" }
        },
        required: ["type", "title", "summary", "compositionIntent"],
        type: "object"
  };
}

function createTocSlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          cards: {
            items: createCardSchema(),
            maxItems: 3,
            minItems: 3,
            type: "array"
          },
          compositionIntent: createCompositionIntentSchema(),
          eyebrow: { type: "string" },
          layout: createLayoutSchema(),
          mediaItems: createMediaItemsSchema(),
          note: { type: "string" },
          narration: createNarrationSchema(),
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "toc", type: "string" }
        },
        required: ["type", "title", "summary", "note", "cards", "compositionIntent"],
        type: "object"
  };
}

function createContentSlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          compositionIntent: createCompositionIntentSchema(),
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
          narration: createNarrationSchema(),
          signals: {
            items: createSignalSchema(),
            maxItems: 3,
            minItems: 3,
            type: "array"
          },
          signalsTitle: { type: "string" },
          summary: { type: "string" },
          title: { type: "string" },
          type: { const: "content", type: "string" }
        },
        required: ["type", "title", "summary", "signalsTitle", "guardrailsTitle", "signals", "guardrails", "compositionIntent"],
        type: "object"
  };
}

function createSummarySlideSpecSchema(): JsonSchema {
  return {
        additionalProperties: false,
        properties: {
          bullets: {
            items: createCardSchema(),
            maxItems: 3,
            minItems: 3,
            type: "array"
          },
          compositionIntent: createCompositionIntentSchema(),
          eyebrow: { type: "string" },
          layout: createLayoutSchema(),
          mediaItems: createMediaItemsSchema(),
          narration: createNarrationSchema(),
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
        required: ["type", "title", "summary", "resourcesTitle", "bullets", "resources", "compositionIntent"],
        type: "object"
  };
}

function getSlideSpecSchema(slideType: string): JsonSchema {
  switch (slideType) {
    case "divider":
      return createDividerSlideSpecSchema();
    case "quote":
      return createQuoteSlideSpecSchema();
    case "photo":
      return createPhotoSlideSpecSchema();
    case "photoGrid":
      return createPhotoGridSlideSpecSchema();
    case "cover":
      return createCoverSlideSpecSchema();
    case "toc":
      return createTocSlideSpecSchema();
    case "content":
      return createContentSlideSpecSchema();
    case "summary":
      return createSummarySlideSpecSchema();
    default:
      throw new Error(`Unsupported slide type "${slideType}" for LLM schema generation`);
  }
}

function getIdeateSlideResponseSchema(slideType: string, candidateCount = 3): JsonSchema {
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

function getRedoLayoutResponseSchema(candidateCount = 3): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      candidates: {
        items: createRedoLayoutIntentSchema(),
        maxItems: candidateCount,
        minItems: candidateCount,
        type: "array"
      }
    },
    required: ["candidates"],
    type: "object"
  };
}

function getThemeResponseSchema(slideType: string, candidateCount = 3): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      candidates: {
        items: createThemeCandidateSchema(getSlideSpecSchema(slideType)),
        maxItems: candidateCount,
        minItems: candidateCount,
        type: "array"
      }
    },
    required: ["candidates"],
    type: "object"
  };
}

function getDeckStructureResponseSchema(candidateCount = 3): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      candidates: {
        items: createDeckStructureCandidateSchema(),
        maxItems: candidateCount,
        minItems: candidateCount,
        type: "array"
      }
    },
    required: ["candidates"],
    type: "object"
  };
}

export {
  getDeckStructureResponseSchema,
  getIdeateSlideResponseSchema,
  getNarrationRefinementResponseSchema,
  getRedoLayoutResponseSchema,
  getThemeResponseSchema
};
