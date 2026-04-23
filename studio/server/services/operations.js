const fs = require("fs");
const path = require("path");
const { buildAndRenderDeck } = require("./build");
const { createStructuredResponse, getLlmConfig, getLlmStatus } = require("./llm/client");
const { buildIdeateSlidePrompts } = require("./llm/prompts");
const { getIdeateSlideResponseSchema } = require("./llm/schemas");
const { outputDir, previewDir, variantPreviewDir } = require("./paths");
const { getDeckContext } = require("./state");
const { getSlide, readSlideSpec, writeSlideSpec } = require("./slides");
const { validateSlideSpec } = require("./slide-specs");
const { captureVariant, updateVariant } = require("./variants");
const { ensureDir, listPages } = require("../../../generator/render-utils");

const ideateSlideLocks = new Set();
const allowedGenerationModes = new Set(["auto", "local", "llm"]);

function asAssetUrl(fileName) {
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
}

function splitLines(value) {
  return String(value || "")
    .split(/\n|;/)
    .map((line) => line.replace(/^[\s*-]+/, "").trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function trimWords(value, limit = 12) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "";
  }

  if (words.length <= limit) {
    return words.join(" ");
  }

  return `${words.slice(0, limit).join(" ")}...`;
}

function sentence(value, fallback, limit = 14) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return trimWords(normalized || fallback, limit);
}

function toBody(value, fallback) {
  return sentence(value, fallback, 14);
}

function normalizeGenerationMode(value) {
  const mode = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowedGenerationModes.has(mode) ? mode : "auto";
}

function resolveGeneration(options = {}) {
  const llmStatus = getLlmStatus();
  const requestedMode = normalizeGenerationMode(options.generationMode || getLlmConfig().defaultGenerationMode);

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
      throw new Error(`LLM generation is not configured. ${llmStatus.configuredReason || "Configure a provider or switch generation mode to local."}`);
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
      ? `LLM unavailable, used local generation. ${llmStatus.configuredReason}`
      : "LLM unavailable, used local generation.",
    mode: "local",
    model: null,
    provider: "local",
    requestedMode
  };
}

