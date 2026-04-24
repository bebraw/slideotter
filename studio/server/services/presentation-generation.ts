const { createStructuredResponse, getLlmConfig, getLlmStatus } = require("./llm/client.ts");
const { validateSlideSpec } = require("./slide-specs/index.ts");
const { getGenerationSourceContext } = require("./sources.ts");
const { getGenerationMaterialContext } = require("./materials.ts");

const allowedGenerationModes = new Set(["auto", "local", "llm"]);
const contentRoles = ["context", "concept", "mechanics", "example", "tradeoff"];
const defaultSlideCount = 5;
const maximumSlideCount = 30;
const danglingTailWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "through",
  "to",
  "when",
  "where",
  "while",
  "with",
  "within",
  "without"
]);

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
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  const trimmed = words.slice(0, limit);
  while (trimmed.length > 4) {
    const tail = String(trimmed[trimmed.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
    if (!danglingTailWords.has(tail)) {
      break;
    }

    trimmed.pop();
  }

  return trimmed.join(" ").replace(/[,:;]$/g, "");
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

function extractUrls(value) {
  return String(value || "").match(/https?:\/\/[^\s),\]]+/g) || [];
}

function collectProvidedUrls(fields: any = {}) {
  const sourceUrls = Array.isArray(fields.sourceSnippets)
    ? fields.sourceSnippets.map((snippet) => snippet && snippet.url).filter(Boolean)
    : [];

  return [
    fields.title,
    fields.audience,
    fields.objective,
    fields.constraints,
    fields.themeBrief,
    fields.outline,
    ...sourceUrls
  ].flatMap(extractUrls);
}

function tokenizeMaterialText(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
}

function scoreMaterialForSlide(material, planSlide) {
  const materialTokens = new Set(tokenizeMaterialText([
    material.title,
    material.alt,
    material.caption
  ].filter(Boolean).join(" ")));
  const slideTokens = tokenizeMaterialText([
    planSlide && planSlide.title,
    planSlide && planSlide.summary,
    ...(Array.isArray(planSlide && planSlide.keyPoints)
      ? planSlide.keyPoints.flatMap((point) => [point && point.title, point && point.body])
      : [])
  ].filter(Boolean).join(" "));

  return slideTokens.reduce((score, token) => score + (materialTokens.has(token) ? 1 : 0), 0);
}

function resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds) {
  const materials = Array.isArray(materialCandidates) ? materialCandidates : [];
  if (!materials.length) {
    return null;
  }

  const requestedId = String(planSlide && planSlide.mediaMaterialId || "").trim();
  if (requestedId) {
    const requested = materials.find((material) => material.id === requestedId && !usedMaterialIds.has(material.id));
    if (requested) {
      usedMaterialIds.add(requested.id);
      return requested;
    }
  }

  let bestMaterial = null;
  let bestScore = 0;
  materials.forEach((material) => {
    if (usedMaterialIds.has(material.id)) {
      return;
    }

    const score = scoreMaterialForSlide(material, planSlide);
    if (score > bestScore) {
      bestMaterial = material;
      bestScore = score;
    }
  });

  if (bestMaterial && bestScore > 0) {
    usedMaterialIds.add(bestMaterial.id);
    return bestMaterial;
  }

  return null;
}

function materialToMedia(material) {
  if (!material) {
    return undefined;
  }

  const media: any = {
    alt: sentence(material.alt || material.title, material.title, 16),
    id: material.id,
    src: material.url
  };
  const sourceCaption = buildMaterialCaption(material);

  if (sourceCaption) {
    media.caption = sentence(sourceCaption, material.title, 34);
  }

  return media;
}

function normalizeCaptionPart(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^source:\s*/i, "source: ")
    .replace(/^creator:\s*/i, "creator: ")
    .replace(/^license:\s*/i, "license: ")
    .trim()
    .toLowerCase();
}

