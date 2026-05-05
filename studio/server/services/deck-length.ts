import {
  compactActiveSlideIndices,
  getSlides,
  insertStructuredSlide,
  readSlideSpec,
  restoreSkippedSlide,
  skipStructuredSlide
} from "./slides.ts";
import { createStructuredResponse, getLlmStatus } from "./llm/client.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";

const allowedModes = new Set(["appendix-first", "balanced", "front-loaded", "manual", "semantic"]);

type JsonRecord = Record<string, unknown>;

type SlideInfo = {
  archived?: boolean;
  id: string;
  index: number;
  skipMeta?: JsonRecord | null;
  skipReason?: string;
  skipped?: boolean;
  title: string;
};

type SlideSpec = JsonRecord & {
  bullets?: unknown;
  cards?: unknown;
  eyebrow?: unknown;
  guardrails?: unknown;
  note?: unknown;
  resources?: unknown;
  resourcesTitle?: unknown;
  signals?: unknown;
  summary?: unknown;
  title?: unknown;
  type?: unknown;
};

type LengthMode = "appendix-first" | "balanced" | "front-loaded" | "manual" | "semantic";

type LengthAction = JsonRecord & {
  action: "insert" | "restore" | "skip";
  confidence?: string;
  reason?: string;
  slideId?: string;
  slideSpec?: SlideSpec;
  targetIndex?: unknown;
  title?: string;
};

type DeckLengthOptions = {
  actions?: unknown;
  all?: unknown;
  includeSkippedForRestore?: unknown;
  mode?: unknown;
  onProgress?: ((event: JsonRecord) => void) | undefined;
  slideId?: unknown;
  slideIds?: unknown;
  targetCount?: unknown;
};

type SemanticPoint = {
  body?: unknown;
  title?: unknown;
};

type SemanticAction = JsonRecord & {
  action?: unknown;
  confidence?: unknown;
  keyPoints?: unknown;
  reason?: unknown;
  slideId?: unknown;
  summary?: unknown;
  targetIndex?: unknown;
  title?: unknown;
};

const expansionSignalTitles = ["Context", "Example", "Connection", "Takeaway"];
const expansionGuardrailTitles = ["Fit", "Specifics", "Pace"];
const localExpansionTitles = ["Concrete example", "Practical detail", "Section bridge", "Audience takeaway", "Supporting proof"];

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function textItems(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function normalizeMode(value: unknown): LengthMode {
  const mode = String(value || "");
  return allowedModes.has(mode) ? mode as LengthMode : "balanced";
}

function normalizeTargetCount(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, parsed);
}

function getSkippedSlides(): SlideInfo[] {
  return (getSlides({ includeSkipped: true }) as SlideInfo[])
    .filter((slide) => slide.skipped && !slide.archived)
    .sort((left, right) => {
      const leftIndex = Number(left.skipMeta && left.skipMeta.previousIndex);
      const rightIndex = Number(right.skipMeta && right.skipMeta.previousIndex);

      if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex) && leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      if (left.index !== right.index) {
        return left.index - right.index;
      }

      return left.id.localeCompare(right.id);
    });
}

function classifySlide(slide: SlideInfo, slideSpec: SlideSpec): string {
  const text = [
    slide.title,
    slideSpec.eyebrow,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.resourcesTitle
  ].join(" ").toLowerCase();

  if (/(appendix|reference|resource|archive|implementation|codebase|technical|detail|diagnostic|maintenance|roadmap|next improvement)/.test(text)) {
    return "supporting detail";
  }

  if (/(summary|closing|next step|handoff|decision|validation|workflow|overview|tour|map)/.test(text)) {
    return "narrative anchor";
  }

  return "supporting slide";
}

function scoreSkipCandidate(slide: SlideInfo, slideSpec: SlideSpec, activeCount: number, mode: LengthMode): number {
  const label = classifySlide(slide, slideSpec);
  let score = 0;

  if (label === "supporting detail") {
    score += 40;
  } else if (label === "narrative anchor") {
    score -= 30;
  } else {
    score += 10;
  }

  if (slideSpec.type === "content") {
    score += 12;
  }
  if (slideSpec.type === "summary" || slideSpec.type === "cover") {
    score -= 35;
  }

  const midpoint = (activeCount + 1) / 2;
  score += Math.max(0, 12 - Math.abs(slide.index - midpoint));

  if (mode === "front-loaded") {
    score += slide.index > midpoint ? 16 : -8;
  }

  if (mode === "appendix-first" && label === "supporting detail") {
    score += 24;
  }

  if (slide.index === 1 || slide.index === activeCount) {
    score -= 200;
  }

  return score;
}