function createIdeaThemes(slide, context) {
  const deck = context.deck || {};
  const slideContext = context.slides[slide.id] || {};
  const mustInclude = unique(splitLines(slideContext.mustInclude));
  const notes = unique(splitLines(slideContext.notes));
  const outline = unique(splitLines(deck.outline));
  const constraints = unique(splitLines(deck.constraints));
  const title = slideContext.title || slide.title;
  const intent = sentence(
    slideContext.intent,
    "make the slide's job clear before changing layout"
  );
  const objective = sentence(
    deck.objective,
    "turn editing into a repeatable studio loop"
  );
  const audience = sentence(
    deck.audience,
    "authors iterating on a local deck"
  );
  const themeBrief = sentence(
    deck.themeBrief,
    "use sans-serif type on white and separate sections with dividers"
  );
  const note = sentence(
    notes[0],
    "keep the working slide untouched until one variant is chosen"
  );
  const include = sentence(
    mustInclude[0],
    "show the main point without piling on more chrome"
  );
  const structure = sentence(
    outline[0],
    "start from stored context, then generate previews before apply"
  );
  const guardrail = sentence(
    constraints[0],
    "keep the generator as the source of truth"
  );

  return [
    {
      label: "Intent-led",
      title,
      notes: "Built from slide intent and deck objective.",
      promptSummary: "Uses stored audience, objective, and slide intent.",
      eyebrow: "Intent",
      summary: `Use this slide to ${intent}.`,
      cards: [
        {
          body: toBody(`Write for ${audience}.`, "Write for the next editor, not the implementation author."),
          id: `${slide.id}-intent-audience`,
          title: "Audience"
        },
        {
          body: toBody(intent, "Make the slide's job clear."),
          id: `${slide.id}-intent-purpose`,
          title: "Purpose"
        },
        {
          body: toBody(include, "Show the main point first."),
          id: `${slide.id}-intent-must`,
          title: "Must show"
        }
      ],
      bullets: [
        {
          body: toBody("Start from the saved slide intent before touching layout.", "Start from saved intent."),
          id: `${slide.id}-intent-bullet-1`,
          title: "Anchor the claim"
        },
        {
          body: toBody(`Keep the copy tuned for ${audience}.`, "Keep the copy audience-aware."),
          id: `${slide.id}-intent-bullet-2`,
          title: "Aim the wording"
        },
        {
          body: toBody(`Carry forward ${include}.`, "Carry the essential point forward."),
          id: `${slide.id}-intent-bullet-3`,
          title: "Keep one focal point"
        }
      ],
      resources: [
        {
          body: "studio/state/deck-context.json",
          bodyFontSize: 11.2,
          id: `${slide.id}-intent-resource-1`,
          title: "Saved brief"
        },
        {
          body: "slides/ plus apply-once workflow",
          bodyFontSize: 10.6,
          id: `${slide.id}-intent-resource-2`,
          title: "Working source"
        }
      ],
      signals: [
        { id: `${slide.id}-intent-signal-1`, label: "intent", value: 0.93 },
        { id: `${slide.id}-intent-signal-2`, label: "audience", value: 0.88 },
        { id: `${slide.id}-intent-signal-3`, label: "must-show", value: 0.9 },
        { id: `${slide.id}-intent-signal-4`, label: "apply", value: 0.84 }
      ],
      guardrails: [
        { id: `${slide.id}-intent-guardrail-1`, label: "saved inputs", value: String(Math.max(1, mustInclude.length + notes.length)) },
        { id: `${slide.id}-intent-guardrail-2`, label: "working file", value: "1" },
        { id: `${slide.id}-intent-guardrail-3`, label: "apply step", value: "1" }
      ]
    },
    {
      label: "Structure-led",
      title,
      notes: "Built from outline and theme guidance.",
      promptSummary: "Uses outline, theme brief, and slide notes.",
      eyebrow: "Flow",
      summary: "Generate options from saved context, preview them, then keep one source file.",
      cards: [
        {
          body: toBody(structure, "Start with stored structure instead of freeform prompting."),
          id: `${slide.id}-structure-sequence`,
          title: "Sequence"
        },
        {
          body: toBody(themeBrief, "Keep the visual system quiet and readable."),
          id: `${slide.id}-structure-theme`,
          title: "Theme"
        },
        {
          body: toBody(note, "Let the editor compare before applying a change."),
          id: `${slide.id}-structure-review`,
          title: "Review"
        }
      ],
      bullets: [
        {
          body: toBody("Use saved outline points to shape the slide before rewriting details.", "Use saved outline points first."),
          id: `${slide.id}-structure-bullet-1`,
          title: "Start with structure"
        },
        {
          body: toBody(`Respect the theme brief: ${themeBrief}.`, "Respect the saved theme brief."),
          id: `${slide.id}-structure-bullet-2`,
          title: "Keep the look aligned"
        },
        {
          body: toBody(note, "Preview variants before one is applied."),
          id: `${slide.id}-structure-bullet-3`,
          title: "Compare before apply"
        }
      ],
      resources: [
        {
          body: "studio/state/variants.json",
          bodyFontSize: 11.2,
          id: `${slide.id}-structure-resource-1`,
          title: "Variant store"
        },
        {
          body: "studio/output/variant-previews/",
          bodyFontSize: 10.6,
          id: `${slide.id}-structure-resource-2`,
          title: "Preview images"
        }
      ],
      signals: [
        { id: `${slide.id}-structure-signal-1`, label: "outline", value: 0.91 },
        { id: `${slide.id}-structure-signal-2`, label: "theme", value: 0.86 },
        { id: `${slide.id}-structure-signal-3`, label: "preview", value: 0.9 },
        { id: `${slide.id}-structure-signal-4`, label: "apply", value: 0.83 }
      ],
      guardrails: [
        { id: `${slide.id}-structure-guardrail-1`, label: "variant options", value: "3" },
        { id: `${slide.id}-structure-guardrail-2`, label: "working file", value: "1" },
        { id: `${slide.id}-structure-guardrail-3`, label: "theme brief", value: String(Math.max(1, splitLines(deck.themeBrief).length || 1)) }
      ]
    },
    {
      label: "Guardrail-led",
      title,
      notes: "Built from constraints and workflow guardrails.",
      promptSummary: "Uses saved constraints and source-of-truth rules.",
      eyebrow: "Guardrails",
      summary: "Keep the generator as the source of truth and let validation catch drift early.",
      cards: [
        {
          body: toBody(guardrail, "Keep the generator as the source of truth."),
          id: `${slide.id}-guardrail-source`,
          title: "Source of truth"
        },
        {
          body: toBody(objective, "Shorten the edit loop without hiding the real source."),
          id: `${slide.id}-guardrail-loop`,
          title: "Short loop"
        },
        {
          body: toBody("Preview generated variants, then apply one and run validation.", "Preview, apply once, and validate."),
          id: `${slide.id}-guardrail-validate`,
          title: "Validation"
        }
      ],
      bullets: [
        {
          body: toBody("Generate candidate source files without replacing the current slide.", "Generate without overwriting."),
          id: `${slide.id}-guardrail-bullet-1`,
          title: "Keep the draft safe"
        },
        {
          body: toBody("Restore the real deck after every generated preview pass.", "Restore the real deck after preview."),
          id: `${slide.id}-guardrail-bullet-2`,
          title: "Rebuild the truth"
        },
        {
          body: toBody("Apply a chosen source variant, then validate the result.", "Apply one source and validate."),
          id: `${slide.id}-guardrail-bullet-3`,
          title: "Promote intentionally"
        }
      ],
      resources: [
        {
          body: "generator/deck.js and studio/server/",
          bodyFontSize: 10.8,
          id: `${slide.id}-guardrail-resource-1`,
          title: "Runtime boundary"
        },
        {
          body: "npm run quality:gate",
          bodyFontSize: 11.2,
          id: `${slide.id}-guardrail-resource-2`,
          title: "Final check"
        }
      ],
      signals: [
        { id: `${slide.id}-guardrail-signal-1`, label: "preview", value: 0.88 },
        { id: `${slide.id}-guardrail-signal-2`, label: "restore", value: 0.93 },
        { id: `${slide.id}-guardrail-signal-3`, label: "apply", value: 0.82 },
        { id: `${slide.id}-guardrail-signal-4`, label: "validate", value: 0.95 }
      ],
      guardrails: [
        { id: `${slide.id}-guardrail-row-1`, label: "generated previews", value: "3" },
        { id: `${slide.id}-guardrail-row-2`, label: "final apply", value: "1" },
        { id: `${slide.id}-guardrail-row-3`, label: "quality gate", value: "1" }
      ]
    }
  ];
}

