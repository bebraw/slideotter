const { createStructuredResponse, getLlmConfig, getLlmStatus } = require("./llm/client.ts");
const { validateSlideSpec } = require("./slide-specs/index.ts");

const allowedGenerationModes = new Set(["auto", "local", "llm"]);
const defaultSlideCount = 5;
const maximumSlideCount = 30;

function normalizeGenerationMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return allowedGenerationModes.has(mode) ? mode : "auto";
}

function normalizeSlideCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return defaultSlideCount;
  }

  return Math.min(Math.max(1, parsed), maximumSlideCount);
}

function trimWords(value, limit = 12) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return words.join(" ");
  }

  return `${words.slice(0, limit).join(" ")}...`;
}

function sentence(value, fallback, limit = 14) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return trimWords(normalized || fallback, limit);
}

function slugPart(value, fallback = "item") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return slug || fallback;
}

function splitList(value) {
  return String(value || "")
    .split(/\n|;|\./)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function repeatToLength(items, length, fallbackFactory) {
  const source = items.filter(Boolean);
  const result = [];

  for (let index = 0; index < length; index += 1) {
    result.push(source[index % source.length] || fallbackFactory(index));
  }

  return result;
}

function createPlanSchema(slideCount) {
  return {
    additionalProperties: false,
    properties: {
      outline: { type: "string" },
      slides: {
        items: {
          additionalProperties: false,
          properties: {
            keyPoints: {
              items: { type: "string" },
              maxItems: 4,
              minItems: 3,
              type: "array"
            },
            role: {
              enum: ["cover", "context", "evidence", "workflow", "decision", "summary"],
              type: "string"
            },
            summary: { type: "string" },
            title: { type: "string" }
          },
          required: ["title", "role", "summary", "keyPoints"],
          type: "object"
        },
        maxItems: slideCount,
        minItems: slideCount,
        type: "array"
      },
      summary: { type: "string" }
    },
    required: ["summary", "outline", "slides"],
    type: "object"
  };
}

function resolveGeneration(options: any = {}) {
  const requestedMode = normalizeGenerationMode(options.generationMode || getLlmConfig().defaultGenerationMode);
  const llmStatus = getLlmStatus();

  if (requestedMode === "local") {
    return {
      available: llmStatus.available,
      fallbackReason: null,
      mode: "local",
      model: null,
      provider: "local",
      requestedMode
    };
  }

  if (requestedMode === "llm") {
    if (!llmStatus.available) {
      throw new Error(`LLM presentation generation is not configured. ${llmStatus.configuredReason || "Configure a provider or choose local generation."}`);
    }

    return {
      available: true,
      fallbackReason: null,
      mode: "llm",
      model: llmStatus.model,
      provider: llmStatus.provider,
      requestedMode
    };
  }

  if (llmStatus.available) {
    return {
      available: true,
      fallbackReason: null,
      mode: "llm",
      model: llmStatus.model,
      provider: llmStatus.provider,
      requestedMode
    };
  }

  return {
    available: false,
    fallbackReason: llmStatus.configuredReason
      ? `LLM unavailable, used local presentation generation. ${llmStatus.configuredReason}`
      : "LLM unavailable, used local presentation generation.",
    mode: "local",
    model: null,
    provider: "local",
    requestedMode
  };
}

function createLocalPlan(fields, slideCount) {
  const title = sentence(fields.title, "Untitled presentation", 8);
  const audience = sentence(fields.audience, "the intended audience", 10);
  const objective = sentence(fields.objective, `Help ${audience} understand ${title}.`, 18);
  const constraints = splitList(fields.constraints);
  const themeBrief = sentence(fields.themeBrief, "Keep the deck readable and deliberate.", 14);
  const contentRoles = ["context", "evidence", "workflow", "decision"];
  const slides = [];

  for (let index = 0; index < slideCount; index += 1) {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "cover" : isLast ? "summary" : contentRoles[(index - 1) % contentRoles.length];
    const roleTitle = ({
      context: "Context and audience",
      cover: title,
      decision: "Decision path",
      evidence: "Proof and constraints",
      summary: "Next steps",
      workflow: "Working approach"
    })[role];

    slides.push({
      keyPoints: repeatToLength([
        objective,
        audience,
        ...constraints,
        themeBrief
      ], 4, (itemIndex) => `${title} point ${itemIndex + 1}`),
      role,
      summary: role === "cover"
        ? objective
        : role === "summary"
          ? `Close with the action ${audience} should take after reviewing ${title}.`
          : `Explain ${roleTitle.toLowerCase()} for ${title}.`,
      title: roleTitle
    });
  }

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    summary: `Generated a ${slideCount}-slide starting deck from the saved brief.`
  };
}

function toCards(planSlide, prefix, count) {
  return repeatToLength(planSlide.keyPoints || [], count, (index) => `${planSlide.title} point ${index + 1}`)
    .map((point, index) => ({
      body: sentence(point, `Point ${index + 1}`, 13),
      id: `${prefix}-${index + 1}`,
      title: sentence(index === 0 ? planSlide.role : point, `Point ${index + 1}`, 4)
    }));
}