function reasonForSkip(slide: SlideInfo, slideSpec: SlideSpec, mode: LengthMode): string {
  const label = classifySlide(slide, slideSpec);

  if (label === "supporting detail") {
    return "Supporting detail can be restored when the deck has more room.";
  }

  if (mode === "front-loaded") {
    return "Later narrative detail can be skipped for a shorter front-loaded version.";
  }

  if (mode === "appendix-first") {
    return "Reference-like material is a good first candidate for a shorter deck.";
  }

  return "Balanced scaling keeps the deck arc while trimming secondary material.";
}

function sentence(value: unknown, fallback: string, limit = 14): string {
  const words = String(value || fallback || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const trimmed = words.slice(0, limit);
  while (trimmed.length > 4 && /[,;:]$/.test(String(trimmed[trimmed.length - 1] || ""))) {
    trimmed.pop();
  }

  return trimmed.join(" ") || fallback;
}

function slugPart(value: unknown, fallback = "item"): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return slug || fallback;
}

function displayTopic(value: unknown, fallback: string): string {
  const topic = sentence(value, fallback, 5)
    .replace(/^point\s+\d+$/i, "")
    .replace(/^expansion\s+\d+$/i, "")
    .replace(/^added detail\s+\d+$/i, "")
    .trim();

  return topic || fallback;
}

function expansionFallbackTitle(index: number): string {
  return localExpansionTitles[Math.max(0, index - 1) % localExpansionTitles.length] || "Supporting detail";
}

function safeExpansionPointTitle(value: unknown, pointIndex: number): string {
  const fallback = expansionSignalTitles[pointIndex] || "Detail";
  const title = sentence(value, fallback, 3);
  return /^point\s+\d+$/i.test(title) ? fallback : title;
}

function safeExpansionPointBody(value: unknown, topic: string, pointIndex: number): string {
  const fallbackBodies = [
    `${topic} belongs with the nearby slides in this section.`,
    `A concrete example makes the idea easier to remember.`,
    `The detail connects back to the deck's main question.`,
    `The slide leaves one clear takeaway before the story moves on.`
  ];
  const fallback = fallbackBodies[pointIndex] ?? fallbackBodies[0] ?? "The detail stays concise.";
  return sentence(value, fallback, 8);
}

function getSlidePlanningContext(slides: SlideInfo[]) {
  return slides.map((slide) => {
    const slideSpec = readSlideSpec(slide.id);
    const visibleText = [
      slideSpec.eyebrow,
      slideSpec.title,
      slideSpec.summary,
      slideSpec.note,
      ...textItems(slideSpec.cards).flatMap((item) => [item.title, item.body]),
      ...textItems(slideSpec.signals).flatMap((item) => [item.title, item.body]),
      ...textItems(slideSpec.guardrails).flatMap((item) => [item.title, item.body]),
      ...textItems(slideSpec.bullets).flatMap((item) => [item.title, item.body]),
      ...textItems(slideSpec.resources).flatMap((item) => [item.title, item.body])
    ].filter(Boolean).join(" ");

    return {
      id: slide.id,
      index: slide.index,
      title: slide.title,
      type: slideSpec.type,
      role: classifySlide(slide, slideSpec),
      summary: sentence(visibleText, slide.title, 34)
    };
  });
}