function buildIdeaSlideSpec(slideType, theme) {
  switch (slideType) {
    case "cover":
      return validateSlideSpec({
        cards: theme.cards,
        eyebrow: theme.eyebrow,
        note: theme.notes,
        summary: theme.summary,
        title: theme.title,
        type: "cover"
      });
    case "toc":
      return validateSlideSpec({
        cards: theme.cards,
        eyebrow: theme.eyebrow,
        note: theme.notes,
        summary: theme.summary,
        title: theme.title,
        type: "toc"
      });
    case "content":
      return validateSlideSpec({
        eyebrow: theme.eyebrow,
        guardrails: theme.guardrails,
        guardrailsTitle: "Workflow guardrails",
        signals: theme.signals,
        signalsTitle: `${theme.label} signals`,
        summary: theme.summary,
        title: theme.title,
        type: "content"
      });
    case "summary":
      return validateSlideSpec({
        bullets: theme.bullets,
        eyebrow: theme.eyebrow,
        resources: theme.resources,
        resourcesTitle: "Keep nearby",
        summary: theme.summary,
        title: theme.title,
        type: "summary"
      });
    default:
      throw new Error(`Ideate Slide does not support slide type "${slideType}" yet`);
  }
}

function buildChangeSummary(slideType, theme, options = {}) {
  const modeLabel = options.dryRun ? "Generated as a dry run without saving to the variant store." : "Saved as a reusable variant in studio state.";

  switch (slideType) {
    case "cover":
      return [
        `Shifted the cover toward the ${theme.label.toLowerCase()} framing.`,
        "Rewrote the three capability cards as the primary content block.",
        "Updated the cover eyebrow, summary, and footnote copy.",
        modeLabel
      ];
    case "toc":
      return [
        `Shifted the outline slide toward the ${theme.label.toLowerCase()} framing.`,
        "Rewrote the section body and the three outline cards.",
        "Updated the bottom note to match the new emphasis.",
        modeLabel
      ];
    case "content":
      return [
        `Shifted the signal slide toward the ${theme.label.toLowerCase()} framing.`,
        "Replaced the signal bars and guardrail metrics.",
        "Retitled the left and right comparison panels to match the new emphasis.",
        modeLabel
      ];
    case "summary":
      return [
        `Shifted the summary slide toward the ${theme.label.toLowerCase()} framing.`,
        "Replaced the checklist items and the resource cards.",
        "Kept the slide structure but rewrote the summary body around the new angle.",
        modeLabel
      ];
    default:
      return [
        `Shifted the slide toward the ${theme.label.toLowerCase()} framing.`,
        modeLabel
      ];
  }
}

