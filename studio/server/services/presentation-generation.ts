const { createStructuredResponse, getLlmStatus } = require("./llm/client.ts");
const { validateSlideSpec } = require("./slide-specs/index.ts");
const { getGenerationSourceContext } = require("./sources.ts");
const { getGenerationMaterialContext } = require("./materials.ts");

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

function requireVisibleText(value, fieldName) {
  const text = cleanText(value);
  if (text && !isWeakLabel(text)) {
    return text;
  }

  throw new Error(`Generated presentation plan is missing usable ${fieldName}.`);
}

function normalizeGeneratedPoints(points, count, fieldName) {
  const normalized = Array.isArray(points)
    ? points.map((point, index) => {
      const title = requireVisibleText(point && point.title, `${fieldName}[${index}].title`);
      const body = requireVisibleText(point && point.body, `${fieldName}[${index}].body`);
      return { body, title };
    })
    : [];
  const unique = uniqueBy(normalized, (point) => `${point.title.toLowerCase()}|${point.body.toLowerCase()}`);

  if (unique.length < count) {
    throw new Error(`Generated presentation plan needs ${count} distinct ${fieldName} items in the deck language.`);
  }

  return unique.slice(0, count);
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
              enum: ["opening", "context", "concept", "mechanics", "example", "tradeoff", "reference", "handoff"],
              type: "string"
            },
            signalsTitle: { type: "string" },
            summary: { type: "string" },
            title: { type: "string" }
          },
          required: [
            "title",
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

function createDeckPlanSchema(slideCount) {
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
              enum: ["opening", "context", "concept", "mechanics", "example", "tradeoff", "reference", "handoff"],
              type: "string"
            },
            sourceNeed: { type: "string" },
            title: { type: "string" },
            visualNeed: { type: "string" }
          },
          required: ["title", "role", "intent", "keyMessage", "sourceNeed", "visualNeed"],
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
    [
      { items: keyPoints, pathName: "keyPoints", prefix: "point" },
      { items: Array.isArray(slide && slide.guardrails) ? slide.guardrails : [], pathName: "guardrails", prefix: "guardrail" },
      { items: Array.isArray(slide && slide.resources) ? slide.resources : [], pathName: "resources", prefix: "resource" }
    ].forEach((list) => {
      list.items.forEach((point, pointIndex) => {
        [
          { field: "title", limit: 4, purpose: "card title" },
          { field: "body", limit: 13, purpose: "card body" }
        ].forEach((item) => {
          if (needsSemanticRepair(point && point[item.field], item.limit)) {
            requests.push({
              id: `slide-${slideIndex + 1}-${list.prefix}-${pointIndex + 1}-${item.field}`,
              maxWords: item.limit,
              path: ["slides", slideIndex, list.pathName, pointIndex, item.field],
              purpose: item.purpose,
              text: normalizeVisibleText(point[item.field])
            });
          }
        });
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
  const llmStatus = getLlmStatus();

  if (!llmStatus.available) {
    throw new Error(`LLM presentation generation is required. ${llmStatus.configuredReason || "Configure OpenAI, LM Studio, or OpenRouter before generating a presentation."}`);
  }

  return {
    available: true,
    fallbackReason: null,
    mode: "llm",
    model: llmStatus.model,
    provider: llmStatus.provider,
    requestedMode: "llm"
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

function deckPlanSlideSignature(planSlide) {
  return normalizeVisibleText([
    planSlide && planSlide.title,
    planSlide && planSlide.intent,
    planSlide && planSlide.keyMessage
  ].filter(Boolean).join(" | ")).toLowerCase();
}

function collectDeckPlanIssues(plan, slideCount) {
  const slides = Array.isArray(plan && plan.slides) ? plan.slides : [];
  const issues = [];
  if (slides.length !== slideCount) {
    issues.push(`Plan has ${slides.length} slides but needs exactly ${slideCount}.`);
  }

  const seenSignatures = new Set();
  slides.forEach((slide, index) => {
    [
      ["title", slide && slide.title],
      ["intent", slide && slide.intent],
      ["keyMessage", slide && slide.keyMessage],
      ["sourceNeed", slide && slide.sourceNeed],
      ["visualNeed", slide && slide.visualNeed]
    ].forEach(([fieldName, value]) => {
      try {
        requireVisibleText(value, `deckPlan.slides[${index}].${fieldName}`);
      } catch (error) {
        issues.push(error.message);
      }
    });

    const desiredRole = roleForIndex(index, slideCount);
    if ((index === 0 || index === slideCount - 1 && slideCount > 1) && slide.role !== desiredRole) {
      issues.push(`Slide ${index + 1} must use role "${desiredRole}".`);
    }

    const signature = deckPlanSlideSignature(slide);
    if (signature && seenSignatures.has(signature)) {
      issues.push(`Slide ${index + 1} repeats an earlier slide title, intent, and key message.`);
    }

    seenSignatures.add(signature);
  });

  return issues;
}

function validateDeckPlan(plan, slideCount) {
  const issues = collectDeckPlanIssues(plan, slideCount);
  if (issues.length) {
    throw new Error(`Generated deck plan is not usable: ${issues.join(" ")}`);
  }

  return plan;
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

function isGenericPlanSummary(value) {
  return /^(opening frame|concrete example slide|closing handoff|handoff slide|reference slide|concept slide|context slide|mechanics slide|tradeoff slide)\b/i.test(String(value || "").trim())
    || /\bslide that shows how\b/i.test(String(value || ""));
}

function normalizePlanForMaterialization(_fields, plan) {
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
      throw new Error(`Generated presentation plan repeats slide ${index + 1}; retry generation instead of injecting fallback copy.`);
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

function toCards(planSlide, prefix, count, fieldName = "keyPoints") {
  return normalizeGeneratedPoints(planSlide[fieldName], count, fieldName)
    .map((point, index) => ({
      body: sentence(point.body, point.body, 13),
      id: `${prefix}-${index + 1}`,
      title: sentence(point.title, point.title, 4)
    }));
}

function planFieldText(planSlide, fieldName, limit) {
  const text = requireVisibleText(planSlide && planSlide[fieldName], fieldName);
  return sentence(text, text, limit);
}

function planSummaryText(planSlide, limit) {
  const summary = cleanText(planSlide && planSlide.summary);
  if (summary && !isGenericPlanSummary(summary)) {
    return sentence(summary, summary, limit);
  }

  throw new Error("Generated presentation plan is missing a usable slide summary in the deck language.");
}

function toContentSlide(planSlide, index) {
  const prefix = slugPart(planSlide.title, `slide-${index}`);
  const secondaryPoints = normalizeGeneratedPoints(planSlide.guardrails, 3, "guardrails");

  return validateSlideSpec({
    eyebrow: planFieldText(planSlide, "eyebrow", 4),
    guardrails: secondaryPoints.map((point, guardrailIndex) => ({
      body: sentence(point.body, point.body, 13),
      id: `${prefix}-guardrail-${guardrailIndex + 1}`,
      title: sentence(point.title, point.title, 4)
    })),
    guardrailsTitle: planFieldText(planSlide, "guardrailsTitle", 5),
    layout: planSlide.role === "mechanics" || planSlide.role === "example" ? "steps" : planSlide.role === "tradeoff" ? "checklist" : "standard",
    signals: toCards(planSlide, `${prefix}-signal`, 4),
    signalsTitle: planFieldText(planSlide, "signalsTitle", 4),
    summary: planSummaryText(planSlide, 18),
    title: sentence(planSlide.title, planSlide.title, 8),
    type: "content"
  });
}

function materializePlan(fields, plan) {
  const normalizedPlan = normalizePlanForMaterialization(fields, plan);
  const slides = Array.isArray(normalizedPlan.slides) ? normalizedPlan.slides : [];
  const title = sentence(requireVisibleText(fields.title || (slides[0] && slides[0].title), "presentation title"), fields.title || (slides[0] && slides[0].title), 8);
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
        eyebrow: planFieldText(planSlide, "eyebrow", 4),
        layout: "focus",
        ...(media ? { media } : {}),
        note: planFieldText(planSlide, "note", 18),
        summary: planSummaryText(planSlide, 18),
        title,
        type: "cover"
      });
    }

    if (isLast) {
      const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
      const generatedResources = normalizeGeneratedPoints(planSlide.resources, 2, "resources");
      const referenceByUrl: Map<string, any> = new Map(references.map((reference: any) => [String(reference.url || "").trim(), reference]));
      const resourceItems = generatedResources.map((resource, resourceIndex) => {
        const matchingReference = referenceByUrl.get(String(resource.body || "").trim());

        return {
          body: matchingReference ? matchingReference.url : sentence(resource.body, resource.body, 18),
          id: `${prefix}-resource-${resourceIndex + 1}`,
          title: sentence(resource.title, matchingReference && matchingReference.title || resource.title, 5)
        };
      });

      return validateSlideSpec({
        bullets: toCards(planSlide, `${prefix}-bullet`, 3),
        eyebrow: planFieldText(planSlide, "eyebrow", 4),
        layout: "checklist",
        ...(media ? { media } : {}),
        resources: resourceItems.map((resource, resourceIndex) => ({
          body: sentence(resource.body, resource.body, 18),
          id: `${prefix}-resource-${resourceIndex + 1}`,
          title: sentence(resource.title, resource.title, 5)
        })),
        resourcesTitle: planFieldText(planSlide, "resourcesTitle", 5),
        summary: planSummaryText(planSlide, 18),
        title: sentence(planSlide.title, planSlide.title, 8),
        type: "summary"
      });
    }

    const media = materialToMedia(resolveSlideMaterial(planSlide, materialCandidates, usedMaterialIds));
    return validateSlideSpec({
      ...toContentSlide(planSlide, slideNumber),
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
  const deckPlan = validateDeckPlan(options.deckPlan, slideCount);
  const result = await createStructuredResponse({
    developerPrompt: [
      "You turn an approved presentation outline into complete structured slide content for a local deck studio.",
      "Return JSON only and stay within the provided schema.",
      "Use the language requested or implied by the brief for every user-visible field.",
      "Do not translate a non-English brief into English unless the user explicitly asks for English.",
      "Every slide must provide its own visible labels: eyebrow, note, signalsTitle, guardrailsTitle, resourcesTitle, keyPoints, guardrails, and resources.",
      "Every key point must have a specific short title and a concrete body sentence.",
      "Every guardrail and resource must have a specific short title and a concrete body sentence in the deck language.",
      "Follow the approved deck plan slide by slide. Do not change the slide count or repeat the same slide intent.",
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
      "Approved deck plan:",
      JSON.stringify(deckPlan, null, 2),
      "",
      "Retrieved source snippets:",
      sourceContext.promptText || "None",
      "",
      "Available image materials:",
      materialContext.promptText || "None",
      "",
      "Use the first slide as the opening frame and the last slide as the closing handoff when there is more than one slide.",
      "Keep all visible slide text in the same language as the requested deck unless the user asks for a mixed-language result."
    ].join("\n")
  });

  return {
    model: result.model,
    plan: result.data,
    provider: result.provider,
    responseId: result.responseId
  };
}

async function createLlmDeckPlan(fields, slideCount, options: any = {}) {
  const suppliedUrls = collectProvidedUrls(fields);
  const sourceContext = fields.sourceContext || { promptText: "", snippets: [] };
  const materialContext = fields.materialContext || { promptText: "", materials: [] };
  const result = await createStructuredResponse({
    developerPrompt: [
      "You plan a presentation before slide drafting.",
      "Return JSON only and stay within the provided schema.",
      "Use the language requested or implied by the brief for user-facing titles, intents, and messages.",
      "Do not translate a non-English brief into English unless the user explicitly asks for English.",
      "Create a distinct narrative arc with exactly the requested number of slides.",
      "Each slide must have a unique intent and key message.",
      "The first slide must be role opening. The last slide must be role handoff when there is more than one slide.",
      "Use sourceNeed and visualNeed to say what each slide needs from sources or image materials.",
      "Do not use placeholders, dummy metrics, markdown fences, generic filler, or ellipses.",
      "Do not invent academic papers, citations, or source URLs."
    ].join("\n"),
    maxOutputTokens: Math.max(1400, slideCount * 180),
    onProgress: options.onProgress,
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
      `Supplied source URLs: ${suppliedUrls.length ? suppliedUrls.join(", ") : "None"}`,
      "",
      "Retrieved source snippets:",
      sourceContext.promptText || "None",
      "",
      "Available image materials:",
      materialContext.promptText || "None",
      "",
      "Return only the high-level plan. Do not draft slide cards, guardrails, resources, or notes in this phase."
    ].join("\n")
  });

  return {
    model: result.model,
    plan: await repairDeckPlanIfNeeded(fields, result.data, slideCount, options),
    provider: result.provider,
    responseId: result.responseId
  };
}

async function repairDeckPlanIfNeeded(fields, plan, slideCount, options: any = {}) {
  const issues = collectDeckPlanIssues(plan, slideCount);
  if (!issues.length) {
    return validateDeckPlan(plan, slideCount);
  }

  if (typeof options.onProgress === "function") {
    options.onProgress({
      message: `Repairing deck outline before slide drafting (${issues.length} issue${issues.length === 1 ? "" : "s"}).`,
      stage: "deck-plan-repair"
    });
  }

  const result = await createStructuredResponse({
    developerPrompt: [
      "You repair a presentation deck plan before slide drafting.",
      "Return JSON only and stay within the provided schema.",
      "Keep the requested slide count, requested language, first opening slide, and final handoff slide.",
      "Fix every listed issue by making slide titles, intents, and key messages distinct.",
      "Preserve useful sourceNeed and visualNeed guidance.",
      "Do not draft slide cards, guardrails, resources, or notes in this phase.",
      "Do not use placeholders, markdown, ellipses, or generic filler."
    ].join("\n"),
    maxOutputTokens: Math.max(1400, slideCount * 180),
    onProgress: options.onProgress,
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
      JSON.stringify(plan, null, 2)
    ].join("\n")
  });

  return validateDeckPlan(result.data, slideCount);
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
  if (typeof fields.onProgress === "function") {
    fields.onProgress({
      message: "Planning deck structure with the LLM...",
      stage: "planning-deck"
    });
  }
  const deckPlanResponse = await createLlmDeckPlan(generationFields, slideCount, {
    onProgress: fields.onProgress
  });
  if (typeof fields.onProgress === "function") {
    fields.onProgress({
      message: "Drafting slide details from the approved deck plan...",
      stage: "drafting-slides"
    });
  }
  const response = await createLlmPlan(generationFields, slideCount, {
    deckPlan: deckPlanResponse.plan,
    onProgress: fields.onProgress
  });
  const plan = await semanticallyRepairPlanText(response.plan, {
    onProgress: fields.onProgress
  });
  const slideSpecs = assertGeneratedSlideQuality(materializePlan(generationFields, plan));

  return {
    generation: {
      ...generation,
      deckPlanResponseId: deckPlanResponse.responseId,
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
    deckPlan: deckPlanResponse.plan,
    outline: deckPlanResponse.plan.outline || plan.outline || slideSpecs.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slideSpecs,
    summary: `Generated ${slideSpecs.length} initial slide${slideSpecs.length === 1 ? "" : "s"} with ${response.provider} ${response.model}.`,
    targetSlideCount: slideCount
  };
}

module.exports = {
  generateInitialPresentation,
  materializePlan,
  normalizeSlideCount
};