function toContentSlide(planSlide, index, fields) {
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const constraints = splitList(fields.constraints);
  const guardrailPoints = repeatToLength([
    ...constraints,
    fields.tone ? `Use a ${fields.tone} tone.` : "",
    fields.audience ? `Keep ${fields.audience} in view.` : ""
  ], 3, (guardrailIndex) => `Keep slide ${index} concise and evidence-led.`);

  return validateSlideSpec({
    eyebrow: sentence(planSlide.role, "Section", 3),
    guardrails: guardrailPoints.map((point, guardrailIndex) => ({
      body: sentence(point, "Keep the argument focused.", 13),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point, `Guardrail ${guardrailIndex + 1}`, 4)
    })),
    guardrailsTitle: "Guardrails",
    layout: planSlide.role === "workflow" ? "steps" : planSlide.role === "decision" ? "checklist" : "standard",
    signals: toCards(planSlide, `${prefix}-signal`, 4),
    signalsTitle: "Key points",
    summary: sentence(planSlide.summary, "Explain this section clearly.", 18),
    title: sentence(planSlide.title, `Slide ${index}`, 8),
    type: "content"
  });
}

function materializePlan(fields, plan) {
  const slides = Array.isArray(plan.slides) ? plan.slides : [];
  const title = sentence(fields.title, "Untitled presentation", 8);
  const total = slides.length;

  return slides.map((planSlide, index) => {
    const slideNumber = index + 1;
    const isFirst = index === 0;
    const isLast = index === total - 1 && total > 1;
    const prefix = slugPart(planSlide.title, `slide-${slideNumber}`);

    if (isFirst) {
      return validateSlideSpec({
        cards: toCards(planSlide, `${prefix}-card`, 3),
        eyebrow: sentence(planSlide.role, "Opening", 3),
        layout: "focus",
        note: sentence(fields.constraints, "Refine constraints before expanding the deck.", 18),
        summary: sentence(planSlide.summary, fields.objective || `Explain ${title}.`, 18),
        title,
        type: "cover"
      });
    }

    if (isLast) {
      return validateSlideSpec({
        bullets: toCards(planSlide, `${prefix}-bullet`, 3),
        eyebrow: "Close",
        layout: "checklist",
        resources: [
          {
            body: "presentations/<id>/slides",
            id: `${prefix}-resource-slides`,
            title: "Slides"
          },
          {
            body: "presentations/<id>/state",
            id: `${prefix}-resource-state`,
            title: "State"
          }
        ],
        resourcesTitle: "Working files",
        summary: sentence(planSlide.summary, "Close with the next useful action.", 18),
        title: sentence(planSlide.title, "Next steps", 8),
        type: "summary"
      });
    }

    return toContentSlide(planSlide, slideNumber, fields);
  });
}

async function createLlmPlan(fields, slideCount) {
  const result = await createStructuredResponse({
    developerPrompt: [
      "You generate first-draft presentation plans for a local structured-deck studio.",
      "Return JSON only and stay within the provided schema.",
      "Do not use placeholders, dummy metrics, markdown fences, or generic filler.",
      "Make the deck useful as a first real draft for someone who gave the brief.",
      "Keep each slide concise enough for projected presentation content."
    ].join("\n"),
    maxOutputTokens: Math.max(2600, slideCount * 420),
    schema: createPlanSchema(slideCount),
    schemaName: "initial_presentation_plan",
    userPrompt: [
      `Generate exactly ${slideCount} slides for a new presentation.`,
      "",
      `Title: ${fields.title || "Untitled presentation"}`,
      `Audience: ${fields.audience || "Not specified"}`,
      `Tone: ${fields.tone || "Direct and practical"}`,
      `Objective: ${fields.objective || "Not specified"}`,
      `Constraints and opinions: ${fields.constraints || "Not specified"}`,
      `Theme brief: ${fields.themeBrief || "Not specified"}`,
      "",
      "Use the first slide as the opening frame and the last slide as the closing handoff when there is more than one slide."
    ].join("\n")
  });

  return {
    model: result.model,
    plan: result.data,
    provider: result.provider,
    responseId: result.responseId
  };
}

async function generateInitialPresentation(fields: any = {}) {
  const slideCount = normalizeSlideCount(fields.targetSlideCount || fields.targetCount);
  const generation = resolveGeneration(fields);
  let plan = null;
  let response = null;

  if (generation.mode === "llm") {
    response = await createLlmPlan(fields, slideCount);
    plan = response.plan;
  } else {
    plan = createLocalPlan(fields, slideCount);
  }

  const slideSpecs = materializePlan(fields, plan);

  return {
    generation: {
      ...generation,
      model: response ? response.model : generation.model,
      provider: response ? response.provider : generation.provider,
      responseId: response ? response.responseId : null
    },
    outline: plan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideSpecs,
    summary: generation.mode === "llm"
      ? `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} with ${response.provider} ${response.model}.`
      : `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} with local rules${generation.fallbackReason ? `; ${generation.fallbackReason.toLowerCase()}` : ""}.`,
    targetSlideCount: slideCount
  };
}

module.exports = {
  generateInitialPresentation,
  normalizeSlideCount
};