function createLocalIdeateCandidates(slide, slideType, context, options = {}) {
  return createIdeaThemes(slide, context).map((theme) => {
    const slideSpec = buildIdeaSlideSpec(slideType, theme);
    return {
      changeSummary: buildChangeSummary(slideType, theme, options),
      generator: "local",
      label: theme.label,
      model: null,
      notes: theme.notes,
      promptSummary: theme.promptSummary,
      provider: "local",
      slideSpec
    };
  });
}

async function createLlmIdeateCandidates(slide, slideType, source, context) {
  const prompts = buildIdeateSlidePrompts({
    context,
    slide,
    slideType,
    source
  });
  const result = await createStructuredResponse({
    developerPrompt: prompts.developerPrompt,
    schema: getIdeateSlideResponseSchema(slideType),
    schemaName: `ideate_slide_${slideType}_variants`,
    userPrompt: prompts.userPrompt
  });

  if (!result.data || !Array.isArray(result.data.variants) || result.data.variants.length !== 3) {
    throw new Error("LLM ideation did not return three structured variants");
  }

  return result.data.variants.map((variant) => ({
    changeSummary: Array.isArray(variant.changeSummary) ? variant.changeSummary : [],
    generator: "llm",
    label: variant.label,
    model: result.model,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: result.provider,
    slideSpec: validateSlideSpec(variant.slideSpec)
  })).map((candidate) => {
    if (candidate.slideSpec.type !== slideType) {
      throw new Error(`LLM returned slide spec type "${candidate.slideSpec.type}" for "${slideType}" slide`);
    }

    return candidate;
  });
}

