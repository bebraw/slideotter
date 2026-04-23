const { getDeckContext } = require("./state");
const { getSlide, getSlides } = require("./slides");
const { drillWordingSlide, ideateSlide, redoLayoutSlide } = require("./operations");
const { validateDeck } = require("./validate");
const { appendSessionMessages, createMessage, getSession } = require("./sessions");

function normalizeText(value) {
  return String(value || "").trim();
}

function detectIntent(message) {
  const normalized = normalizeText(message).toLowerCase();

  if (!normalized) {
    return "empty";
  }

  if (/(tighten|wording|clarity|clearer|condense copy|shorten copy|drill)/.test(normalized)) {
    return "drill-wording";
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

function buildHelpReply(options = {}) {
  const slide = options.slideId ? getSlide(options.slideId) : null;
  const slideLine = slide
    ? `Selected slide: ${slide.index}. ${slide.title}.`
    : "No slide is currently selected.";

  return [
    slideLine,
    "Ask me to ideate variants, redo the selected slide layout, tighten wording, or run validation.",
    "Examples: `Ideate three variants for this slide`, `Redo the layout on this slide`, `Tighten the wording on this slide`, `Validate the deck`."
  ].join(" ");
}

function buildIdeateReply(result, slide) {
  return [
    result.summary,
    `The assistant kept the workflow in ${result.dryRun ? "dry-run" : "saved"} mode and targeted ${slide.index}. ${slide.title}.`,
    "Use the compare area to inspect one variant before applying it."
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
    `The assistant kept the current structure and targeted wording changes on ${slide.index}. ${slide.title}.`,
    "Use the compare area to inspect one tighter copy pass before applying it."
  ].join(" ");
}

function buildRedoLayoutReply(result, slide) {
  return [
    result.summary,
    `The assistant kept the current slide family and generated layout-first variants for ${slide.index}. ${slide.title}.`,
    "Use the compare area to inspect which reading order works before applying one."
  ].join(" ");
}

async function handleAssistantMessage(options = {}) {
  const sessionId = options.sessionId || "default";
  const message = normalizeText(options.message);
  const intent = detectIntent(message);
  const userMessage = createMessage("user", message || "(empty)");

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

  if (intent === "drill-wording") {
    const result = await drillWordingSlide(options.slideId, {
      dryRun: options.dryRun !== false,
      generationMode: options.generationMode
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
      transientVariants: result.dryRun ? result.variants : [],
      variants: result.dryRun ? [] : result.variants
    };
  }

  if (intent === "redo-layout") {
    const result = await redoLayoutSlide(options.slideId, {
      dryRun: options.dryRun !== false,
      generationMode: options.generationMode
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
      transientVariants: result.dryRun ? result.variants : [],
      variants: result.dryRun ? [] : result.variants
    };
  }

  const result = await ideateSlide(options.slideId, {
    dryRun: options.dryRun !== false,
    generationMode: options.generationMode
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
    transientVariants: result.dryRun ? result.variants : [],
    variants: result.dryRun ? [] : result.variants
  };
}

function getAssistantSession(sessionId = "default") {
  return getSession(sessionId);
}

function getAssistantSuggestions() {
  const slides = getSlides();
  return [
    {
      id: "suggestion-ideate",
      label: "Ideate this slide",
      prompt: slides.length ? "Ideate three dry-run variants for the selected slide." : "Ideate three dry-run variants."
    },
    {
      id: "suggestion-wording",
      label: "Tighten wording",
      prompt: slides.length ? "Tighten the wording on this slide." : "Tighten the wording on the selected slide."
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
    }
  ];
}

module.exports = {
  getAssistantSession,
  getAssistantSuggestions,
  handleAssistantMessage
};
