import { supportedPlanRoles, supportedSlideTypes } from "./generated-plan-repair.ts";

type JsonObject = Record<string, unknown>;
type JsonSchema = JsonObject;

type StructuredPromptRequest = {
  developerPrompt: string;
  maxOutputTokens?: number;
  promptContext?: unknown;
  schema: unknown;
  schemaName: string;
  userPrompt: string;
};

type DeckPlanPromptContext = {
  compactJson: (value: unknown) => string;
  fields: JsonObject;
  lockedOutlineSlides?: unknown[];
  materialPromptText?: unknown;
  slideCount: number;
  sourcePromptText?: unknown;
  suppliedUrls?: string[];
};

type DeckPlanRepairPromptContext = {
  compactJson: (value: unknown) => string;
  fields: JsonObject;
  issues: string[];
  normalizedPlan: unknown;
  slideCount: number;
};

type SlideTarget = JsonObject & {
  intent?: unknown;
  keyMessage?: unknown;
  role?: unknown;
  slideCount?: unknown;
  slideNumber?: unknown;
  title?: unknown;
  type?: unknown;
};

type SlidePlanPromptContext = {
  compactJson: (value: unknown) => string;
  deckPlan: unknown;
  fields: JsonObject;
  materialPromptText?: unknown;
  singleSlideContext?: unknown;
  slideCount: number;
  slideTarget?: SlideTarget | null;
  sourcePromptText?: unknown;
  suppliedUrls?: string[];
};

function createPlanSchema(slideCount: number): JsonSchema {
  const pointSchema = {
    additionalProperties: false,
    properties: {
      body: { type: "string" },
      title: { type: "string" }
    },
    required: ["title", "body"],
    type: "object"
  };

  return {
    additionalProperties: false,
    properties: {
      outline: { type: "string" },
      references: {
        items: {
          additionalProperties: false,
          properties: {
            note: { type: "string" },
            title: { type: "string" },
            url: { type: "string" }
          },
          required: ["title", "url", "note"],
          type: "object"
        },
        maxItems: 4,
        type: "array"
      },
      slides: {
        items: {
          additionalProperties: false,
          properties: {
            keyPoints: {
              items: pointSchema,
              maxItems: 4,
              minItems: 4,
              type: "array"
            },
            eyebrow: { type: "string" },
            guardrails: {
              items: pointSchema,
              maxItems: 3,
              minItems: 3,
              type: "array"
            },
            guardrailsTitle: { type: "string" },
            mediaMaterialId: { type: "string" },
            note: { type: "string" },
            resources: {
              items: pointSchema,
              maxItems: 2,
              minItems: 2,
              type: "array"
            },
            resourcesTitle: { type: "string" },
            role: {
              enum: supportedPlanRoles,
              type: "string"
            },
            signalsTitle: { type: "string" },
            summary: { type: "string" },
            title: { type: "string" },
            type: {
              enum: supportedSlideTypes,
              type: "string"
            }
          },
          required: [
            "title",
            "type",
            "role",
            "eyebrow",
            "summary",
            "note",
            "signalsTitle",
            "keyPoints",
            "guardrailsTitle",
            "guardrails",
            "resourcesTitle",
            "resources",
            "mediaMaterialId"
          ],
          type: "object"
        },
        maxItems: slideCount,
        minItems: slideCount,
        type: "array"
      },
      summary: { type: "string" }
    },
    required: ["summary", "outline", "references", "slides"],
    type: "object"
  };
}

function createDeckPlanSchema(slideCount: number): JsonSchema {
  return {
    additionalProperties: false,
    properties: {
      audience: { type: "string" },
      language: { type: "string" },
      narrativeArc: { type: "string" },
      outline: { type: "string" },
      slides: {
        items: {
          additionalProperties: false,
          properties: {
            intent: { type: "string" },
            keyMessage: { type: "string" },
            role: {
              enum: supportedPlanRoles,
              type: "string"
            },
            sourceNeed: { type: "string" },
            title: { type: "string" },
            type: {
              enum: supportedSlideTypes,
              type: "string"
            },
            visualNeed: { type: "string" }
          },
          required: ["title", "role", "intent", "keyMessage", "sourceNeed", "visualNeed", "type"],
          type: "object"
        },
        maxItems: slideCount,
        minItems: slideCount,
        type: "array"
      },
      thesis: { type: "string" }
    },
    required: ["language", "audience", "thesis", "narrativeArc", "outline", "slides"],
    type: "object"
  };
}

function sourcingInstruction(style: unknown): string {
  if (style === "none") {
    return "Do not add visible source references unless the user explicitly provided a source URL that is essential.";
  }
  if (style === "inline-notes") {
    return "When source material matters, mention source context briefly in slide notes or resource text without adding long citations to body copy.";
  }

  return "Prefer compact numbered references: keep slide copy concise, use short reference markers only when useful, and place reference details in final resources.";
}