function normalizeSentence(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function shortenWords(value, limit) {
  const words = normalizeSentence(value).split(/\s+/).filter(Boolean);
  if (words.length <= limit) {
    return words.join(" ");
  }

  return `${words.slice(0, limit).join(" ")}.`;
}

function tightenText(value, mode) {
  const normalized = normalizeSentence(value)
    .replace(/\bthat\b/gi, "")
    .replace(/\bvery\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  switch (mode) {
    case "direct":
      return shortenWords(normalized, 11);
    case "condensed":
      return shortenWords(normalized, 8);
    case "operator":
      return shortenWords(
        normalized
          .replace(/\bslides\b/gi, "Slide")
          .replace(/\bvalidation\b/gi, "Checks")
          .replace(/\bgenerator\b/gi, "Runtime"),
        9
      );
    default:
      return normalized;
  }
}

function tightenCardCollection(items, mode, field = "body") {
  return items.map((item) => ({
    ...item,
    [field]: tightenText(item[field], mode),
    title: tightenText(item.title, mode === "condensed" ?  "condensed" : "direct")
  }));
}

function createWordingVariant(slideSpec, options = {}) {
  const mode = options.mode || "direct";
  const next = {
    ...slideSpec,
    eyebrow: slideSpec.eyebrow ? tightenText(slideSpec.eyebrow, mode) : slideSpec.eyebrow,
    summary: slideSpec.summary ? tightenText(slideSpec.summary, mode) : slideSpec.summary,
    title: slideSpec.title
  };

  if (next.note) {
    next.note = tightenText(next.note, mode);
  }

  if (next.signalsTitle) {
    next.signalsTitle = tightenText(next.signalsTitle, mode);
  }

  if (next.guardrailsTitle) {
    next.guardrailsTitle = tightenText(next.guardrailsTitle, mode);
  }

  if (next.resourcesTitle) {
    next.resourcesTitle = tightenText(next.resourcesTitle, mode);
  }

  if (Array.isArray(next.cards)) {
    next.cards = tightenCardCollection(next.cards, mode);
  }

  if (Array.isArray(next.bullets)) {
    next.bullets = tightenCardCollection(next.bullets, mode);
  }

  if (Array.isArray(next.resources)) {
    next.resources = next.resources.map((item) => ({
      ...item,
      body: tightenText(item.body, mode),
      title: tightenText(item.title, mode === "condensed" ? "condensed" : "direct")
    }));
  }

  if (Array.isArray(next.signals)) {
    next.signals = next.signals.map((item) => ({
      ...item,
      label: tightenText(item.label, mode === "condensed" ? "condensed" : "direct")
    }));
  }

  if (Array.isArray(next.guardrails)) {
    next.guardrails = next.guardrails.map((item) => ({
      ...item,
      label: tightenText(item.label, mode === "condensed" ? "condensed" : "direct")
    }));
  }

  return validateSlideSpec(next);
}

function createLocalWordingCandidates(currentSpec, options = {}) {
  const modeLabel = options.dryRun ? "Generated as a dry run without saving to the variant store." : "Saved as a reusable variant in studio state.";
  const variants = [
    {
      label: "Direct wording",
      mode: "direct",
      notes: "Tightens copy while keeping the current slide structure intact.",
      promptSummary: "Uses the current slide copy and trims it to a more direct presentation voice."
    },
    {
      label: "Condensed wording",
      mode: "condensed",
      notes: "Shortens the copy more aggressively for presentation-scale reading.",
      promptSummary: "Uses the current slide copy and compresses it for tighter reading."
    },
    {
      label: "Operator wording",
      mode: "operator",
      notes: "Keeps the message practical and outcome-focused.",
      promptSummary: "Uses the current slide copy and rewrites it in a more operational tone."
    }
  ];

  return variants.map((variant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.mode} wording pass.`,
      "Kept the current slide structure and IDs while tightening on-slide copy.",
      "Focused on shorter slide-scale phrases instead of changing the layout.",
      modeLabel
    ],
    generator: "local",
    label: variant.label,
    model: null,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: "local",
    slideSpec: createWordingVariant(currentSpec, { mode: variant.mode })
  }));
}

function reorderItems(items, order) {
  return order
    .map((index) => items[index])
    .filter(Boolean)
    .map((item) => ({ ...item }));
}

function rotateItems(items, offset = 0) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  const shift = ((offset % items.length) + items.length) % items.length;
  return items.map((_, index) => ({ ...items[(index + shift) % items.length] }));
}

function orderByNumericValue(items, direction = "desc") {
  return items
    .map((item, index) => ({
      index,
      item: { ...item },
      value: typeof item.value === "number" ? item.value : Number.parseFloat(item.value)
    }))
    .sort((left, right) => {
      const leftValue = Number.isFinite(left.value) ? left.value : left.index;
      const rightValue = Number.isFinite(right.value) ? right.value : right.index;
      return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
    })
    .map((entry) => entry.item);
}

function collectLayoutContext(slide, context) {
  const deck = context.deck || {};
  const slideContext = context.slides[slide.id] || {};

  return {
    audience: sentence(deck.audience, "the next editor"),
    intent: sentence(slideContext.intent, "make the slide's job clear before changing it"),
    layoutHint: sentence(slideContext.layoutHint, "rebalance the content without changing the slide family"),
    mustInclude: sentence(splitLines(slideContext.mustInclude)[0], "keep the main point visible"),
    note: sentence(splitLines(slideContext.notes)[0], "compare the candidate before applying it"),
    objective: sentence(deck.objective, "shorten the edit loop without hiding the source")
  };
}

function createCardLayoutCandidates(currentSpec, layoutContext, options = {}) {
  const modeLabel = options.dryRun ? "Generated as a dry run without saving to the variant store." : "Saved as a reusable variant in studio state.";
  const cardOrders = [
    [0, 2, 1],
    [1, 0, 2],
    [2, 1, 0]
  ];

  return [
    {
      label: "Outcome-first layout",
      notes: "Pushes the slide toward the main outcome first, then supporting cards.",
      promptSummary: "Reorders the card stack so the key outcome lands first and the note closes the slide.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: reorderItems(currentSpec.cards, cardOrders[0]),
        eyebrow: "Outcome",
        note: `${layoutContext.mustInclude}. ${layoutContext.note}.`,
        summary: `Lead with ${currentSpec.cards[0].title.toLowerCase()}, then support it with the other two beats.`,
        title: currentSpec.title
      })
    },
    {
      label: "Sequence-first layout",
      notes: "Reframes the slide as a left-to-right sequence instead of a flat list.",
      promptSummary: "Rotates the card order and rewrites the section framing around a clear three-step sequence.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: reorderItems(currentSpec.cards, cardOrders[1]),
        eyebrow: "Sequence",
        note: `${layoutContext.layoutHint}. ${layoutContext.note}.`,
        summary: `Walk from ${currentSpec.cards[1].title.toLowerCase()} to ${currentSpec.cards[0].title.toLowerCase()} and close on ${currentSpec.cards[2].title.toLowerCase()}.`,
        title: currentSpec.title
      })
    },
    {
      label: "Proof-first layout",
      notes: "Starts with the strongest proof point and lets the rest of the slide justify it.",
      promptSummary: "Moves the strongest support card to the first position and rewrites the frame around evidence.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: reorderItems(currentSpec.cards, cardOrders[2]),
        eyebrow: "Proof",
        note: `${layoutContext.objective}. ${layoutContext.note}.`,
        summary: `Open on ${currentSpec.cards[2].title.toLowerCase()} and let the remaining cards explain how it holds together.`,
        title: currentSpec.title
      })
    }
  ].map((variant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward an ${variant.label.toLowerCase()}.`,
      "Reordered the three card positions and rewrote the framing copy around the new emphasis.",
      "Kept the current slide family and card IDs while changing the reading order.",
      modeLabel
    ],
    generator: "local",
    label: variant.label,
    model: null,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: "local",
    slideSpec: variant.slideSpec
  }));
}

