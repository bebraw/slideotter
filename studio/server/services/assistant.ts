const { getDeckContext } = require("./state.ts");
const { getSlide, getSlides } = require("./slides.ts");
const { readSlideSpec } = require("./slides.ts");
const { drillSelectionWordingSlide, drillWordingSlide, ideateDeckStructure, ideateStructureSlide, ideateThemeSlide, ideateSlide, redoLayoutSlide } = require("./operations.ts");
const { validateDeck } = require("./validate.ts");
const { appendSessionMessages, createMessage, getSession } = require("./sessions.ts");
const { describeSelectionScope, normalizeSelectionScope } = require("./selection-scope.ts");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const text = normalizeText(selection.text).slice(0, 500);
  if (!text) {
    return null;
  }

  return {
    label: normalizeText(selection.label).slice(0, 80) || "Slide text",
    path: normalizeText(selection.path).slice(0, 120),
    slideId: normalizeText(selection.slideId).slice(0, 80),
    slideIndex: Number.isFinite(Number(selection.slideIndex)) ? Number(selection.slideIndex) : null,
    text
  };
}

function normalizeAssistantSelection(selection, slideId) {
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

function isSelectionAwareMessage(message) {
  return /(rewrite|shorten|clarif(?:y|ier)|clearer|more direct|change tone|tone|turn .*quote|quote slide|into a? quote|tighten|wording)/i.test(message);
}

function hasExplicitDeckScope(message) {
  return /\b(whole deck|entire deck|deck-wide|all slides|deck)\b/i.test(message);
}

function detectIntent(message) {
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

function buildHelpReply(options: any = {}) {
  const slide = options.slideId ? getSlide(options.slideId) : null;
  const slideLine = slide
    ? `Selected: ${slide.index}. ${slide.title}.`
    : "No slide selected.";

  return [
    slideLine,
    "Try: ideate variants, tighten wording, redo layout, ideate deck plans, or validate."
  ].join(" ");
}

function buildIdeateReply(result, slide) {
  return [
    result.summary,
    `Session candidates for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildValidationReply(result, includeRender) {
  const status = result.ok ? "passed" : "found issues";
  return includeRender
    ? `Ran full render validation and ${status}.`
    : `Ran geometry and text validation and ${status}.`;
}

function buildDrillWordingReply(result, slide) {
  return [
    result.summary,
    `Wording pass for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildIdeateThemeReply(result, slide) {
  return [
    result.summary,
    `Theme variants for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildIdeateStructureReply(result, slide) {
  return [
    result.summary,
    `Structure variants for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

function buildIdeateDeckStructureReply(result) {
  return [
    result.summary,
    "Inspect one deck-plan candidate before applying."
  ].join(" ");
}

function buildRedoLayoutReply(result, slide) {
  return [
    result.summary,
    `Layout variants for ${slide.index}. ${slide.title}. Compare before applying.`
  ].join(" ");
}

async function handleAssistantMessage(options: any = {}) {
  const sessionId = options.sessionId || "default";
  const message = normalizeText(options.message);
  const selectionScope = normalizeAssistantSelection(options.selection, options.slideId);
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

  if (!options.slideId) {
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

  const slide = getSlide(options.slideId);

  if (selectionScope && isSelectionAwareMessage(message) && !hasExplicitDeckScope(message)) {
    const result = await drillSelectionWordingSlide(options.slideId, selectionScope, {
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
          slideId: options.slideId
        },
        slideId: options.slideId,
        status: "completed",
        type: "selection-command",
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

  if (intent === "ideate-structure") {
    const result = await ideateStructureSlide(options.slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildIdeateStructureReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: options.slideId,
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
    const result = await ideateThemeSlide(options.slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildIdeateThemeReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: options.slideId,
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
    const result = await drillWordingSlide(options.slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildDrillWordingReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: options.slideId,
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
    const result = await redoLayoutSlide(options.slideId, {
      candidateCount: options.candidateCount,
      dryRun: true,
      onProgress: options.onProgress
    });
    const reply = createMessage("assistant", buildRedoLayoutReply(result, slide), {
      action: {
        dryRun: result.dryRun,
        generation: result.generation,
        slideId: options.slideId,
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

  const result = await ideateSlide(options.slideId, {
    candidateCount: options.candidateCount,
    dryRun: true,
    onProgress: options.onProgress
  });
  const reply = createMessage("assistant", buildIdeateReply(result, slide), {
    action: {
      dryRun: result.dryRun,
      generation: result.generation,
      slideId: options.slideId,
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

module.exports = {
  getAssistantSession,
  getAssistantSuggestions,
  handleAssistantMessage
};
