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
    enum: ["callout", "checklist", "focus", "standard", "steps", "strip"],
    type: "string"
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

function getSlideSpecSchema(slideType: string): JsonSchema {
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
            maxItems: 3,
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
          logo: { type: "string" },
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
  getRedoLayoutResponseSchema,
  getThemeResponseSchema
};