function createContentLayoutCandidates(currentSpec, layoutContext, options = {}) {
  const modeLabel = options.dryRun ? "Generated as a dry run without saving to the variant store." : "Saved as a reusable variant in studio state.";

  return [
    {
      label: "Signal-first layout",
      notes: "Moves the strongest signal rows to the top and keeps guardrails as the supporting column.",
      promptSummary: "Sorts signal bars by strongest value first and reframes the slide around visible momentum.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Priority",
        guardrails: rotateItems(currentSpec.guardrails, 1),
        guardrailsTitle: "Supporting guardrails",
        signals: orderByNumericValue(currentSpec.signals, "desc"),
        signalsTitle: "Leading signals",
        summary: `Start with the strongest visible signal, then use the guardrails to explain how the setup stays stable.`,
        title: currentSpec.title
      })
    },
    {
      label: "Guardrail-first layout",
      notes: "Makes the control surface more prominent and turns the signals into supporting evidence.",
      promptSummary: "Reorders the guardrails so the most material controls land first and reframes the slide around operating safety.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Controls",
        guardrails: orderByNumericValue(currentSpec.guardrails, "desc"),
        guardrailsTitle: "Primary guardrails",
        signals: rotateItems(currentSpec.signals, 1),
        signalsTitle: "Supporting signals",
        summary: `Lead with the operating limits, then show the signals that justify keeping the current path.`,
        title: currentSpec.title
      })
    },
    {
      label: "Gap-focused layout",
      notes: "Pulls the weakest signal and tightest constraint upward so the slide reads like a watch list.",
      promptSummary: "Sorts signals from weakest to strongest and reframes the copy around the most exposed gap.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Watch list",
        guardrails: orderByNumericValue(currentSpec.guardrails, "asc"),
        guardrailsTitle: "Tightest guardrails",
        signals: orderByNumericValue(currentSpec.signals, "asc"),
        signalsTitle: "Weakest signals first",
        summary: `Use the slide as a watch list: surface the weakest signal, then show which guardrail needs the most care.`,
        title: currentSpec.title
      })
    }
  ].map((variant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Reordered the signal bars and guardrail rows to change which evidence lands first.",
      "Retitled the left and right panels while keeping the existing two-column structure intact.",
      modeLabel
    ],
    generator: "local",
    label: variant.label,
    model: null,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: "local",
    slideSpec: variant.slideSpec
  }));
}