function buildMaterialCaption(material) {
  const structuredParts = [
    material.creator ? `Creator: ${material.creator}` : "",
    material.license ? `License: ${material.license}` : "",
    material.sourceUrl ? `Source: ${material.sourceUrl}` : ""
  ].filter(Boolean);
  const structuredKeys = new Set(structuredParts.map(normalizeCaptionPart));
  const bareSourceKey = normalizeCaptionPart(material.sourceUrl || "");
  const captionParts = String(material.caption || "")
    .split("|")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((part) => {
      const key = normalizeCaptionPart(part);
      if (structuredKeys.has(key)) {
        return false;
      }

      if (bareSourceKey && key === bareSourceKey) {
        return false;
      }

      if (/^(creator|license|source):/i.test(part)) {
        return false;
      }

      return true;
    });

  return uniqueBy([
    ...captionParts,
    ...structuredParts
  ], normalizeCaptionPart).join(" | ");
}

function uniqueBy(values, getKey) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(value);
  });

  return result;
}

function fillToLength(items, length, fallbackFactory) {
  const result = items.filter(Boolean).slice(0, length);

  for (let index = result.length; index < length; index += 1) {
    result.push(fallbackFactory(index));
  }

  return result;
}

function isWeakLabel(value) {
  return /^(summary|title:?|key point|point|item|slide|section|role|body|n\/a|none)$/i.test(String(value || "").trim());
}

function isScaffoldLeak(value) {
  return /^(guardrails|sources to verify)$/i.test(String(value || "").trim())
    || /refine constraints before expanding the deck/i.test(String(value || ""));
}

function isUnsupportedBibliographicClaim(value) {
  return /\b(et al\.|journal|proceedings|doi:|isbn)\b/i.test(String(value || "")) && !/https?:\/\//.test(String(value || ""));
}