function buildSlidePlanPromptRequest(context: SlidePlanPromptContext): StructuredPromptRequest {
  const { compactJson, deckPlan, fields, materialPromptText, singleSlideContext, slideCount, slideTarget, sourcePromptText, suppliedUrls = [] } = context;

  return {
    developerPrompt: [
      "You turn an approved presentation outline into complete structured slide content for a local deck studio.",
      "Return JSON only and stay within the provided schema.",
      "Use the language requested or implied by the brief for every user-visible field.",
      "Do not translate a non-English brief into English unless the user explicitly asks for English.",
      "Every slide must provide its own visible labels: eyebrow, note, signalsTitle, guardrailsTitle, resourcesTitle, keyPoints, guardrails, and resources.",
      "Every key point must have a specific short title and a concrete body sentence.",
      "Every guardrail and resource must have a specific short title and a concrete body sentence in the deck language.",
      "Keep key point and guardrail bodies especially short because generated content slides show several compact cards.",
      "Follow the approved deck plan slide by slide. Do not change the slide count or repeat the same slide intent.",
      "Preserve the approved slide type for each slide. If the approved type is photoGrid, keep type photoGrid and choose image material ids that support a two-to-three image grid.",
      "If an approved slide role is divider, draft it as a title-only section boundary in the final slide output. Keep the title especially short and use the other schema fields only as planning support.",
      "Do not use placeholders, dummy metrics, markdown fences, or generic filler.",
      "Do not write internal role instructions such as use this slide as the opening frame.",
      "Do not use ellipses. Finish each visible sentence cleanly.",
      "Do not use field labels such as title, summary, body, key point, or role as visible slide text.",
      "Do not invent academic papers, authors, journals, publication years, citations, or source URLs.",
      "Use retrieved source snippets as grounded material when they are provided.",
      "If an approved deck plan slide includes sourceNotes, treat those notes as slide-specific evidence and do not move that evidence to unrelated slides.",
      "Use available image materials only when they clearly fit the slide topic.",
      "Set mediaMaterialId to the chosen material id for a slide, or to an empty string when no image should be attached.",
      "Only include references whose URLs were supplied by the user or retrieved source snippets. If none were supplied, return an empty references array.",
      sourcingInstruction(fields.sourcingStyle),
      "When choosing or describing visual treatment, preserve WCAG AA contrast: normal text at least 4.5:1, large display text at least 3:1, and non-text progress indicators distinguishable from their tracks.",
      "Make the deck useful as a first real draft for someone who gave the brief.",
      "Keep each slide concise enough for projected presentation content."
    ].join("\n"),
    maxOutputTokens: Math.max(5200, slideCount * 900),
    promptContext: {
      materialPromptText: materialPromptText || "",
      sourcePromptText: sourcePromptText || "",
      workflowName: slideTarget ? "staged-slide-drafting" : "staged-deck-drafting"
    },
    schema: createPlanSchema(slideCount),
    schemaName: "initial_presentation_plan",
    userPrompt: [
      `Generate exactly ${slideCount} slides for a new presentation.`,
      slideTarget
        ? `Target outline slide: ${slideTarget.slideNumber} of ${slideTarget.slideCount}.`
        : "",
      slideTarget && slideTarget.title
        ? `Target slide title: ${slideTarget.title}`
        : "",
      slideTarget && slideTarget.role
        ? `Target slide role in the approved outline: ${slideTarget.role}`
        : "",
      slideTarget && slideTarget.type
        ? `Target slide type in the approved outline: ${slideTarget.type}`
        : "",
      slideTarget && slideTarget.intent
        ? `Target slide intent: ${slideTarget.intent}`
        : "",
      slideTarget && slideTarget.keyMessage
        ? `Target slide key message: ${slideTarget.keyMessage}`
        : "",
      slideTarget
        ? "Return only the target slide. Use the complete approved deck plan for sequence context, but do not draft neighboring slides."
        : "",
      "",
      `Title: ${fields.title || "Untitled presentation"}`,
      `Audience: ${fields.audience || "Not specified"}`,
      `Tone: ${fields.tone || "Direct and practical"}`,
      `Objective: ${fields.objective || "Not specified"}`,
      `Constraints and opinions: ${fields.constraints || "Not specified"}`,
      `Theme brief: ${fields.themeBrief || "Not specified"}`,
      `Sourcing style: ${fields.sourcingStyle || "compact-references"}`,
      `Supplied source URLs: ${suppliedUrls.length ? suppliedUrls.join(", ") : "None"}`,
      "",
      "Approved deck plan:",
      compactJson(deckPlan),
      singleSlideContext
        ? [
            "",
            "Compact deck sequence context:",
            compactJson(singleSlideContext)
          ].join("\n")
        : "",
      "",
      "Retrieved source snippets:",
      sourcePromptText || "None",
      "",
      "Available image materials:",
      materialPromptText || "None",
      "",
      "Use the first slide as the opening frame and the last slide as the closing handoff when there is more than one slide.",
      "Keep all visible slide text in the same language as the requested deck unless the user asks for a mixed-language result."
    ].join("\n")
  };
}