function createSummaryLayoutCandidates(currentSpec, layoutContext, options = {}) {
  const modeLabel = options.dryRun ? "Generated as a dry run without saving to the variant store." : "Saved as a reusable variant in studio state.";

  return [
    {
      label: "Run-path layout",
      notes: "Makes the build path read as the primary sequence and keeps references secondary.",
      promptSummary: "Rotates the checklist so the operating path reads top to bottom before the reference panel.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: reorderItems(currentSpec.bullets, [1, 2, 0]),
        eyebrow: "Run path",
        resources: rotateItems(currentSpec.resources, 1),
        resourcesTitle: "Support nearby",
        summary: `Lead with the operating path, then keep the supporting references off to the side.`,
        title: currentSpec.title
      })
    },
    {
      label: "Approval-path layout",
      notes: "Moves approval and validation higher so the slide reads like a decision gate.",
      promptSummary: "Reorders the checklist around approval steps and reframes the resource panel around review.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: reorderItems(currentSpec.bullets, [2, 1, 0]),
        eyebrow: "Approval",
        resources: currentSpec.resources.map((item) => ({ ...item })),
        resourcesTitle: "Review surface",
        summary: `Put validation before convenience so the slide reads like an approval path, not a loose checklist.`,
        title: currentSpec.title
      })
    },
    {
      label: "Handoff layout",
      notes: "Frames the slide for the next operator by closing on what needs to stay nearby.",
      promptSummary: "Keeps the checklist tight, rotates the order, and turns the right panel into a handoff surface.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: reorderItems(currentSpec.bullets, [0, 2, 1]),
        eyebrow: "Handoff",
        resources: rotateItems(currentSpec.resources, 1),
        resourcesTitle: "Carry forward",
        summary: `Frame the slide for handoff: keep the core steps on the left and the files worth keeping nearby on the right.`,
        title: currentSpec.title
      })
    }
  ].map((variant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Reordered the checklist and resource emphasis so the slide reads in a different sequence.",
      "Kept the same summary slide family while changing what the viewer should notice first.",
      modeLabel
    ],
    generator: "local",
    label: variant.label,
    model: null,
    notes: variant.notes,
    promptSummary: variant.promptSummary,
    provider: "local",
    slideSpec: variant.slideSpec
  }));
}

function createLocalLayoutCandidates(slide, currentSpec, context, options = {}) {
  const layoutContext = collectLayoutContext(slide, context);

  switch (currentSpec.type) {
    case "cover":
    case "toc":
      return createCardLayoutCandidates(currentSpec, layoutContext, options);
    case "content":
      return createContentLayoutCandidates(currentSpec, layoutContext, options);
    case "summary":
      return createSummaryLayoutCandidates(currentSpec, layoutContext, options);
    default:
      throw new Error(`Redo Layout does not support slide type "${currentSpec.type}" yet`);
  }
}

function serializeSlideSpec(slideSpec) {
  return `${JSON.stringify(slideSpec, null, 2)}\n`;
}

async function materializeCandidatesToVariants(slideId, candidates, options = {}) {
  const createdVariants = [];

  for (const candidate of candidates) {
    const slideSpec = validateSlideSpec(candidate.slideSpec);
    const source = serializeSlideSpec(slideSpec);

    if (options.dryRun) {
      const variant = createTransientVariant({
        changeSummary: candidate.changeSummary,
        generator: candidate.generator,
        kind: "generated",
        label: options.labelFormatter ? options.labelFormatter(candidate.label) : candidate.label,
        model: candidate.model,
        notes: candidate.notes,
        operation: options.operation,
        promptSummary: candidate.promptSummary,
        provider: candidate.provider,
        slideId,
        slideSpec,
        source
      });
      const previewImage = await renderVariantPreview(slideId, slideSpec, variant.id);
      createdVariants.push({
        ...variant,
        previewImage
      });
      continue;
    }

    const variant = captureVariant({
      changeSummary: candidate.changeSummary,
      generator: candidate.generator,
      kind: "generated",
      label: options.labelFormatter ? options.labelFormatter(candidate.label) : candidate.label,
      model: candidate.model,
      notes: candidate.notes,
      operation: options.operation,
      promptSummary: candidate.promptSummary,
      provider: candidate.provider,
      slideId,
      slideSpec,
      source
    });
    const previewImage = await renderVariantPreview(slideId, slideSpec, variant.id);
    createdVariants.push(updateVariant(variant.id, { previewImage }));
  }

  return createdVariants;
}