function hasDanglingEnding(value) {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    return false;
  }

  const tail = String(words[words.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
  return danglingTailWords.has(tail);
}

function normalizeVisibleText(value) {
  return String(value || "")
    .replace(/…/g, "")
    .replace(/\.{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  const normalized = normalizeVisibleText(value)
    .replace(/\b(title|summary|body):\s*$/i, "")
    .trim();

  return isUnsupportedBibliographicClaim(normalized) ? "" : normalized;
}

function normalizePoint(point, fallbackTitle, fallbackBody) {
  if (typeof point === "string") {
    return {
      body: cleanText(point) || fallbackBody,
      title: fallbackTitle
    };
  }

  const title = cleanText(point && point.title);
  const body = cleanText(point && point.body);

  return {
    body: body || title || fallbackBody,
    title: title && !isWeakLabel(title) ? title : fallbackTitle
  };
}

function normalizePoints(points, options: any = {}) {
  const fallbackTitle = options.fallbackTitle || "Point";
  const fallbackBody = options.fallbackBody || "Explain the idea with one concrete sentence.";
  const normalized = Array.isArray(points)
    ? points.map((point, index) => normalizePoint(point, `${fallbackTitle} ${index + 1}`, fallbackBody))
    : [];

  return uniqueBy(normalized, (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`);
}

function createPlanSchema(slideCount) {
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
            mediaMaterialId: { type: "string" },
            role: {
              enum: ["opening", "context", "concept", "mechanics", "example", "tradeoff", "reference", "handoff"],
              type: "string"
            },
            summary: { type: "string" },
            title: { type: "string" }
          },
          required: ["title", "role", "summary", "keyPoints", "mediaMaterialId"],
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

function createSemanticRepairSchema() {
  return {
    additionalProperties: false,
    properties: {
      repairs: {
        items: {
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            text: { type: "string" }
          },
          required: ["id", "text"],
          type: "object"
        },
        type: "array"
      }
    },
    required: ["repairs"],
    type: "object"
  };
}

function needsSemanticRepair(value, limit) {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  return words.length > limit || hasDanglingEnding(value);
}

function collectSemanticRepairRequests(plan) {
  const slides = Array.isArray(plan && plan.slides) ? plan.slides : [];
  const references = Array.isArray(plan && plan.references) ? plan.references : [];
  const requests = [];

  slides.forEach((slide, slideIndex) => {
    [
      { field: "title", limit: 8, path: ["slides", slideIndex, "title"], purpose: "slide title" },
      { field: "summary", limit: 18, path: ["slides", slideIndex, "summary"], purpose: "slide summary" }
    ].forEach((item) => {
      if (needsSemanticRepair(slide && slide[item.field], item.limit)) {
        requests.push({
          id: `slide-${slideIndex + 1}-${item.field}`,
          maxWords: item.limit,
          path: item.path,
          purpose: item.purpose,
          text: normalizeVisibleText(slide[item.field])
        });
      }
    });

    const keyPoints = Array.isArray(slide && slide.keyPoints) ? slide.keyPoints : [];
    keyPoints.forEach((point, pointIndex) => {
      [
        { field: "title", limit: 4, purpose: "card title" },
        { field: "body", limit: 13, purpose: "card body" }
      ].forEach((item) => {
        if (needsSemanticRepair(point && point[item.field], item.limit)) {
          requests.push({
            id: `slide-${slideIndex + 1}-point-${pointIndex + 1}-${item.field}`,
            maxWords: item.limit,
            path: ["slides", slideIndex, "keyPoints", pointIndex, item.field],
            purpose: item.purpose,
            text: normalizeVisibleText(point[item.field])
          });
        }
      });
    });
  });

  references.forEach((reference, referenceIndex) => {
    if (needsSemanticRepair(reference && reference.title, 5)) {
      requests.push({
        id: `reference-${referenceIndex + 1}-title`,
        maxWords: 5,
        path: ["references", referenceIndex, "title"],
        purpose: "reference title",
        text: normalizeVisibleText(reference.title)
      });
    }
  });

  return requests;
}

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan || {}));
}

function setPathValue(target, pathParts, value) {
  let current = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    current = current && current[pathParts[index]];
    if (!current) {
      return;
    }
  }

  current[pathParts[pathParts.length - 1]] = value;
}

function applySemanticRepairs(plan, requests, repairs) {
  const nextPlan = clonePlan(plan);
  const requestById: Map<string, any> = new Map(requests.map((request) => [request.id, request]));

  (Array.isArray(repairs) ? repairs : []).forEach((repair) => {
    const request = repair && requestById.get(repair.id);
    const text = cleanText(repair && repair.text);
    if (!request || !text) {
      return;
    }

    setPathValue(nextPlan, request.path, text);
  });

  return nextPlan;
}

async function semanticallyRepairPlanText(plan, options: any = {}) {
  const requests = collectSemanticRepairRequests(plan);
  if (!requests.length) {
    return plan;
  }

  if (typeof options.onProgress === "function") {
    options.onProgress({
      message: `Shortening ${requests.length} generated text field${requests.length === 1 ? "" : "s"} semantically...`,
      stage: "semantic-repair"
    });
  }

  try {
    const result = await createStructuredResponse({
      developerPrompt: [
        "You rewrite presentation slide text to fit strict visible text budgets.",
        "Preserve the meaning and specificity of each item as much as possible.",
        "Return one repair for every requested id.",
        "Do not use ellipses, markdown, labels, citations, or placeholders.",
        "Every repaired item must be a complete title, phrase, or sentence that does not end on a connector word."
      ].join("\n"),
      maxOutputTokens: Math.max(700, requests.length * 70),
      onProgress: options.onProgress,
      schema: createSemanticRepairSchema(),
      schemaName: "presentation_semantic_text_repairs",
      userPrompt: [
        "Rewrite these fields to fit their maxWords limits while keeping the meaning.",
        JSON.stringify({
          requests: requests.map((request) => ({
            id: request.id,
            maxWords: request.maxWords,
            purpose: request.purpose,
            text: request.text
          }))
        }, null, 2)
      ].join("\n\n")
    });

    return applySemanticRepairs(plan, requests, result.data && result.data.repairs);
  } catch (error) {
    if (typeof options.onProgress === "function") {
      options.onProgress({
        message: `Semantic shortening failed; using deterministic text limits. ${error.message}`,
        stage: "semantic-repair-failed"
      });
    }

    return plan;
  }
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
  const slides = [];

  for (let index = 0; index < slideCount; index += 1) {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : contentRoles[(index - 1) % contentRoles.length];
    const roleTitle = ({
      concept: "Core concept",
      context: "Context and audience",
      example: "Worked example",
      handoff: "Next steps",
      mechanics: "How it works",
      opening: title,
      reference: "References to verify",
      tradeoff: "Tradeoffs and limits"
    })[role];
    const pointSeeds = [
      { title: "Objective", body: objective },
      { title: "Audience", body: audience },
      ...(Array.isArray(fields.sourceSnippets) ? fields.sourceSnippets.slice(0, 3).map((snippet, snippetIndex) => ({
        title: `Source ${snippetIndex + 1}`,
        body: snippet.text
      })) : []),
      ...constraints.map((constraint, constraintIndex) => ({
        title: `Constraint ${constraintIndex + 1}`,
        body: constraint
      })),
      { title: "Theme", body: themeBrief }
    ];

    slides.push({
      keyPoints: fillToLength(pointSeeds, 4, (itemIndex) => ({
        body: `${roleTitle} should make ${title} easier to understand.`,
        title: `${roleTitle} ${itemIndex + 1}`
      })),
      mediaMaterialId: "",
      role,
      summary: role === "opening"
        ? objective
        : role === "handoff"
          ? `Close with the action ${audience} should take after reviewing ${title}.`
          : `Explain ${roleTitle.toLowerCase()} for ${title}.`,
      title: roleTitle
    });
  }

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: collectProvidedUrls(fields).map((url, index) => ({
      note: "Source URL supplied in the presentation brief.",
      title: `Provided source ${index + 1}`,
      url
    })),
    slides,
    summary: `Generated a ${slideCount}-slide starting deck from the saved brief.`
  };
}

function roleForIndex(index, total) {
  if (index === 0) {
    return "opening";
  }

  if (index === total - 1 && total > 1) {
    return "handoff";
  }

  return contentRoles[(index - 1) % contentRoles.length];
}

function normalizePlanRole(role, index, total) {
  const desired = roleForIndex(index, total);
  const normalizedRole = String(role || "").trim();

  if (index === 0 || index === total - 1 && total > 1) {
    return desired;
  }

  return contentRoles.includes(normalizedRole) ? normalizedRole : desired;
}

function planSlideSignature(planSlide) {
  return normalizeVisibleText([
    planSlide && planSlide.title,
    planSlide && planSlide.summary,
    ...(Array.isArray(planSlide && planSlide.keyPoints)
      ? planSlide.keyPoints.flatMap((point) => [point && point.title, point && point.body])
      : [])
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function fallbackTopic(fields, role, index) {
  const title = sentence(fields.title, "the topic", 6);
  const audience = sentence(fields.audience, "the audience", 6);
  const objective = sentence(fields.objective, `Explain ${title} clearly.`, 12);

  const topics = {
    concept: {
      title: "Core varieties",
      summary: `Show the main range inside ${title}.`,
      points: [
        { title: "Range", body: `Name the main categories ${audience} should recognize.` },
        { title: "Light side", body: "Start with the easier, cleaner examples." },
        { title: "Darker side", body: "Contrast maltier or stronger examples." },
        { title: "Memory hook", body: "Give one cue that helps the list stick." }
      ]
    },
    context: {
      title: "Why it matters",
      summary: `Set the practical context for ${title}.`,
      points: [
        { title: "Audience need", body: objective },
        { title: "Scope", body: "Name what the deck will and will not cover." },
        { title: "Comparison", body: "Give the audience a simple way to compare options." },
        { title: "Payoff", body: "Make the next useful takeaway explicit." }
      ]
    },
    example: {
      title: "Tasting example",
      summary: `Use one concrete example to make ${title} easier to discuss.`,
      points: [
        { title: "Look", body: "Start with the visible cue before naming details." },
        { title: "Aroma", body: "Call out one smell the audience can remember." },
        { title: "Flavor", body: "Tie the example to one plain flavor description." },
        { title: "Finish", body: "Close with what remains after the first sip." }
      ]
    },
    mechanics: {
      title: "How to read a style",
      summary: `Give ${audience} a simple inspection path for ${title}.`,
      points: [
        { title: "Color", body: "Use appearance as the first sorting cue." },
        { title: "Malt", body: "Explain whether sweetness or toast leads." },
        { title: "Hops", body: "Name whether bitterness stays gentle or sharp." },
        { title: "Strength", body: "Separate everyday beers from stronger choices." }
      ]
    },
    tradeoff: {
      title: "Choosing well",
      summary: `Show how to choose between options in ${title}.`,
      points: [
        { title: "Occasion", body: "Match the beer to the setting." },
        { title: "Food", body: "Use food pairing to narrow the choice." },
        { title: "Season", body: "Let weather and serving context guide weight." },
        { title: "Preference", body: "Leave room for personal taste." }
      ]
    }
  };

  const topic = topics[role] || topics[roleForIndex(index, 6)] || topics.context;
  return topic;
}

function createFallbackPlanSlide(fields, index, total, role) {
  const topic = fallbackTopic(fields, role, index);

  return {
    keyPoints: topic.points,
    mediaMaterialId: "",
    role,
    summary: topic.summary,
    title: topic.title
  };
}

function isGenericPlanSummary(value) {
  return /^(opening frame|concrete example slide|closing handoff|handoff slide|reference slide|concept slide|context slide|mechanics slide|tradeoff slide)\b/i.test(String(value || "").trim())
    || /\bslide that shows how\b/i.test(String(value || ""));
}

function summaryFallbackForRole(planSlide, fields, fallback) {
  const title = sentence(planSlide && planSlide.title, fields.title || "this topic", 7);
  const audience = sentence(fields.audience, "the audience", 6);
  const roleFallbacks = {
    concept: `${title} gives ${audience} one clear idea to remember.`,
    context: `${title} explains why this topic matters now.`,
    example: `${title} gives ${audience} a concrete tasting cue.`,
    handoff: `${title} closes with the practical decision path.`,
    mechanics: `${title} gives ${audience} a simple way to compare styles.`,
    opening: fields.objective || `Introduce ${title} clearly.`,
    reference: `${title} keeps useful source checks visible.`,
    tradeoff: `${title} shows when the choice fits and when it does not.`
  };

  return roleFallbacks[planSlide && planSlide.role] || fallback;
}

function cleanPlanSummary(planSlide, fields, fallback) {
  const summary = cleanText(planSlide && planSlide.summary);
  const resolvedFallback = summaryFallbackForRole(planSlide, fields, fallback);
  return isGenericPlanSummary(summary) ? resolvedFallback : summary || resolvedFallback;
}

function normalizePlanForMaterialization(fields, plan) {
  const rawSlides = Array.isArray(plan && plan.slides) ? plan.slides : [];
  const total = rawSlides.length;
  const seenSignatures = new Set();
  const slides = rawSlides.map((slide, index) => {
    const role = normalizePlanRole(slide && slide.role, index, total);
    const nextSlide = {
      ...slide,
      role
    };
    const signature = planSlideSignature(nextSlide);

    if (signature && seenSignatures.has(signature)) {
      return createFallbackPlanSlide(fields, index, total, role);
    }

    if (signature) {
      seenSignatures.add(signature);
    }

    return nextSlide;
  });

  return {
    ...plan,
    slides
  };
}

function toCards(planSlide, prefix, count) {
  const points = normalizePoints(planSlide.keyPoints, {
    fallbackBody: sentence(planSlide.summary, "Explain this point clearly.", 16),
    fallbackTitle: sentence(planSlide.title, "Point", 3)
  });

  return fillToLength(points, count, (index) => ({
    body: `${sentence(planSlide.title, "This slide", 6)} needs a concrete supporting point.`,
    title: `Point ${index + 1}`
  }))
    .map((point, index) => ({
      body: sentence(point.body, `Point ${index + 1}`, 13),
      id: `${prefix}-${index + 1}`,
      title: sentence(point.title, `Point ${index + 1}`, 4)
    }));
}

function roleLabel(role) {
  return ({
    concept: "Concept",
    context: "Context",
    example: "Example",
    handoff: "Handoff",
    mechanics: "Mechanics",
    opening: "Opening",
    reference: "Reference",
    tradeoff: "Tradeoff"
  })[role] || "Section";
}

function buildCoverNote(fields) {
  if (String(fields.constraints || "").trim()) {
    return sentence(fields.constraints, "Draft the deck around the saved constraints.", 18);
  }

  const audience = sentence(fields.audience, "the intended audience", 8);
  const tone = sentence(fields.tone, "clear", 4);
  return sentence(`Drafted for ${audience} with a ${tone} tone.`, "Drafted from the saved presentation brief.", 18);
}

function secondaryPanelTitle(role) {
  return ({
    concept: "Make it clear",
    context: "Set the scene",
    example: "Try it live",
    mechanics: "Watch the flow",
    tradeoff: "Use with care"
  })[role] || "Useful checks";
}

function buildSecondaryPoints(planSlide, fields, slideIndex) {
  const audience = sentence(fields.audience, "the audience", 8);
  const tone = sentence(fields.tone, "clear", 4);
  const role = planSlide.role;
  const defaults = ({
    concept: [
      { title: "Plain language", body: `Define the idea before adding detail for ${audience}.` },
      { title: "One contrast", body: "Show what changes compared to the familiar approach." },
      { title: "Concrete cue", body: "Tie the concept to one visible example." }
    ],
    context: [
      { title: "Audience need", body: `Start from what ${audience} already knows.` },
      { title: "Problem frame", body: "Name the practical situation this slide explains." },
      { title: "Outcome", body: "Make the next useful takeaway explicit." }
    ],
    example: [
      { title: "Setup", body: "Introduce the smallest example before expanding it." },
      { title: "Action", body: "Show the interaction or decision in one step." },
      { title: "Result", body: "Close the example with the observable outcome." }
    ],
    mechanics: [
      { title: "Trigger", body: "Name what starts the flow." },
      { title: "Exchange", body: "Show what moves between the parts." },
      { title: "Result", body: "Explain what changes after the flow completes." }
    ],
    tradeoff: [
      { title: "Fit", body: "Name the situation where this advice works best." },
      { title: "Risk", body: "Call out where the approach can mislead." },
      { title: "Recovery", body: "Give one practical way to adjust when it fails." }
    ]
  })[role] || [
    { title: "Audience", body: `Keep examples appropriate for ${audience}.` },
    { title: "Tone", body: `Keep the wording ${tone}.` },
    { title: "Focus", body: `Keep slide ${slideIndex} tied to its main idea.` }
  ];

  return defaults;
}

function toContentSlide(planSlide, index, fields) {
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const secondaryPoints = fillToLength(buildSecondaryPoints(planSlide, fields, index), 3, (secondaryIndex) => ({
    body: `${sentence(planSlide.title, "This slide", 6)} should stay focused on one useful idea.`,
    title: `Check ${secondaryIndex + 1}`
  }));

  return validateSlideSpec({
    eyebrow: roleLabel(planSlide.role),
    guardrails: secondaryPoints.map((point, guardrailIndex) => ({
      body: sentence(point.body, "Keep the argument focused.", 13),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point.title, `Check ${guardrailIndex + 1}`, 4)
    })),
    guardrailsTitle: secondaryPanelTitle(planSlide.role),
    layout: planSlide.role === "mechanics" || planSlide.role === "example" ? "steps" : planSlide.role === "tradeoff" ? "checklist" : "standard",
    signals: toCards(planSlide, `${prefix}-signal`, 4),
    signalsTitle: "Key points",
    summary: sentence(cleanPlanSummary(planSlide, fields, "Explain this section clearly."), "Explain this section clearly.", 18),
    title: sentence(planSlide.title, `Slide ${index}`, 8),
    type: "content"
  });
}

function materializePlan(fields, plan) {
  const normalizedPlan = normalizePlanForMaterialization(fields, plan);
  const slides = Array.isArray(normalizedPlan.slides) ? normalizedPlan.slides : [];
  const title = sentence(fields.title, "Untitled presentation", 8);
  const total = slides.length;
  const materialCandidates = Array.isArray(fields.materialCandidates) ? fields.materialCandidates : [];
  const usedMaterialIds = new Set();
  const suppliedUrls = new Set(collectProvidedUrls(fields));
  const references = Array.isArray(normalizedPlan.references)
    ? normalizedPlan.references
      .filter((reference) => reference && suppliedUrls.has(String(reference.url || "").trim()))
      .slice(0, 2)
    : [];

  return slides.map((planSlide, index) => {
    const slideNumber = index + 1;
    const isFirst = index === 0;
    const isLast = index === total - 1 && total > 1;
    const prefix = slugPart(planSlide.title, `slide-${slideNumber}`);

    if (isFirst) {
      const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
      return validateSlideSpec({
        cards: toCards(planSlide, `${prefix}-card`, 3),
        eyebrow: "Opening",
        layout: "focus",
        ...(media ? { media } : {}),
        note: buildCoverNote(fields),
        summary: sentence(cleanPlanSummary(planSlide, fields, fields.objective || `Explain ${title}.`), fields.objective || `Explain ${title}.`, 18),
        title,
        type: "cover"
      });
    }

    if (isLast) {
      const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
      const resourceItems = fillToLength(references.map((reference, referenceIndex) => ({
        body: reference.url,
        id: `${prefix}-resource-${referenceIndex + 1}`,
        title: sentence(reference.title, `Source ${referenceIndex + 1}`, 5)
      })), 2, (resourceIndex) => ({
        body: /reference|citation|source/i.test(fields.constraints || "")
          ? "Add verified source URLs before publishing."
          : resourceIndex === 0
            ? "Rehearse the flow once with the intended audience in mind."
            : "Keep one concrete example ready for questions.",
        id: `${prefix}-resource-${resourceIndex + 1}`,
        title: /reference|citation|source/i.test(fields.constraints || "")
          ? `Reference lead ${resourceIndex + 1}`
          : resourceIndex === 0 ? "Rehearsal" : "Example"
      }));

      return validateSlideSpec({
        bullets: toCards(planSlide, `${prefix}-bullet`, 3),
        eyebrow: "Close",
        layout: "checklist",
        ...(media ? { media } : {}),
        resources: resourceItems,
        resourcesTitle: references.length ? "References" : "Useful cues",
        summary: sentence(cleanPlanSummary(planSlide, fields, "Close with the next useful action."), "Close with the next useful action.", 18),
        title: sentence(planSlide.title, "Next steps", 8),
        type: "summary"
      });
    }

    const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
    return validateSlideSpec({
      ...toContentSlide(planSlide, slideNumber, fields),
      ...(media ? { media } : {})
    });
  });
}

function collectVisibleText(slideSpec) {
  return [
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle,
    slideSpec.media && slideSpec.media.alt,
    slideSpec.media && slideSpec.media.caption,
    ...(slideSpec.cards || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.signals || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.guardrails || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.bullets || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.resources || []).flatMap((item) => [item.title, item.body])
  ].filter(Boolean);
}

function assertGeneratedSlideQuality(slideSpecs) {
  const seenSlideSignatures = new Map();

  slideSpecs.forEach((slideSpec, slideIndex) => {
    const visibleText = collectVisibleText(slideSpec);
    const weakLabels = visibleText.filter((value) => isWeakLabel(value) || isScaffoldLeak(value) || /\b(title|summary|body):\s*$/i.test(String(value)));
    if (weakLabels.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains placeholder text: ${weakLabels.join(", ")}`);
    }

    const ellipsisText = visibleText.filter((value) => /\.{3,}|…/.test(String(value)));
    if (ellipsisText.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains ellipsis-truncated text.`);
    }

    const danglingText = visibleText.filter(hasDanglingEnding);
    if (danglingText.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains incomplete visible text.`);
    }

    [
      slideSpec.cards || [],
      slideSpec.signals || [],
      slideSpec.guardrails || [],
      slideSpec.bullets || []
    ].forEach((items) => {
      const itemBodies = items.map((item) => String(item.body || "").toLowerCase());
      const duplicateBodies = itemBodies.filter((body, index) => body && itemBodies.indexOf(body) !== index);
      if (duplicateBodies.length) {
        throw new Error(`Generated slide ${slideIndex + 1} repeats visible card content.`);
      }
    });

    const fakeBibliographicClaims = visibleText.filter(isUnsupportedBibliographicClaim);
    if (fakeBibliographicClaims.length) {
      throw new Error(`Generated slide ${slideIndex + 1} contains unsourced bibliographic-looking claims.`);
    }

    const slideSignature = normalizeVisibleText([
      slideSpec.type,
      slideSpec.title,
      slideSpec.summary,
      ...(slideSpec.cards || []).map((item) => item.body),
      ...(slideSpec.signals || []).map((item) => item.body),
      ...(slideSpec.bullets || []).map((item) => item.body)
    ].filter(Boolean).join(" | ")).toLowerCase();

    if (
      slideSignature.length > 40
      && seenSlideSignatures.has(slideSignature)
      && slideIndex + 1 - seenSlideSignatures.get(slideSignature) <= 2
    ) {
      throw new Error(`Generated slide ${slideIndex + 1} repeats slide ${seenSlideSignatures.get(slideSignature)}.`);
    }

    if (slideSignature.length > 40) {
      seenSlideSignatures.set(slideSignature, slideIndex + 1);
    }
  });

  return slideSpecs;
}

