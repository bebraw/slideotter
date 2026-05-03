import { createStructuredResponse } from "./llm/client.ts";

type JsonObject = Record<string, unknown>;

type TextPoint = JsonObject & {
  body?: unknown;
  title?: unknown;
};

type GeneratedReference = JsonObject & {
  title?: unknown;
};

type GeneratedPlanSlide = JsonObject & {
  guardrails?: TextPoint[];
  keyPoints?: TextPoint[];
  resources?: TextPoint[];
  summary?: unknown;
  title?: unknown;
};

type GeneratedPlan = JsonObject & {
  references?: GeneratedReference[];
  slides?: GeneratedPlanSlide[];
};

type ProgressOptions = {
  onProgress?: ((progress: JsonObject) => void) | undefined;
};

type RepairOperation = JsonObject & {
  id?: unknown;
  text?: unknown;
};

type SemanticRepairRequest = {
  id: string;
  maxWords: number;
  path: Array<string | number>;
  purpose: string;
  text: string;
};

const danglingTailWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "because",
  "between",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "of",
  "on",
  "or",
  "than",
  "that",
  "the",
  "through",
  "to",
  "with",
  "without"
]);

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPathContainer(value: unknown): value is JsonObject | unknown[] {
  return isJsonObject(value) || Array.isArray(value);
}

function getPathChild(container: JsonObject | unknown[], key: string | number): unknown {
  if (Array.isArray(container) && typeof key === "number") {
    return container[key];
  }

  if (isJsonObject(container) && typeof key === "string") {
    return container[key];
  }

  return undefined;
}

function setPathChild(container: JsonObject | unknown[] | undefined, key: string | number, value: unknown): void {
  if (Array.isArray(container) && typeof key === "number") {
    container[key] = value;
  } else if (isJsonObject(container) && typeof key === "string") {
    container[key] = value;
  }
}

function isTextPoint(value: unknown): value is TextPoint {
  return isJsonObject(value);
}

function isGeneratedPlanSlide(value: unknown): value is GeneratedPlanSlide {
  return isJsonObject(value);
}

function isGeneratedReference(value: unknown): value is GeneratedReference {
  return isJsonObject(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isUnsupportedBibliographicClaim(value: unknown): boolean {
  return /\b(et al\.?|doi:|isbn|issn|journal|proceedings|vol\.|arxiv:|publisher)\b/i.test(String(value || ""));
}

function normalizeVisibleText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();
}

function cleanText(value: unknown): string {
  const normalized = normalizeVisibleText(value)
    .replace(/\b(title|summary|body):\s*/gi, "")
    .trim();

  return isUnsupportedBibliographicClaim(normalized) ? "" : normalized;
}

function hasDanglingEnding(value: unknown): boolean {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return false;
  }

  const rawTail = String(words[words.length - 1] || "").replace(/[^A-Za-z0-9-]+$/g, "");
  if (/^[A-Z]$/.test(rawTail)) {
    return false;
  }

  const tail = String(words[words.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
  return danglingTailWords.has(tail);
}

function createSemanticRepairSchema(): JsonObject {
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

function needsSemanticRepair(value: unknown, limit: number): boolean {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  return words.length > limit || hasDanglingEnding(value);
}

function collectSemanticRepairRequests(plan: GeneratedPlan): SemanticRepairRequest[] {
  const slides = Array.isArray(plan.slides) ? plan.slides.filter(isGeneratedPlanSlide) : [];
  const references = Array.isArray(plan.references) ? plan.references.filter(isGeneratedReference) : [];
  const requests: SemanticRepairRequest[] = [];

  slides.forEach((slide: GeneratedPlanSlide, slideIndex: number) => {
    const textFields: Array<{ field: "summary" | "title"; limit: number; path: Array<string | number>; purpose: string }> = [
      { field: "title", limit: 8, path: ["slides", slideIndex, "title"], purpose: "slide title" },
      { field: "summary", limit: 18, path: ["slides", slideIndex, "summary"], purpose: "slide summary" }
    ];
    textFields.forEach((item) => {
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

    const keyPoints = Array.isArray(slide.keyPoints) ? slide.keyPoints : [];
    const pointLists: Array<{ items: TextPoint[]; pathName: string; prefix: string }> = [
      { items: keyPoints, pathName: "keyPoints", prefix: "point" },
      { items: Array.isArray(slide.guardrails) ? slide.guardrails.filter(isTextPoint) : [], pathName: "guardrails", prefix: "guardrail" },
      { items: Array.isArray(slide.resources) ? slide.resources.filter(isTextPoint) : [], pathName: "resources", prefix: "resource" }
    ];
    pointLists.forEach((list) => {
      list.items.forEach((point: TextPoint, pointIndex: number) => {
        const pointFields: Array<{ field: "body" | "title"; limit: number; purpose: string }> = [
          { field: "title", limit: 4, purpose: "card title" },
          { field: "body", limit: 9, purpose: "card body" }
        ];
        pointFields.forEach((item) => {
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

  references.forEach((reference: GeneratedReference, referenceIndex: number) => {
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

function clonePlan(plan: GeneratedPlan): GeneratedPlan {
  return JSON.parse(JSON.stringify(plan || {}));
}

function setPathValue(target: JsonObject, pathParts: Array<string | number>, value: unknown): void {
  let current: JsonObject | unknown[] | undefined = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    if (key === undefined) {
      return;
    }

    const nextValue = getPathChild(current, key);
    if (!isPathContainer(nextValue)) {
      return;
    }

    current = nextValue;
  }

  const lastKey = pathParts[pathParts.length - 1];
  if (lastKey !== undefined) {
    setPathChild(current, lastKey, value);
  }
}

function applySemanticRepairs(plan: GeneratedPlan, requests: SemanticRepairRequest[], repairs: unknown): GeneratedPlan {
  const nextPlan = clonePlan(plan);
  const requestById: Map<string, SemanticRepairRequest> = new Map(requests.map((request) => [request.id, request]));

  (Array.isArray(repairs) ? repairs.filter(isJsonObject) : []).forEach((repair: RepairOperation) => {
    const request = typeof repair.id === "string" ? requestById.get(repair.id) : undefined;
    const text = cleanText(repair && repair.text);
    if (!request || !text) {
      return;
    }

    setPathValue(nextPlan, request.path, text);
  });

  return nextPlan;
}

async function semanticallyRepairPlanText(plan: GeneratedPlan, options: ProgressOptions = {}): Promise<GeneratedPlan> {
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
        message: `Semantic shortening failed; using deterministic text limits. ${errorMessage(error)}`,
        stage: "semantic-repair-failed"
      });
    }

    return plan;
  }
}

export {
  semanticallyRepairPlanText
};

export type {
  GeneratedPlan
};