function createSemanticLengthSchema() {
  return {
    additionalProperties: false,
    properties: {
      actions: {
        items: {
          additionalProperties: false,
          properties: {
            action: { enum: ["skip", "insert"], type: "string" },
            confidence: { enum: ["high", "medium", "low"], type: "string" },
            keyPoints: {
              items: {
                additionalProperties: false,
                properties: {
                  body: { type: "string" },
                  title: { type: "string" }
                },
                required: ["title", "body"],
                type: "object"
              },
              maxItems: 3,
              type: "array"
            },
            reason: { type: "string" },
            slideId: { type: "string" },
            summary: { type: "string" },
            targetIndex: { type: "number" },
            title: { type: "string" }
          },
          required: ["action", "confidence", "keyPoints", "reason", "slideId", "summary", "targetIndex", "title"],
          type: "object"
        },
        type: "array"
      },
      summary: { type: "string" }
    },
    required: ["summary", "actions"],
    type: "object"
  };
}

function toSemanticContentSlideSpec(action: SemanticAction, index: number): SlideSpec {
  const title = displayTopic(action.title, expansionFallbackTitle(index));
  const prefix = slugPart(title, `expansion-${index}`);
  const points: SemanticPoint[] = Array.isArray(action.keyPoints) ? action.keyPoints.map(asRecord) : [];
  const filledPoints = points.slice(0, 3);

  while (filledPoints.length < 3) {
    filledPoints.push({
      body: safeExpansionPointBody(undefined, title, filledPoints.length),
      title: expansionSignalTitles[filledPoints.length] || "Detail"
    });
  }

  return validateSlideSpec({
    eyebrow: "Added detail",
    guardrails: [
      {
        body: "This detail belongs with the nearby slides.",
        id: `${prefix}-guardrail-1`,
        title: expansionGuardrailTitles[0]
      },
      {
        body: "One concrete example carries the point.",
        id: `${prefix}-guardrail-2`,
        title: expansionGuardrailTitles[1]
      },
      {
        body: "The section keeps moving without extra setup.",
        id: `${prefix}-guardrail-3`,
        title: expansionGuardrailTitles[2]
      }
    ],
    guardrailsTitle: "Checks",
    layout: "standard",
    signals: filledPoints.map((point, pointIndex) => ({
      body: safeExpansionPointBody(point.body, title, pointIndex),
      id: `${prefix}-signal-${pointIndex + 1}`,
      title: safeExpansionPointTitle(point.title, pointIndex)
    })),
    signalsTitle: "What to notice",
    summary: sentence(action.summary || action.reason, `${title} adds one concrete layer to this section.`, 13),
    title,
    type: "content"
  });
}