async function createLlmPlan(fields, slideCount, options: any = {}) {
  const suppliedUrls = collectProvidedUrls(fields);
  const sourceContext = fields.sourceContext || { promptText: "", snippets: [] };
  const materialContext = fields.materialContext || { promptText: "", materials: [] };
  const result = await createStructuredResponse({
    developerPrompt: [
      "You generate first-draft presentation plans for a local structured-deck studio.",
      "Return JSON only and stay within the provided schema.",
      "Every key point must have a specific short title and a concrete body sentence.",
      "Do not use placeholders, dummy metrics, markdown fences, or generic filler.",
      "Do not use ellipses. Finish each visible sentence cleanly.",
      "Do not use field labels such as title, summary, body, key point, or role as visible slide text.",
      "Do not invent academic papers, authors, journals, publication years, citations, or source URLs.",
      "Use retrieved source snippets as grounded material when they are provided.",
      "Use available image materials only when they clearly fit the slide topic.",
      "Set mediaMaterialId to the chosen material id for a slide, or to an empty string when no image should be attached.",
      "Only include references whose URLs were supplied by the user or retrieved source snippets. If none were supplied, return an empty references array.",
      "Make the deck useful as a first real draft for someone who gave the brief.",
      "Keep each slide concise enough for projected presentation content."
    ].join("\n"),
    maxOutputTokens: Math.max(2600, slideCount * 420),
    onProgress: options.onProgress,
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
      `Supplied source URLs: ${suppliedUrls.length ? suppliedUrls.join(", ") : "None"}`,
      "",
      "Retrieved source snippets:",
      sourceContext.promptText || "None",
      "",
      "Available image materials:",
      materialContext.promptText || "None",
      "",
      "Use the first slide as the opening frame and the last slide as the closing handoff when there is more than one slide.",
      "For a technical teaching deck, include at least one concrete example slide and one tradeoff/limitations slide when the requested length allows it."
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
  const sourceContext = getGenerationSourceContext(fields);
  const materialContext = getGenerationMaterialContext({
    includeActiveMaterials: fields.includeActiveMaterials !== false,
    materials: fields.presentationMaterials
  });
  const generationFields = {
    ...fields,
    materialCandidates: materialContext.materials,
    materialContext,
    sourceContext,
    sourceSnippets: sourceContext.snippets
  };
  let plan = null;
  let response = null;

  if (generation.mode === "llm") {
    response = await createLlmPlan(generationFields, slideCount, {
      onProgress: fields.onProgress
    });
    plan = await semanticallyRepairPlanText(response.plan, {
      onProgress: fields.onProgress
    });
  } else {
    plan = createLocalPlan(generationFields, slideCount);
  }

  const slideSpecs = assertGeneratedSlideQuality(materializePlan(generationFields, plan));

  return {
    generation: {
      ...generation,
      model: response ? response.model : generation.model,
      provider: response ? response.provider : generation.provider,
      responseId: response ? response.responseId : null
    },
    retrieval: {
      budget: sourceContext.budget || null,
      materials: materialContext.materials.map((material) => ({
        alt: material.alt,
        caption: material.caption,
        id: material.id,
        license: material.license,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      })),
      snippets: sourceContext.snippets.map((snippet) => ({
        chunkIndex: snippet.chunkIndex,
        sourceId: snippet.sourceId,
        text: snippet.text,
        title: snippet.title,
        url: snippet.url
      }))
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
  materializePlan,
  normalizeSlideCount
};
