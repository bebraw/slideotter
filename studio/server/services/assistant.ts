import { getDeckContext } from "./state.ts";
import { getSlide, getSlides } from "./slides.ts";
import { readSlideSpec } from "./slides.ts";
import { drillSelectionWordingSlide, drillWordingSlide, ideateDeckStructure, ideateStructureSlide, ideateThemeSlide, ideateSlide, redoLayoutSlide } from "./operations.ts";
import { validateDeck } from "./validate.ts";
import { appendSessionMessages, createMessage, getSession } from "./sessions.ts";
import { describeSelectionScope, normalizeSelectionScope } from "./selection-scope.ts";

type JsonRecord = Record<string, unknown>;

type SlideSummary = {
  index: number;
  title: string;
};

type WorkflowResult = {
  candidates?: unknown[];
  dryRun?: unknown;
  generation?: unknown;
  previews?: unknown;
  slideId?: unknown;
  summary?: unknown;
  variants?: unknown[];
};

type ValidationResult = {
  ok?: unknown;
};

type AssistantOptions = {
  candidateCount?: unknown;
  dryRun?: unknown;
  message?: unknown;
  onProgress?: ((progress: JsonRecord) => void) | undefined;
  selection?: unknown;
  sessionId?: unknown;
  slideId?: unknown;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSelection(selection: unknown) {
  const selectionRecord = asRecord(selection);
  if (!Object.keys(selectionRecord).length) {
    return null;
  }

  const text = normalizeText(selectionRecord.text).slice(0, 500);
  if (!text) {
    return null;
  }

  return {
    label: normalizeText(selectionRecord.label).slice(0, 80) || "Slide text",
    path: normalizeText(selectionRecord.path).slice(0, 120),
    slideId: normalizeText(selectionRecord.slideId).slice(0, 80),
    slideIndex: Number.isFinite(Number(selectionRecord.slideIndex)) ? Number(selectionRecord.slideIndex) : null,
    text
  };
}

function normalizeAssistantSelection(selection: unknown, slideId: string) {
  if (!slideId) {
    return null;
  }

  try {
    return normalizeSelectionScope(selection, {
      slideId,
      slideSpec: readSlideSpec(slideId)
    });
  } catch (error) {
    return null;
  }
}

function isSelectionAwareMessage(message: string): boolean {
  return /(rewrite|shorten|clarif(?:y|ier)|clearer|more direct|change tone|tone|turn .*quote|quote slide|into a? quote|tighten|wording)/i.test(message);
}

function hasExplicitDeckScope(message: string): boolean {
  return /\b(whole deck|entire deck|deck-wide|all slides|deck)\b/i.test(message);
}

function detectIntent(message: unknown): string {
  const normalized = normalizeText(message).toLowerCase();

  if (!normalized) {
    return "empty";
  }

  if (/(tighten|wording|clarity|clearer|condense copy|shorten copy|drill)/.test(normalized)) {
    return "drill-wording";
  }

  if (/(presentation structure|deck structure|deck outline|deck plan|batch author deck|ideate outline|outline variants|structure for this deck)/.test(normalized)) {
    return "ideate-deck-structure";
  }

  if (/(ideate structure|structure variants|restructure|structural pass|structure pass)/.test(normalized)) {
    return "ideate-structure";
  }

  if (/(ideate theme|theme variants|retheme|theme direction|theme pass)/.test(normalized)) {
    return "ideate-theme";
  }

  if (/(redo layout|rework layout|layout|reflow|rebalance|rearrange|reshuffle)/.test(normalized)) {
    return "redo-layout";
  }

  if (/(ideate|variant|generate|rewrite|explore)/.test(normalized)) {
    return "ideate-slide";
  }

  if (/(validate|check|verify|quality|gate)/.test(normalized)) {
    return "validate";
  }

  return "reply";
}

function buildHelpReply(options: AssistantOptions = {}) {
  const slideId = typeof options.slideId === "string" ? options.slideId : "";
  const slide = slideId ? getSlide(slideId) : null;
  const slideLine = slide
    ? `Selected: ${slide.index}. ${slide.title}.`
    : "No slide selected.";

  return [
    slideLine,
    "Try: ideate variants, tighten wording, redo layout, ideate deck plans, or validate."
  ].join(" ");
}

function buildIdeateReply(result: WorkflowResult, slide: SlideSummary) {
  return [
    normalizeText(result.summary),
    `Session candidates for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildValidationReply(result: ValidationResult, includeRender: boolean) {
  const status = result.ok ? "passed" : "found issues";
  return includeRender
    ? `Ran full render validation and ${status}.`
    : `Ran geometry and text validation and ${status}.`;
}

function buildDrillWordingReply(result: WorkflowResult, slide: SlideSummary) {
  return [
    normalizeText(result.summary),
    `Wording pass for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildIdeateThemeReply(result: WorkflowResult, slide: SlideSummary) {
  return [
    normalizeText(result.summary),
    `Theme variants for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildIdeateStructureReply(result: WorkflowResult, slide: SlideSummary) {
  return [
    normalizeText(result.summary),
    `Structure variants for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildIdeateDeckStructureReply(result: WorkflowResult) {
  return [
    normalizeText(result.summary),
    "Inspect one deck-plan candidate before applying."
  ].join(" ");
}

function buildRedoLayoutReply(result: WorkflowResult, slide: SlideSummary) {
  return [
    normalizeText(result.summary),
    `Layout variants for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function getVariantCount(result: WorkflowResult): number {
  return Array.isArray(result.variants) ? result.variants.length : 0;
}

async function handleAssistantMessage(options: AssistantOptions = {}) {
  const sessionId = normalizeText(options.sessionId) || "default";
  const message = normalizeText(options.message);
  const slideId = normalizeText(options.slideId);
  const selectionScope = normalizeAssistantSelection(options.selection, slideId);
  const selection = selectionScope || normalizeSelection(options.selection);
  const intent = detectIntent(message);
  const userMessage = createMessage("user", message || "(empty)", selection ? { selection } : {});

  appendSessionMessages(sessionId, [userMessage]);

  if (intent === "empty" || intent === "reply") {
    const reply = createMessage("assistant", buildHelpReply(options), {
      action: {
        status: "answered",
        type: "reply"
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      reply,
      session
    };
  }

  if (intent === "validate") {
    const includeRender = /render|full/.test(message.toLowerCase());
    const validation = await validateDeck({ includeRender });
    const reply = createMessage("assistant", buildValidationReply(validation, includeRender), {
      action: {
        includeRender,
        ok: validation.ok,
        status: "completed",
        type: "validate"
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      reply,
      session,
      validation
    };
  }

  if (intent === "ideate-deck-structure") {
    const result = await ideateDeckStructure({
      dryRun: options.dryRun !== false,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildIdeateDeckStructureReply(result), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        status: "completed",
        type: "ideate-deck-structure",
        variantCount: result.candidates.length
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      context: getDeckContext(),
      deckStructureCandidates: result.candidates,
      reply,
      session,
      summary: result.summary
    };
  }

  if (!slideId) {
    const reply = createMessage("assistant", "Select a slide before asking me to run slide-specific workflows.", {
      action: {
        status: "blocked",
        type: intent
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      reply,
      session
    };
  }

  const slide = getSlide(slideId);

  if (selectionScope && isSelectionAwareMessage(message) && !hasExplicitDeckScope(message)) {
    const result = await drillSelectionWordingSlide(slideId, selectionScope, {
      candidateCount: options.candidateCount,
      command: message,
      dryRun: true,
      onProgress: options.onProgress
    });
    const scopeLabel = describeSelectionScope(selectionScope);
    const reply = createMessage("assistant", `${result.summary} Compare ${scopeLabel.toLowerCase()} before applying.`, {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        scope: {
          kind: selectionScope.kind,
          label: scopeLabel,
          slideId
        },
        slideId,
        status: "completed",
        type: "selection-command",
        variantCount: getVariantCount(result)
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      context: getDeckContext(),
      previews: result.previews,
      reply,
      session,
      slideId: result.slideId,
      summary: result.summary,
      transientVariants: result.variants,
      variants: []
    };
  }

  if (intent === "ideate-structure") {
    const result = await ideateStructureSlide(slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildIdeateStructureReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: slideId,
        status: "completed",
        type: "ideate-structure",
        variantCount: result.variants.length
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      context: getDeckContext(),
      previews: result.previews,
      reply,
      session,
      slideId: result.slideId,
      summary: result.summary,
      transientVariants: result.variants,
      variants: []
    };
  }

  if (intent === "ideate-theme") {
    const result = await ideateThemeSlide(slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildIdeateThemeReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: slideId,
        status: "completed",
        type: "ideate-theme",
        variantCount: result.variants.length
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      context: getDeckContext(),
      previews: result.previews,
      reply,
      session,
      slideId: result.slideId,
      summary: result.summary,
      transientVariants: result.variants,
      variants: []
    };
  }

  if (intent === "drill-wording") {
    const result = await drillWordingSlide(slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildDrillWordingReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: slideId,
        status: "completed",
        type: "drill-wording",
        variantCount: result.variants.length
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      context: getDeckContext(),
      previews: result.previews,
      reply,
      session,
      slideId: result.slideId,
      summary: result.summary,
      transientVariants: result.variants,
      variants: []
    };
  }

  if (intent === "redo-layout") {
    const result = await redoLayoutSlide(slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildRedoLayoutReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: slideId,
        status: "completed",
        type: "redo-layout",
        variantCount: result.variants.length
      }
    });
    const session = appendSessionMessages(sessionId, [reply]);

    return {
      action: reply.action,
      context: getDeckContext(),
      previews: result.previews,
      reply,
      session,
      slideId: result.slideId,
      summary: result.summary,
      transientVariants: result.variants,
      variants: []
    };
  }

  const result = await ideateSlide(slideId, {
    candidateCount: options.candidateCount,
    dryRun: true,
    onProgress: options.onProgress
  });
  const reply = createMessage("assistant", buildIdeateReply(result, slide), {
    action: {
      dryRun: result.dryRun,
      generation: result.generation,
      slideId: slideId,
      status: "completed",
      type: "ideate-slide",
      variantCount: result.variants.length
    }
  });
  const session = appendSessionMessages(sessionId, [reply]);

  return {
    action: reply.action,
    context: getDeckContext(),
    previews: result.previews,
    reply,
    session,
    slideId: result.slideId,
    summary: result.summary,
    transientVariants: result.variants,
    variants: []
  };
}

function getAssistantSession(sessionId = "default") {
  return getSession(sessionId);
}

function getAssistantSuggestions() {
  const slides = getSlides();
  return [
    {
      id: "suggestion-deck-structure",
      label: "Ideate deck plans",
      prompt: "Ideate deck plans for this deck."
    },
    {
      id: "suggestion-ideate",
      label: "Ideate this slide",
      prompt: slides.length ? "Ideate five candidates for the selected slide." : "Ideate five candidates."
    },
    {
      id: "suggestion-wording",
      label: "Tighten wording",
      prompt: slides.length ? "Tighten the wording on this slide." : "Tighten the wording on the selected slide."
    },
    {
      id: "suggestion-structure",
      label: "Ideate structure",
      prompt: slides.length ? "Ideate structure variants for this slide." : "Ideate structure variants for the selected slide."
    },
    {
      id: "suggestion-theme",
      label: "Ideate theme",
      prompt: slides.length ? "Ideate theme variants for this slide." : "Ideate theme variants for the selected slide."
    },
    {
      id: "suggestion-layout",
      label: "Redo layout",
      prompt: slides.length ? "Redo the layout on this slide." : "Redo the layout on the selected slide."
    },
    {
      id: "suggestion-validate",
      label: "Validate deck",
      prompt: "Validate the deck."
    },
    {
      id: "suggestion-render-check",
      label: "Render check",
      prompt: "Run full render validation."
    }
  ];
}

export {
  getAssistantSession,
  getAssistantSuggestions,
  handleAssistantMessage
};