function buildDeckPlanPromptRequest(context: DeckPlanPromptContext): StructuredPromptRequest {
  const { compactJson, fields, lockedOutlineSlides = [], materialPromptText, slideCount, sourcePromptText, suppliedUrls = [] } = context;

  return {
    developerPrompt: [
      "You plan a presentation before slide drafting.",
      "Return JSON only and stay within the provided schema.",
      "Use the language requested or implied by the brief for user-facing titles, intents, and messages.",
      "Do not translate a non-English brief into English unless the user explicitly asks for English.",
      "Create a distinct narrative arc with exactly the requested number of slides.",
      "Each slide must have a unique intent and key message.",
      "The first slide must be role opening. The last slide must be role handoff when there is more than one slide.",
      slideCount >= 12
        ? "For longer decks, use role divider at major section boundaries when it improves pacing and keeps the main path readable."
        : "",
      lockedOutlineSlides.length
        ? "Some outline slides are locked by the user. Preserve their positions and plan surrounding slides around them without replacing their meaning."
        : "",
      "Use sourceNeed and visualNeed to say what each slide needs from sources or image materials.",
      "Set type to the intended slide family: cover, toc, content, summary, divider, quote, photo, or photoGrid.",
      "Use type photoGrid only when the slide should compare or group two to three available image materials; otherwise use photo or content for image-backed slides.",
      sourcingInstruction(fields.sourcingStyle),
      "Call out any theme or visual needs in a way that can preserve WCAG AA contrast against the slide background.",
      "Do not use placeholders, dummy metrics, markdown fences, generic filler, or ellipses.",
      "Do not invent academic papers, citations, or source URLs."
    ].filter(Boolean).join("\n"),
    maxOutputTokens: Math.max(1400, slideCount * 180),
    promptContext: {
      materialPromptText: materialPromptText || "",
      sourcePromptText: sourcePromptText || "",
      workflowName: "staged-outline-planning"
    },
    schema: createDeckPlanSchema(slideCount),
    schemaName: "initial_presentation_deck_plan",
    userPrompt: [
      `Plan exactly ${slideCount} slides for a new presentation.`,
      "",
      `Title: ${fields.title || "Untitled presentation"}`,
      `Audience: ${fields.audience || "Not specified"}`,
      `Tone: ${fields.tone || "Direct and practical"}`,
      `Objective: ${fields.objective || "Not specified"}`,
      `Constraints and opinions: ${fields.constraints || "Not specified"}`,
      `Theme brief: ${fields.themeBrief || "Not specified"}`,
      `Sourcing style: ${fields.sourcingStyle || "compact-references"}`,
      `Supplied source URLs: ${suppliedUrls.length ? suppliedUrls.join(", ") : "None"}`,
      "",
      "Retrieved source snippets:",
      sourcePromptText || "None",
      "",
      "Available image materials:",
      materialPromptText || "None",
      "",
      "Locked outline slides:",
      lockedOutlineSlides.length ? compactJson(lockedOutlineSlides) : "None",
      "",
      "Return only the high-level plan. Do not draft slide cards, guardrails, resources, or notes in this phase."
    ].join("\n")
  };
}

function buildDeckPlanRepairPromptRequest(context: DeckPlanRepairPromptContext): StructuredPromptRequest {
  const { compactJson, fields, issues, normalizedPlan, slideCount } = context;

  return {
    developerPrompt: [
      "You repair a presentation deck plan before slide drafting.",
      "Return JSON only and stay within the provided schema.",
      "Keep the requested slide count, requested language, first opening slide, and final handoff slide.",
      "Fix every listed issue by making slide titles, intents, and key messages distinct.",
      "Preserve useful type, sourceNeed, and visualNeed guidance.",
      "Use type photoGrid only when the slide should compare or group two to three available image materials.",
      "Do not draft slide cards, guardrails, resources, or notes in this phase.",
      "Do not use placeholders, markdown, ellipses, or generic filler."
    ].join("\n"),
    maxOutputTokens: Math.max(1400, slideCount * 180),
    promptContext: {
      workflowName: "staged-outline-repair"
    },
    schema: createDeckPlanSchema(slideCount),
    schemaName: "initial_presentation_deck_plan_repair",
    userPrompt: [
      `Repair this ${slideCount}-slide deck plan.`,
      "",
      `Title: ${fields.title || "Untitled presentation"}`,
      `Audience: ${fields.audience || "Not specified"}`,
      `Objective: ${fields.objective || "Not specified"}`,
      `Constraints and opinions: ${fields.constraints || "Not specified"}`,
      "",
      "Issues to fix:",
      issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n"),
      "",
      "Current plan:",
      compactJson(normalizedPlan)
    ].join("\n")
  };
}

export {
  buildDeckPlanPromptRequest,
  buildDeckPlanRepairPromptRequest,
  buildSlidePlanPromptRequest,
  createDeckPlanSchema,
  createPlanSchema
};
