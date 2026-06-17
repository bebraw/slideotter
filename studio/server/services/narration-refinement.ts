import { createStructuredResponse } from "./llm/client.ts";
import { buildNarrationRefinementPrompts } from "./llm/prompts.ts";
import { getNarrationRefinementResponseSchema } from "./llm/schemas.ts";
import { validateSlideSpec } from "./validate-slide-spec.ts";
import { assertVisibleSlideTextQuality } from "./visible-text-quality-assertions.ts";

type JsonRecord = Record<string, unknown>;

type SlideSummary = {
  id: string;
  index?: number;
  title: string;
};

type RefinementProgress = (progress: JsonRecord) => void;

type RefineNarrationOptions = {
  context: unknown;
  existingSlideSpec: JsonRecord;
  nextSlide?: SlideSummary | null;
  onProgress?: RefinementProgress;
  previousSlide?: SlideSummary | null;
  slide: SlideSummary;
};

type RefinedNarration = {
  advance: "afterSpeech" | "manual";
  durationSeconds: number;
  script: string;
};

type RefineNarrationResult = {
  generation: JsonRecord;
  narration: RefinedNarration;
  rationale: string;
  slideSpec: JsonRecord;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function compactText(value: unknown, limit = 320): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}...` : normalized;
}

function estimateDurationSeconds(script: string): number {
  const words = script.match(/\S+/g) || [];
  return Math.min(180, Math.max(8, Math.round(words.length / 2.35)));
}

function normalizeDuration(value: unknown, script: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return estimateDurationSeconds(script);
  }

  return Math.min(180, Math.max(8, Math.round(parsed)));
}

function normalizeAdvance(value: unknown): "afterSpeech" | "manual" {
  return value === "manual" ? "manual" : "afterSpeech";
}

function collectItemText(item: unknown): JsonRecord {
  const record = asRecord(item);
  const title = compactText(record.title, 160);
  const body = compactText(record.body || record.text || record.value || record.summary, 260);
  return {
    ...(title ? { title } : {}),
    ...(body ? { body } : {})
  };
}

function collectVisibleText(slideSpec: JsonRecord): JsonRecord {
  const scalarKeys = [
    "eyebrow",
    "title",
    "summary",
    "note",
    "quote",
    "attribution",
    "caption",
    "signalsTitle",
    "guardrailsTitle",
    "resourcesTitle"
  ];
  const visible: JsonRecord = {};

  scalarKeys.forEach((key) => {
    const value = compactText(slideSpec[key]);
    if (value) {
      visible[key] = value;
    }
  });

  ["bullets", "cards", "guardrails", "resources", "signals"].forEach((key) => {
    const value = slideSpec[key];
    if (Array.isArray(value)) {
      visible[key] = value.map(collectItemText).filter((item) => Object.keys(item).length);
    }
  });

  const media = asRecord(slideSpec.media);
  if (Object.keys(media).length) {
    visible.media = {
      alt: compactText(media.alt, 180),
      caption: compactText(media.caption, 220),
      source: compactText(media.source, 180)
    };
  }

  const mediaItems = slideSpec.mediaItems;
  if (Array.isArray(mediaItems)) {
    visible.mediaItems = mediaItems.map((item) => {
      const mediaItem = asRecord(item);
      return {
        alt: compactText(mediaItem.alt, 180),
        caption: compactText(mediaItem.caption, 220),
        source: compactText(mediaItem.source, 180)
      };
    });
  }

  return visible;
}

function normalizeOverlapText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectVisibleTextValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectVisibleTextValues);
  }

  const record = asRecord(value);
  return Object.values(record).flatMap(collectVisibleTextValues);
}

function textNgrams(value: string, size: number): string[] {
  const words = normalizeOverlapText(value).split(/\s+/).filter(Boolean);
  if (words.length < size) {
    return [];
  }

  return words
    .slice(0, words.length - size + 1)
    .map((_word, index) => words.slice(index, index + size).join(" "));
}

function findVisibleTextReadout(script: string, visibleText: JsonRecord): string | null {
  const scriptText = normalizeOverlapText(script);
  if (!scriptText) {
    return null;
  }

  const repeatedPhrase = collectVisibleTextValues(visibleText)
    .flatMap((value) => textNgrams(value, 5))
    .find((phrase) => scriptText.includes(phrase));

  return repeatedPhrase || null;
}

function assertNarrationIsNotSlideReadout(narration: RefinedNarration, visibleText: JsonRecord): void {
  const repeatedPhrase = findVisibleTextReadout(narration.script, visibleText);
  if (repeatedPhrase) {
    throw new Error(`Narration refinement repeated visible slide text: "${repeatedPhrase}"`);
  }
}

function normalizeNarrationResponse(response: JsonRecord): RefinedNarration {
  const script = compactText(response.script, 1400);
  if (!script) {
    throw new Error("Narration refinement returned an empty script.");
  }

  return {
    advance: normalizeAdvance(response.advance),
    durationSeconds: normalizeDuration(response.durationSeconds, script),
    script
  };
}

function applyRefinedNarration(slideSpec: JsonRecord, narration: RefinedNarration, label: string): JsonRecord {
  const candidate = validateSlideSpec({
    ...slideSpec,
    narration
  });
  assertVisibleSlideTextQuality(candidate, label);
  return candidate;
}

async function refineNarrationForSlide(options: RefineNarrationOptions): Promise<RefineNarrationResult> {
  const visibleText = collectVisibleText(options.existingSlideSpec);
  const prompts = buildNarrationRefinementPrompts({
    context: options.context,
    existingNarration: options.existingSlideSpec.narration,
    nextSlide: options.nextSlide || {},
    previousSlide: options.previousSlide || {},
    slide: options.slide,
    visibleText
  });

  const response = await createStructuredResponse({
    developerPrompt: prompts.developerPrompt,
    maxOutputTokens: 900,
    onProgress: options.onProgress,
    promptContext: {
      slideId: options.slide.id,
      workflowName: "narration-refinement"
    },
    schema: getNarrationRefinementResponseSchema(),
    schemaName: "narration_refinement",
    userPrompt: prompts.userPrompt,
    workflowName: "narration-refinement"
  });
  const narration = normalizeNarrationResponse(response.data);
  assertNarrationIsNotSlideReadout(narration, visibleText);
  const slideSpec = applyRefinedNarration(
    options.existingSlideSpec,
    narration,
    `refined narration for ${options.slide.id}`
  );

  return {
    generation: {
      mode: "llm",
      model: response.model,
      provider: response.provider
    },
    narration,
    rationale: compactText(response.data.rationale, 180),
    slideSpec
  };
}

export {
  applyRefinedNarration,
  assertNarrationIsNotSlideReadout,
  collectVisibleText,
  findVisibleTextReadout,
  refineNarrationForSlide,
  normalizeNarrationResponse,
  type RefinedNarration,
  type RefineNarrationResult,
  type SlideSummary
};