function createSkipActions(activeSlides: SlideInfo[], targetCount: number, mode: LengthMode): LengthAction[] {
  const skipCount = Math.max(0, activeSlides.length - targetCount);
  if (!skipCount) {
    return [];
  }

  return activeSlides
    .map((slide) => {
      const slideSpec = readSlideSpec(slide.id);
      const score = scoreSkipCandidate(slide, slideSpec, activeSlides.length, mode);

      return {
        action: "skip" as const,
        confidence: score > 45 ? "high" : score > 15 ? "medium" : "low",
        reason: reasonForSkip(slide, slideSpec, mode),
        score,
        slideId: slide.id,
        title: slide.title
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.slideId.localeCompare(left.slideId);
    })
    .slice(0, skipCount)
    .map(({ score: _score, ...entry }) => entry);
}

function createRestoreActions(skippedSlides: SlideInfo[], restoreCount: number): LengthAction[] {
  return skippedSlides.slice(0, Math.max(0, restoreCount)).map((slide) => ({
    action: "restore",
    confidence: "medium",
    reason: slide.skipReason || "Restores a slide hidden by a previous length-scaling pass.",
    slideId: slide.id,
    title: slide.title
  }));
}

function createLocalInsertActions(activeSlides: SlideInfo[], insertCount: number): LengthAction[] {
  if (!insertCount) {
    return [];
  }

  const finalIndex = activeSlides.length;
  const insertionMax = Math.max(2, finalIndex);

  return Array.from({ length: insertCount }, (_unused, actionIndex) => {
    const targetIndex = Math.min(insertionMax, 2 + actionIndex);
    const beforeSlide = activeSlides[Math.max(0, targetIndex - 2)];
    const afterSlide = activeSlides[Math.min(activeSlides.length - 1, targetIndex - 1)];
    const title = expansionFallbackTitle(actionIndex + 1);
    const reason = afterSlide && beforeSlide
      ? `Adds semantic depth between "${beforeSlide.title}" and "${afterSlide.title}" instead of stretching existing slides.`
      : "Adds one concrete detail slide instead of stretching existing slides.";

    return {
      action: "insert",
      confidence: "medium",
      reason,
      slideSpec: toSemanticContentSlideSpec({
        keyPoints: [
          { body: `${beforeSlide ? beforeSlide.title : "The prior idea"} gets one concrete example.`, title: "Example" },
          { body: "The detail names what changes in practice.", title: "Shift" },
          { body: "The point connects to the next slide.", title: "Link" },
          { body: "The section keeps one clear takeaway.", title: "Takeaway" }
        ],
        reason,
        summary: "The section gets one concrete layer before moving forward.",
        title
      }, targetIndex),
      targetIndex,
      title
    };
  });
}

function normalizeSemanticSkipActions(actions: unknown, activeSlides: SlideInfo[], skipCount: number): LengthAction[] {
  const activeById = new Map<string, SlideInfo>(activeSlides.map((slide) => [slide.id, slide]));
  const protectedIds = new Set<string>(
    [activeSlides[0]?.id, activeSlides[activeSlides.length - 1]?.id].filter((id): id is string => Boolean(id))
  );
  const seen = new Set<string>();
  const normalized: LengthAction[] = [];

  (Array.isArray(actions) ? actions : []).map(asRecord).forEach((action) => {
    const slideId = typeof action.slideId === "string" ? action.slideId : "";
    if (action.action !== "skip" || !activeById.has(slideId) || protectedIds.has(slideId) || seen.has(slideId)) {
      return;
    }

    const slide = activeById.get(slideId);
    if (!slide) {
      return;
    }
    seen.add(slideId);
    normalized.push({
      action: "skip",
      confidence: typeof action.confidence === "string" ? action.confidence : "medium",
      reason: sentence(action.reason, "Semantic length planning marked this as restorable supporting detail.", 18),
      slideId: slide.id,
      title: slide.title
    });
  });

  if (normalized.length >= skipCount) {
    return normalized.slice(0, skipCount);
  }

  const fallback = createSkipActions(activeSlides, activeSlides.length - skipCount, "balanced")
    .filter((action) => !seen.has(action.slideId || ""));
  return [
    ...normalized,
    ...fallback
  ].slice(0, skipCount);
}

function normalizeSemanticInsertActions(actions: unknown, activeSlides: SlideInfo[], insertCount: number): LengthAction[] {
  const normalized: LengthAction[] = [];
  const maxIndex = Math.max(1, activeSlides.length + 1);

  (Array.isArray(actions) ? actions : []).map(asRecord).forEach((action, actionIndex) => {
    if (action.action !== "insert" || normalized.length >= insertCount) {
      return;
    }

    const requestedIndex = Number(action.targetIndex);
    const targetIndex = Number.isFinite(requestedIndex)
      ? Math.min(Math.max(1, Math.round(requestedIndex)), maxIndex)
      : Math.min(Math.max(2, actionIndex + 2), maxIndex);
    normalized.push({
      action: "insert",
      confidence: typeof action.confidence === "string" ? action.confidence : "medium",
      reason: sentence(action.reason, "Semantic length planning added detail where the deck had room to expand.", 18),
      slideSpec: toSemanticContentSlideSpec(action, targetIndex),
      targetIndex,
      title: sentence(action.title, `Expansion ${actionIndex + 1}`, 8)
    });
  });

  if (normalized.length >= insertCount) {
    return normalized.slice(0, insertCount);
  }

  return [
    ...normalized,
    ...createLocalInsertActions(activeSlides, insertCount - normalized.length)
  ];
}

async function createSemanticActions(activeSlides: SlideInfo[], targetCount: number, skippedSlides: SlideInfo[], options: DeckLengthOptions = {}): Promise<LengthAction[]> {
  const currentCount = activeSlides.length;
  const restoreCount = Math.max(0, Math.min(skippedSlides.length, targetCount - currentCount));
  const restoreActions = createRestoreActions(skippedSlides, restoreCount);
  const insertCount = Math.max(0, targetCount - currentCount - restoreActions.length);
  const skipCount = Math.max(0, currentCount - targetCount);
  const llmStatus = getLlmStatus();

  if (!llmStatus.available) {
    return targetCount < currentCount
      ? createSkipActions(activeSlides, targetCount, "balanced")
      : [
          ...restoreActions,
          ...createLocalInsertActions(activeSlides, insertCount)
        ];
  }

  try {
    const result = await createStructuredResponse({
      developerPrompt: [
        "You plan reversible presentation length changes.",
        "For shrinking, choose slides that are least essential to the narrative and can be skipped temporarily.",
        "For growing, propose new concrete detail slides that add examples, tradeoffs, evidence, or walkthrough depth.",
        "Do not delete content. Do not rewrite existing slides. Keep cover and final handoff slides unless absolutely necessary.",
        "Return only the requested action count."
      ].join("\n"),
      maxOutputTokens: Math.max(900, (skipCount + insertCount) * 220),
      onProgress: options.onProgress,
      schema: createSemanticLengthSchema(),
      schemaName: "semantic_deck_length_plan",
      userPrompt: JSON.stringify({
        activeSlides: getSlidePlanningContext(activeSlides),
        actionCounts: {
          insert: insertCount,
          restore: restoreActions.length,
          skip: skipCount
        },
        currentCount,
        targetCount,
        task: targetCount < currentCount
          ? `Choose exactly ${skipCount} active slides to skip.`
          : `Propose exactly ${insertCount} new slides to insert after restoring ${restoreActions.length} skipped slides.`
      }, null, 2)
    });

    return targetCount < currentCount
      ? normalizeSemanticSkipActions(asRecord(result.data).actions, activeSlides, skipCount)
      : [
          ...restoreActions,
          ...normalizeSemanticInsertActions(asRecord(result.data).actions, activeSlides, insertCount)
        ];
  } catch (error) {
    return targetCount < currentCount
      ? createSkipActions(activeSlides, targetCount, "balanced")
      : [
          ...restoreActions,
          ...createLocalInsertActions(activeSlides, insertCount)
        ];
  }
}

function summarizeActions(actions: LengthAction[]): string {
  const skipped = actions.filter((entry) => entry.action === "skip").length;
  const restored = actions.filter((entry) => entry.action === "restore").length;
  const inserted = actions.filter((entry) => entry.action === "insert").length;

  if (!actions.length) {
    return "The active deck already matches the requested length.";
  }

  return [
    skipped ? `${skipped} slide${skipped === 1 ? "" : "s"} to skip` : "",
    restored ? `${restored} to restore` : "",
    inserted ? `${inserted} new detail slide${inserted === 1 ? "" : "s"} to insert` : ""
  ].filter(Boolean).join(", ") + ".";
}

function planDeckLength(options: DeckLengthOptions = {}) {
  const activeSlides = getSlides();
  const skippedSlides = getSkippedSlides();
  const targetCount = normalizeTargetCount(options.targetCount, activeSlides.length);
  const mode = normalizeMode(options.mode);
  const restoreCount = Math.max(0, targetCount - activeSlides.length);
  const actions = targetCount < activeSlides.length
    ? createSkipActions(activeSlides, targetCount, mode)
    : createRestoreActions(skippedSlides, restoreCount);
  const nextCount = activeSlides.length
    - actions.filter((entry) => entry.action === "skip").length
    + actions.filter((entry) => entry.action === "restore").length
    + actions.filter((entry) => entry.action === "insert").length;

  return {
    actions,
    currentCount: activeSlides.length,
    mode,
    nextCount,
    restoreCandidates: options.includeSkippedForRestore === false ? [] : skippedSlides.map((slide) => ({
      previousIndex: slide.skipMeta && slide.skipMeta.previousIndex,
      reason: slide.skipReason || "",
      slideId: slide.id,
      skippedAt: slide.skipMeta && slide.skipMeta.skippedAt,
      title: slide.title
    })),
    skippedCount: skippedSlides.length,
    summary: summarizeActions(actions),
    targetCount
  };
}

async function planDeckLengthSemantic(options: DeckLengthOptions = {}) {
  const activeSlides = getSlides();
  const skippedSlides = getSkippedSlides();
  const targetCount = normalizeTargetCount(options.targetCount, activeSlides.length);
  const mode = normalizeMode(options.mode);

  if (mode !== "semantic") {
    return planDeckLength(options);
  }

  const actions = await createSemanticActions(activeSlides, targetCount, skippedSlides, options);
  const nextCount = activeSlides.length
    - actions.filter((entry) => entry.action === "skip").length
    + actions.filter((entry) => entry.action === "restore").length
    + actions.filter((entry) => entry.action === "insert").length;

  return {
    actions,
    currentCount: activeSlides.length,
    mode,
    nextCount,
    restoreCandidates: options.includeSkippedForRestore === false ? [] : skippedSlides.map((slide) => ({
      previousIndex: slide.skipMeta && slide.skipMeta.previousIndex,
      reason: slide.skipReason || "",
      slideId: slide.id,
      skippedAt: slide.skipMeta && slide.skipMeta.skippedAt,
      title: slide.title
    })),
    skippedCount: skippedSlides.length,
    summary: summarizeActions(actions),
    targetCount
  };
}

function createLengthProfile(targetCount: number) {
  const activeSlides = getSlides();
  const skippedSlides = getSkippedSlides();

  return {
    activeCount: activeSlides.length,
    skippedCount: skippedSlides.length,
    targetCount,
    updatedAt: new Date().toISOString()
  };
}

function normalizeAction(value: unknown): LengthAction {
  const action = asRecord(value);
  const actionType = action.action === "insert" || action.action === "restore" || action.action === "skip"
    ? action.action
    : "skip";
  return {
    ...action,
    action: actionType,
    reason: typeof action.reason === "string" ? action.reason : "",
    slideId: typeof action.slideId === "string" ? action.slideId : "",
    title: typeof action.title === "string" ? action.title : ""
  };
}

function applyDeckLengthPlan(options: DeckLengthOptions = {}) {
  const targetCount = normalizeTargetCount(options.targetCount, getSlides().length);
  const actions: LengthAction[] = Array.isArray(options.actions) && options.actions.length
    ? options.actions.map(normalizeAction)
    : planDeckLength({
        includeSkippedForRestore: true,
        mode: options.mode,
        targetCount
      }).actions;
  let restoredSlides = 0;
  let skippedSlides = 0;
  let insertedSlides = 0;

  actions.forEach((entry) => {
    if (entry && entry.action === "insert" && entry.slideSpec) {
      insertStructuredSlide(entry.slideSpec, entry.targetIndex);
      insertedSlides += 1;
      return;
    }

    if (!entry || typeof entry.slideId !== "string" || !entry.slideId) {
      return;
    }

    if (entry.action === "skip") {
      skipStructuredSlide(entry.slideId, {
        reason: entry.reason,
        targetCount
      });
      skippedSlides += 1;
      return;
    }

    if (entry.action === "restore") {
      restoreSkippedSlide(entry.slideId);
      restoredSlides += 1;
      return;
    }

  });

  compactActiveSlideIndices();

  return {
    actions,
    insertedSlides,
    lengthProfile: createLengthProfile(targetCount),
    restoredSlides,
    skippedSlides,
    slides: getSlides()
  };
}

function restoreSkippedSlides(options: DeckLengthOptions = {}) {
  const skippedSlides = getSkippedSlides();
  const skippedIds = new Set(skippedSlides.map((slide) => slide.id));
  const ids = options.all === true
    ? skippedSlides.map((slide) => slide.id)
    : Array.isArray(options.slideIds)
      ? options.slideIds.map(String)
      : typeof options.slideId === "string" && options.slideId
        ? [options.slideId]
        : [];
  const uniqueIds = [...new Set(ids)];

  let restoredSlides = 0;

  uniqueIds.forEach((slideId) => {
    if (skippedIds.has(slideId)) {
      restoredSlides += 1;
    }

    restoreSkippedSlide(slideId);
  });
  compactActiveSlideIndices();

  return {
    lengthProfile: createLengthProfile(getSlides().length),
    restoredSlides,
    slides: getSlides()
  };
}

export {
  applyDeckLengthPlan,
  planDeckLength,
  planDeckLengthSemantic,
  restoreSkippedSlides
};