function createTransientVariant(options) {
  const timestamp = new Date().toISOString();
  return {
    changeSummary: Array.isArray(options.changeSummary) ? options.changeSummary : [],
    createdAt: timestamp,
    id: `dry-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: options.kind || "generated",
    label: options.label,
    notes: options.notes || "",
    operation: options.operation || null,
    generator: options.generator || null,
    model: options.model || null,
    persisted: false,
    previewImage: options.previewImage || null,
    promptSummary: options.promptSummary || "",
    provider: options.provider || null,
    slideId: options.slideId,
    slideSpec: options.slideSpec || null,
    source: options.source,
    updatedAt: timestamp
  };
}

async function renderVariantPreview(slideId, slideSpec, variantId) {
  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  ensureDir(variantPreviewDir);

  try {
    writeSlideSpec(slideId, slideSpec);
    await buildAndRenderDeck();
    const pages = listPages(previewDir);
    const pageFile = pages[slide.index - 1];

    if (!pageFile) {
      throw new Error(`Missing rendered page for slide ${slide.index}`);
    }

    const targetFile = path.join(variantPreviewDir, `${variantId}.png`);
    fs.copyFileSync(pageFile, targetFile);

    return {
      fileName: path.basename(targetFile),
      url: asAssetUrl(targetFile)
    };
  } finally {
    writeSlideSpec(slideId, originalSlideSpec);
  }
}

async function ideateSlide(slideId, options = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Ideate Slide is already running for ${slideId}`);
  }

  ideateSlideLocks.add(slideId);
  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants = [];
  let previews = null;
  const dryRun = options.dryRun === true;
  const slideType = originalSlideSpec.type;
  const generation = resolveGeneration(options);

  try {
    const candidates = generation.mode === "llm"
      ? await createLlmIdeateCandidates(slide, slideType, serializeSlideSpec(originalSlideSpec), context)
      : createLocalIdeateCandidates(slide, slideType, context, { dryRun });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      dryRun,
      labelFormatter: (label) => generation.mode === "llm"
        ? label
        : `${label} ${dryRun ? "dry run" : "variant"}`,
      operation: "ideate-slide"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: dryRun
      ? `Generated ${createdVariants.length} dry-run slide variants for ${slide.title} using ${generation.mode === "llm" ? `${generation.provider} ${generation.model}` : "local rules"}${generation.fallbackReason ? `; ${generation.fallbackReason.toLowerCase()}` : ""}.`
      : `Generated ${createdVariants.length} slide variants for ${slide.title} using ${generation.mode === "llm" ? `${generation.provider} ${generation.model}` : "local rules"}${generation.fallbackReason ? `; ${generation.fallbackReason.toLowerCase()}` : ""}.`,
    variants: createdVariants
  };
}

async function drillWordingSlide(slideId, options = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  ideateSlideLocks.add(slideId);
  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const createdVariants = [];
  let previews = null;
  const dryRun = options.dryRun !== false;
  const generation = {
    available: false,
    fallbackReason: null,
    mode: "local",
    model: null,
    provider: "local",
    requestedMode: normalizeGenerationMode(options.generationMode || "local")
  };

  try {
    const candidates = createLocalWordingCandidates(originalSlideSpec, { dryRun });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      dryRun,
      labelFormatter: (label) => `${label} ${dryRun ? "dry run" : "variant"}`,
      operation: "drill-wording"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: dryRun
      ? `Generated ${createdVariants.length} dry-run wording variants for ${slide.title} using local wording rules.`
      : `Generated ${createdVariants.length} wording variants for ${slide.title} using local wording rules.`,
    variants: createdVariants
  };
}

async function redoLayoutSlide(slideId, options = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Another workflow is already running for ${slideId}`);
  }

  ideateSlideLocks.add(slideId);
  const slide = getSlide(slideId);
  const originalSlideSpec = readSlideSpec(slideId);
  const context = getDeckContext();
  const createdVariants = [];
  let previews = null;
  const dryRun = options.dryRun !== false;
  const generation = {
    available: false,
    fallbackReason: null,
    mode: "local",
    model: null,
    provider: "local",
    requestedMode: normalizeGenerationMode(options.generationMode || "local")
  };

  try {
    const candidates = createLocalLayoutCandidates(slide, originalSlideSpec, context, { dryRun });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      dryRun,
      labelFormatter: (label) => `${label} ${dryRun ? "dry run" : "variant"}`,
      operation: "redo-layout"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      writeSlideSpec(slideId, originalSlideSpec);
      previews = (await buildAndRenderDeck()).previews;
    } finally {
      ideateSlideLocks.delete(slideId);
    }
  }

  return {
    dryRun,
    generation,
    previews,
    slideId,
    summary: dryRun
      ? `Generated ${createdVariants.length} dry-run layout variants for ${slide.title} using local layout rules.`
      : `Generated ${createdVariants.length} layout variants for ${slide.title} using local layout rules.`,
    variants: createdVariants
  };
}

module.exports = {
  drillWordingSlide,
  ideateSlide,
  redoLayoutSlide
};
