const fs = require("fs");
const path = require("path");
const { describeDesignConstraints } = require("./design-constraints");
const { buildAndRenderDeck } = require("./build");
const { createStructuredResponse, getLlmConfig, getLlmStatus } = require("./llm/client");
const { buildIdeateSlidePrompts } = require("./llm/prompts");
const { getIdeateSlideResponseSchema } = require("./llm/schemas");
const { deckStructurePreviewDir, outputDir, previewDir, variantPreviewDir } = require("./paths");
const { applyDeckStructurePlan, getDeckContext, saveDeckContext } = require("./state");
const { createStructuredSlide, getSlide, getSlides, peekNextStructuredSlideFileName, readSlideSpec, writeSlideSpec } = require("./slides");
const { validateSlideSpec } = require("./slide-specs");
const { captureVariant, updateVariant } = require("./variants");
const {
  copyAllowedFile,
  ensureAllowedDir,
  removeAllowedPath
} = require("./write-boundary");
const { createContactSheet, listPages } = require("./page-artifacts");

const ideateSlideLocks = new Set();
const allowedGenerationModes = new Set(["auto", "local", "llm"]);

function reportProgress(options, progress) {
  if (typeof options.onProgress === "function") {
    options.onProgress(progress);
  }
}

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

function getDeckConstraintLines(deck = {}) {
  return unique([
    ...splitLines(deck.constraints),
    ...describeDesignConstraints(deck.designConstraints)
  ]);
}

function createIdeaThemes(slide, context) {
  const deck = context.deck || {};
  const slideContext = context.slides[slide.id] || {};
  const mustInclude = unique(splitLines(slideContext.mustInclude));
  const notes = unique(splitLines(slideContext.notes));
  const outline = unique(splitLines(deck.outline));
  const constraints = getDeckConstraintLines(deck);
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
    "keep the shared runtime as the source of truth"
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
          body: slide.structured ? `${slide.fileName} :: variants[]` : "studio/state/variants.json",
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
      summary: "Keep the shared runtime as the source of truth and let validation catch drift early.",
      cards: [
        {
          body: toBody(guardrail, "Keep the shared runtime as the source of truth."),
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
          body: "studio/client/slide-dom.js and studio/server/",
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

function describeVariantPersistence(options = {}) {
  if (options.dryRun) {
    return "Generated as a dry run without saving to the variant store.";
  }

  return options.persistToSlide
    ? "Saved as a reusable variant in the slide JSON."
    : "Saved as a reusable variant in studio state.";
}

function buildChangeSummary(slideType, theme, options = {}) {
  const modeLabel = describeVariantPersistence(options);

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

function collectThemeContext(slide, currentSpec, context) {
  const deck = context.deck || {};
  const slideContext = context.slides[slide.id] || {};

  return {
    audience: sentence(deck.audience, "authors iterating on a local deck"),
    constraints: sentence(getDeckConstraintLines(deck)[0], "keep the shared runtime as the source of truth"),
    intent: sentence(slideContext.intent, "make the slide's job obvious before adding detail"),
    mustInclude: sentence(splitLines(slideContext.mustInclude)[0], "keep the main point visible"),
    note: sentence(splitLines(slideContext.notes)[0], "compare the candidate before applying it"),
    objective: sentence(deck.objective, "shorten the edit loop without hiding the source"),
    themeBrief: sentence(deck.themeBrief, "keep the slide quiet, readable, and deliberate"),
    title: slideContext.title || currentSpec.title || slide.title,
    tone: sentence(deck.tone, "calm and exact")
  };
}

function createThemeDirections(slide, currentSpec, context) {
  const themeContext = collectThemeContext(slide, currentSpec, context);
  const reviewNote = sentence(themeContext.note, "compare the candidate before applying it");

  return [
    {
      label: "Editorial theme",
      notes: "Turns the slide toward a sharper editorial point of view and clearer reading rhythm.",
      promptSummary: "Uses the saved theme brief, tone, and audience to push the slide toward an editorial treatment.",
      eyebrow: "Editorial",
      note: `${themeContext.constraints}. ${reviewNote}.`,
      summary: `Frame the slide with a sharper point of view for ${themeContext.audience}.`,
      title: themeContext.title,
      cards: [
        {
          body: toBody(`Lead with ${themeContext.intent}.`, "Lead with the core claim."),
          id: `${slide.id}-theme-editorial-card-1`,
          title: "Point of view"
        },
        {
          body: toBody(`Keep the tone ${themeContext.tone}.`, "Keep the voice calm and exact."),
          id: `${slide.id}-theme-editorial-card-2`,
          title: "Voice"
        },
        {
          body: toBody(`Keep ${themeContext.mustInclude}.`, "Keep the main point in frame."),
          id: `${slide.id}-theme-editorial-card-3`,
          title: "Keep in frame"
        }
      ],
      bullets: [
        {
          body: toBody(`Open with ${themeContext.intent}.`, "Open with the claim."),
          id: `${slide.id}-theme-editorial-bullet-1`,
          title: "Lead the claim"
        },
        {
          body: toBody(`Use ${themeContext.themeBrief}.`, "Let the theme support readability."),
          id: `${slide.id}-theme-editorial-bullet-2`,
          title: "Shape the surface"
        },
        {
          body: toBody(reviewNote, "Compare before applying."),
          id: `${slide.id}-theme-editorial-bullet-3`,
          title: "Review before keep"
        }
      ],
      resources: [
        {
          body: "studio/state/deck-context.json",
          bodyFontSize: 11.2,
          id: `${slide.id}-theme-editorial-resource-1`,
          title: "Theme brief"
        },
        {
          body: "studio/output/variant-previews/",
          bodyFontSize: 10.6,
          id: `${slide.id}-theme-editorial-resource-2`,
          title: "Preview pass"
        }
      ],
      signals: [
        { id: `${slide.id}-theme-editorial-signal-1`, label: "voice", value: 0.93 },
        { id: `${slide.id}-theme-editorial-signal-2`, label: "focus", value: 0.9 },
        { id: `${slide.id}-theme-editorial-signal-3`, label: "proof", value: 0.84 },
        { id: `${slide.id}-theme-editorial-signal-4`, label: "rhythm", value: 0.88 }
      ],
      guardrails: [
        { id: `${slide.id}-theme-editorial-guardrail-1`, label: "tone", value: themeContext.tone },
        { id: `${slide.id}-theme-editorial-guardrail-2`, label: "theme brief", value: "1" },
        { id: `${slide.id}-theme-editorial-guardrail-3`, label: "apply step", value: "1" }
      ]
    },
    {
      label: "Systems theme",
      notes: "Reframes the slide around repeatability, shared rules, and the system behind the surface.",
      promptSummary: "Uses the deck objective, constraints, and theme brief to push the slide toward a systems treatment.",
      eyebrow: "Systems",
      note: `${themeContext.objective}. ${reviewNote}.`,
      summary: "Treat the slide as part of one repeatable system rather than a one-off visual.",
      title: themeContext.title,
      cards: [
        {
          body: toBody(themeContext.themeBrief, "Keep the theme deliberate and reusable."),
          id: `${slide.id}-theme-systems-card-1`,
          title: "Shared rule"
        },
        {
          body: toBody(themeContext.constraints, "Keep the shared runtime as the source of truth."),
          id: `${slide.id}-theme-systems-card-2`,
          title: "Boundary"
        },
        {
          body: toBody(themeContext.objective, "Shorten the loop without hiding the source."),
          id: `${slide.id}-theme-systems-card-3`,
          title: "Loop"
        }
      ],
      bullets: [
        {
          body: toBody("Let the shared system carry more of the visual work.", "Let the system do the work."),
          id: `${slide.id}-theme-systems-bullet-1`,
          title: "Rely on patterns"
        },
        {
          body: toBody(themeContext.constraints, "Keep the main boundary visible."),
          id: `${slide.id}-theme-systems-bullet-2`,
          title: "Keep one boundary"
        },
        {
          body: toBody(reviewNote, "Compare before promoting one option."),
          id: `${slide.id}-theme-systems-bullet-3`,
          title: "Promote once"
        }
      ],
      resources: [
        {
          body: "studio/client/slide-dom.js",
          bodyFontSize: 11.2,
          id: `${slide.id}-theme-systems-resource-1`,
          title: "System root"
        },
        {
          body: slide.structured ? `${slide.fileName} :: variants[]` : "studio/state/variants.json",
          bodyFontSize: 10.6,
          id: `${slide.id}-theme-systems-resource-2`,
          title: "Theme variants"
        }
      ],
      signals: [
        { id: `${slide.id}-theme-systems-signal-1`, label: "system", value: 0.94 },
        { id: `${slide.id}-theme-systems-signal-2`, label: "reuse", value: 0.9 },
        { id: `${slide.id}-theme-systems-signal-3`, label: "clarity", value: 0.85 },
        { id: `${slide.id}-theme-systems-signal-4`, label: "guardrails", value: 0.92 }
      ],
      guardrails: [
        { id: `${slide.id}-theme-systems-guardrail-1`, label: "shared rules", value: "1" },
        { id: `${slide.id}-theme-systems-guardrail-2`, label: "runtime boundary", value: "1" },
        { id: `${slide.id}-theme-systems-guardrail-3`, label: "preview pass", value: "1" }
      ]
    },
    {
      label: "Workshop theme",
      notes: "Pushes the slide toward review, discussion, and handoff instead of polished broadcast only.",
      promptSummary: "Uses slide notes, must-include points, and audience to frame the slide as a working session surface.",
      eyebrow: "Workshop",
      note: `${themeContext.mustInclude}. ${reviewNote}.`,
      summary: "Frame the slide for review and handoff so the next decision is easier to make.",
      title: themeContext.title,
      cards: [
        {
          body: toBody(`Make ${themeContext.mustInclude}.`, "Make the key point obvious."),
          id: `${slide.id}-theme-workshop-card-1`,
          title: "Decision point"
        },
        {
          body: toBody(`Aim the slide at ${themeContext.audience}.`, "Aim the slide at the next operator."),
          id: `${slide.id}-theme-workshop-card-2`,
          title: "Audience"
        },
        {
          body: toBody(reviewNote, "Compare the candidate before keeping it."),
          id: `${slide.id}-theme-workshop-card-3`,
          title: "Handoff"
        }
      ],
      bullets: [
        {
          body: toBody("Use the slide to drive one concrete discussion.", "Drive one concrete discussion."),
          id: `${slide.id}-theme-workshop-bullet-1`,
          title: "Set the question"
        },
        {
          body: toBody(`Keep the surface ${themeContext.tone}.`, "Keep the surface calm and exact."),
          id: `${slide.id}-theme-workshop-bullet-2`,
          title: "Keep it legible"
        },
        {
          body: toBody(themeContext.mustInclude, "Keep the main point visible."),
          id: `${slide.id}-theme-workshop-bullet-3`,
          title: "Keep the anchor"
        }
      ],
      resources: [
        {
          body: "slides/ plus compare/apply flow",
          bodyFontSize: 10.8,
          id: `${slide.id}-theme-workshop-resource-1`,
          title: "Working surface"
        },
        {
          body: "npm run quality:gate",
          bodyFontSize: 11.2,
          id: `${slide.id}-theme-workshop-resource-2`,
          title: "Final check"
        }
      ],
      signals: [
        { id: `${slide.id}-theme-workshop-signal-1`, label: "handoff", value: 0.9 },
        { id: `${slide.id}-theme-workshop-signal-2`, label: "discussion", value: 0.87 },
        { id: `${slide.id}-theme-workshop-signal-3`, label: "clarity", value: 0.91 },
        { id: `${slide.id}-theme-workshop-signal-4`, label: "apply", value: 0.82 }
      ],
      guardrails: [
        { id: `${slide.id}-theme-workshop-guardrail-1`, label: "must-show", value: "1" },
        { id: `${slide.id}-theme-workshop-guardrail-2`, label: "review step", value: "1" },
        { id: `${slide.id}-theme-workshop-guardrail-3`, label: "quality gate", value: "1" }
      ]
    }
  ];
}

function buildThemeSlideSpec(slideType, theme) {
  switch (slideType) {
    case "cover":
    case "toc":
      return validateSlideSpec({
        cards: theme.cards,
        eyebrow: theme.eyebrow,
        note: theme.note,
        summary: theme.summary,
        title: theme.title,
        type: slideType
      });
    case "content":
      return validateSlideSpec({
        eyebrow: theme.eyebrow,
        guardrails: theme.guardrails,
        guardrailsTitle: `${theme.label} guardrails`,
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
        resourcesTitle: `${theme.label} references`,
        summary: theme.summary,
        title: theme.title,
        type: "summary"
      });
    default:
      throw new Error(`Ideate Theme does not support slide type "${slideType}" yet`);
  }
}

function buildThemeChangeSummary(slideType, theme, options = {}) {
  const modeLabel = describeVariantPersistence(options);

  switch (slideType) {
    case "cover":
    case "toc":
      return [
        `Reframed the slide around the ${theme.label.toLowerCase()}.`,
        "Rewrote the section framing and the three cards to fit the new theme direction.",
        "Kept the current slide family while changing the thematic treatment.",
        modeLabel
      ];
    case "content":
      return [
        `Reframed the signal slide around the ${theme.label.toLowerCase()}.`,
        "Retitled the signals and guardrails panels and replaced their labels to match the new theme.",
        "Kept the two-column structure while changing the theme language.",
        modeLabel
      ];
    case "summary":
      return [
        `Reframed the summary slide around the ${theme.label.toLowerCase()}.`,
        "Rewrote the checklist and supporting references around the new theme direction.",
        "Kept the same summary slide family while changing the thematic treatment.",
        modeLabel
      ];
    default:
      return [
        `Reframed the slide around the ${theme.label.toLowerCase()}.`,
        modeLabel
      ];
  }
}

function createLocalThemeCandidates(slide, currentSpec, context, options = {}) {
  return createThemeDirections(slide, currentSpec, context).map((theme) => ({
    changeSummary: buildThemeChangeSummary(currentSpec.type, theme, options),
    generator: "local",
    label: theme.label,
    model: null,
    notes: theme.notes,
    promptSummary: theme.promptSummary,
    provider: "local",
    slideSpec: buildThemeSlideSpec(currentSpec.type, theme)
  }));
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
  const modeLabel = describeVariantPersistence(options);
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
  const modeLabel = describeVariantPersistence(options);
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
  const modeLabel = describeVariantPersistence(options);

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
  const modeLabel = describeVariantPersistence(options);

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

function collectStructureContext(slide, currentSpec, context) {
  const deck = context.deck || {};
  const slideContext = context.slides[slide.id] || {};
  const slides = getSlides();
  const slideIndex = slides.findIndex((entry) => entry.id === slide.id);
  const previousSlide = slideIndex > 0 ? slides[slideIndex - 1] : null;
  const nextSlide = slideIndex >= 0 && slideIndex < slides.length - 1 ? slides[slideIndex + 1] : null;
  const outline = unique(splitLines(deck.outline));

  return {
    audience: sentence(deck.audience, "the next editor"),
    currentTitle: currentSpec.title || slide.title,
    intent: sentence(slideContext.intent, "make the slide's job clear before editing details"),
    layoutHint: sentence(slideContext.layoutHint, "use one deliberate reading path"),
    mustInclude: sentence(splitLines(slideContext.mustInclude)[0], "keep the main point visible"),
    nextTitle: sentence(nextSlide ? nextSlide.title : "", "the next slide"),
    note: sentence(splitLines(slideContext.notes)[0], "compare the candidate before applying it"),
    objective: sentence(deck.objective, "shorten the edit loop without hiding the source"),
    outlineCurrent: sentence(outline[Math.max(0, slideIndex)], intentForMissingStructure(deck, slideContext), 10),
    outlineNext: sentence(outline[Math.min(outline.length - 1, Math.max(0, slideIndex + 1))], nextSlide ? nextSlide.title : "validation", 10),
    previousTitle: sentence(previousSlide ? previousSlide.title : "", "the previous slide"),
    themeBrief: sentence(deck.themeBrief, "keep the surface quiet, readable, and deliberate"),
    tone: sentence(deck.tone, "calm and exact")
  };
}

function intentForMissingStructure(deck, slideContext) {
  return sentence(
    slideContext.intent || deck.objective,
    "make the slide's role explicit"
  );
}

function createCardStructureCandidates(currentSpec, structureContext, options = {}) {
  const modeLabel = describeVariantPersistence(options);
  const cards = Array.isArray(currentSpec.cards) ? currentSpec.cards : [];

  return [
    {
      label: "Sequence structure",
      notes: "Turns the slide into a clearer three-step sequence instead of a flat card list.",
      promptSummary: "Uses the saved outline and the next slide to reframe the card stack as a sequence.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: [
          {
            ...cards[0],
            body: toBody(`Open with ${structureContext.outlineCurrent}.`, "Open with the saved starting point."),
            title: "Start"
          },
          {
            ...cards[1],
            body: toBody(`Use ${structureContext.themeBrief}.`, "Use the shared system as the middle step."),
            title: "System"
          },
          {
            ...cards[2],
            body: toBody(`Close toward ${structureContext.outlineNext}.`, "Close on the next concrete step."),
            title: "Next"
          }
        ],
        eyebrow: "Sequence",
        note: `${structureContext.objective}. ${structureContext.note}.`,
        summary: `Frame the slide as a path from ${structureContext.outlineCurrent} toward ${structureContext.outlineNext}.`,
        title: currentSpec.title
      })
    },
    {
      label: "Boundary structure",
      notes: "Splits the slide into ownership layers so authorship, runtime, and gatekeeping are easier to read.",
      promptSummary: "Uses the deck objective and saved constraints to structure the slide around clear boundaries.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: [
          {
            ...cards[0],
            body: toBody(`Keep ${structureContext.intent}.`, "Keep the slide-specific job explicit."),
            title: "Authoring"
          },
          {
            ...cards[1],
            body: toBody(`Let the shared system carry ${structureContext.themeBrief}.`, "Let the shared system do the middle work."),
            title: "Runtime"
          },
          {
            ...cards[2],
            body: toBody(`Hold the slide to ${structureContext.mustInclude}.`, "Close on the one thing that must stay visible."),
            title: "Gate"
          }
        ],
        eyebrow: "Boundaries",
        note: `${structureContext.previousTitle} sets context; ${structureContext.nextTitle} should read like the next move.`,
        summary: "Separate authorship, runtime, and gatekeeping so the slide shows where each concern lives.",
        title: currentSpec.title
      })
    },
    {
      label: "Handoff structure",
      notes: "Frames the slide for a decision handoff by making the immediate takeaway, next step, and keep-nearby layer explicit.",
      promptSummary: "Uses audience, notes, and must-include guidance to structure the slide as a handoff surface.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: [
          {
            ...cards[0],
            body: toBody(structureContext.mustInclude, "Make the main point obvious."),
            title: "Now"
          },
          {
            ...cards[1],
            body: toBody(`Set up ${structureContext.nextTitle}.`, "Set up the next slide cleanly."),
            title: "Next"
          },
          {
            ...cards[2],
            body: toBody(`Keep the tone ${structureContext.tone} for ${structureContext.audience}.`, "Keep the surface practical for the next operator."),
            title: "Keep nearby"
          }
        ],
        eyebrow: "Handoff",
        note: `${structureContext.note}. ${structureContext.objective}.`,
        summary: "Use the slide as a handoff surface: what matters now, what happens next, and what should stay in view.",
        title: currentSpec.title
      })
    }
  ].map((variant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Reframed the three cards around a clearer narrative role instead of only changing wording or visual tone.",
      "Kept the current slide family while changing how the viewer should read the sequence.",
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

function createContentStructureCandidates(currentSpec, structureContext, options = {}) {
  const modeLabel = describeVariantPersistence(options);

  return [
    {
      label: "Sequence structure",
      notes: "Turns the scorecard into a visible operating sequence from setup through validation.",
      promptSummary: "Uses outline and adjacent slide context to structure the slide around a stepwise path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Sequence",
        guardrails: [
          { ...currentSpec.guardrails[0], label: "selected slide", value: "1" },
          { ...currentSpec.guardrails[1], label: "working file", value: "1" },
          { ...currentSpec.guardrails[2], label: "apply step", value: "1" }
        ],
        guardrailsTitle: "Sequence guardrails",
        signals: [
          { ...currentSpec.signals[0], label: "brief", value: currentSpec.signals[0].value },
          { ...currentSpec.signals[2], label: "layout", value: currentSpec.signals[2].value },
          { ...currentSpec.signals[1], label: "render", value: currentSpec.signals[1].value },
          { ...currentSpec.signals[3], label: "validate", value: currentSpec.signals[3].value }
        ],
        signalsTitle: "Sequence checkpoints",
        summary: `Turn the slide into a visible path from ${structureContext.outlineCurrent} toward ${structureContext.outlineNext}.`,
        title: currentSpec.title
      })
    },
    {
      label: "Boundary structure",
      notes: "Splits the left and right columns into responsibility layers instead of a generic signal scorecard.",
      promptSummary: "Uses the saved slide intent and deck objective to structure the slide around ownership boundaries.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Boundaries",
        guardrails: [
          { ...currentSpec.guardrails[0], label: "slide source", value: "1" },
          { ...currentSpec.guardrails[1], label: "shared engine", value: "1" },
          { ...currentSpec.guardrails[2], label: "quality gate", value: "1" }
        ],
        guardrailsTitle: "Boundary checks",
        signals: [
          { ...currentSpec.signals[0], label: "authoring", value: currentSpec.signals[0].value },
          { ...currentSpec.signals[2], label: "system", value: currentSpec.signals[2].value },
          { ...currentSpec.signals[1], label: "runtime", value: currentSpec.signals[1].value },
          { ...currentSpec.signals[3], label: "gate", value: currentSpec.signals[3].value }
        ],
        signalsTitle: "Responsibility split",
        summary: "Separate authorship, runtime, and gatekeeping so the slide reads like a boundary map rather than a flat scorecard.",
        title: currentSpec.title
      })
    },
    {
      label: "Decision structure",
      notes: "Frames the slide around the next decision by pulling the main evidence, boundary, and next move into a clearer structure.",
      promptSummary: "Uses must-include and slide notes to structure the slide around a decision and handoff path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Decision",
        guardrails: [
          { ...currentSpec.guardrails[0], label: "must-show", value: "1" },
          { ...currentSpec.guardrails[1], label: "compare pass", value: "1" },
          { ...currentSpec.guardrails[2], label: "apply once", value: "1" }
        ],
        guardrailsTitle: "Decision checks",
        signals: [
          { ...currentSpec.signals[0], label: "claim", value: currentSpec.signals[0].value },
          { ...currentSpec.signals[3], label: "proof", value: currentSpec.signals[3].value },
          { ...currentSpec.signals[2], label: "boundary", value: currentSpec.signals[2].value },
          { ...currentSpec.signals[1], label: "next step", value: currentSpec.signals[1].value }
        ],
        signalsTitle: "Decision inputs",
        summary: `Use the slide to support one decision for ${structureContext.audience}, then hand off cleanly to ${structureContext.nextTitle}.`,
        title: currentSpec.title
      })
    }
  ].map((variant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Retitled the two panels and relabeled the rows so the slide reads like a clearer framework.",
      "Kept the content slide family while changing the structural role of each column.",
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

function createSummaryStructureCandidates(currentSpec, structureContext, options = {}) {
  const modeLabel = describeVariantPersistence(options);

  return [
    {
      label: "Operating structure",
      notes: "Turns the closing slide into a cleaner operating sequence instead of a loose recap.",
      promptSummary: "Uses the deck objective and slide outline to structure the checklist as a run path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: [
          { ...currentSpec.bullets[0], title: "Prepare", body: toBody(`Start with ${structureContext.outlineCurrent}.`, "Start with the saved setup.") },
          { ...currentSpec.bullets[1], title: "Run", body: toBody(`Move toward ${structureContext.outlineNext}.`, "Move through the active workflow.") },
          { ...currentSpec.bullets[2], title: "Check", body: toBody(structureContext.mustInclude, "Keep the final check visible.") }
        ],
        eyebrow: "Run path",
        resources: currentSpec.resources.map((item) => ({ ...item })),
        resourcesTitle: "Run surface",
        summary: "Structure the close as a run path: prepare, run, and check before handoff.",
        title: currentSpec.title
      })
    },
    {
      label: "Ownership structure",
      notes: "Reframes the close around which layer owns what so the repo boundary is easier to keep in mind.",
      promptSummary: "Uses slide intent, theme brief, and runtime boundaries to structure the summary by ownership.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: [
          { ...currentSpec.bullets[0], title: "Slide layer", body: toBody(structureContext.intent, "Keep slide-specific content local.") },
          { ...currentSpec.bullets[1], title: "Shared layer", body: toBody(structureContext.themeBrief, "Let the shared system carry layout rules.") },
          { ...currentSpec.bullets[2], title: "Gate layer", body: toBody(`Close with ${structureContext.note}.`, "Close with explicit validation.") }
        ],
        eyebrow: "Ownership",
        resources: currentSpec.resources.map((item) => ({ ...item })),
        resourcesTitle: "Where each part lives",
        summary: "Use the close to separate slide content, shared runtime concerns, and the final validation gate.",
        title: currentSpec.title
      })
    },
    {
      label: "Handoff structure",
      notes: "Frames the final slide for the next operator by separating what to do now, what happens next, and what to keep nearby.",
      promptSummary: "Uses audience, must-include, and notes to structure the close as a handoff surface.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: [
          { ...currentSpec.bullets[0], title: "Do now", body: toBody(structureContext.mustInclude, "Do the main thing now.") },
          { ...currentSpec.bullets[1], title: "Do next", body: toBody(`Set up ${structureContext.nextTitle}.`, "Set up the next move.") },
          { ...currentSpec.bullets[2], title: "Keep in view", body: toBody(structureContext.note, "Keep the review step visible.") }
        ],
        eyebrow: "Handoff",
        resources: currentSpec.resources.map((item) => ({ ...item })),
        resourcesTitle: "Keep nearby",
        summary: `Use the close as a handoff for ${structureContext.audience}: do one thing now, set up the next step, and keep the right references nearby.`,
        title: currentSpec.title
      })
    }
  ].map((variant) => ({
    changeSummary: [
      `Reworked the ${currentSpec.type} slide toward a ${variant.label.toLowerCase()}.`,
      "Rewrote the checklist roles so the close reads like a clearer structure rather than a loose recap.",
      "Kept the summary slide family while changing how the viewer should use the slide.",
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

function createLocalStructureCandidates(slide, currentSpec, context, options = {}) {
  const structureContext = collectStructureContext(slide, currentSpec, context);

  switch (currentSpec.type) {
    case "cover":
    case "toc":
      return createCardStructureCandidates(currentSpec, structureContext, options);
    case "content":
      return createContentStructureCandidates(currentSpec, structureContext, options);
    case "summary":
      return createSummaryStructureCandidates(currentSpec, structureContext, options);
    default:
      throw new Error(`Ideate Structure does not support slide type "${currentSpec.type}" yet`);
  }
}

function toOutlineLines(value) {
  return unique(splitLines(value)).map((line) => sentence(line, "Untitled section", 8));
}

function collectDeckStructureContext(context) {
  const deck = context.deck || {};
  const slides = getSlides();
  const outlineLines = toOutlineLines(deck.outline);

  return {
    audience: sentence(deck.audience, "the next editor"),
    constraints: sentence(getDeckConstraintLines(deck)[0], "keep the shared runtime as the source of truth"),
    objective: sentence(deck.objective, "turn deck editing into a repeatable studio loop"),
    outlineLines,
    slides: slides.map((slide, index) => {
      const slideContext = context.slides[slide.id] || {};
      let slideSpec = null;
      try {
        slideSpec = readSlideSpec(slide.id);
      } catch (error) {
        slideSpec = null;
      }
      return {
        currentTitle: slideContext.title || (slideSpec && slideSpec.title) || slide.title,
        id: slide.id,
        index: slide.index,
        intent: sentence(slideContext.intent, slideSpec && slideSpec.summary ? slideSpec.summary : "make the slide's job clear"),
        outlineLine: outlineLines[index] || sentence(slideSpec && slideSpec.title ? slideSpec.title : slide.title, "Untitled section", 8),
        summary: sentence(slideSpec && slideSpec.summary ? slideSpec.summary : slide.title, slideSpec && slideSpec.title ? slideSpec.title : slide.title, 12),
        type: slideSpec && slideSpec.type ? slideSpec.type : null
      };
    }),
    themeBrief: sentence(deck.themeBrief, "keep the surface quiet, readable, and deliberate"),
    title: sentence(deck.title, "Presentation Studio", 10),
    tone: sentence(deck.tone, "calm and exact")
  };
}

function createInsertedDecisionCriteriaSlide(context, proposedIndex) {
  return validateSlideSpec({
    eyebrow: "Decision criteria",
    guardrails: [
      { id: `decision-criteria-guardrail-1`, label: "must-include", value: "1" },
      { id: `decision-criteria-guardrail-2`, label: "apply step", value: "1" },
      { id: `decision-criteria-guardrail-3`, label: "preview pass", value: "1" }
    ],
    guardrailsTitle: "Decision checks",
    index: proposedIndex,
    signals: [
      { id: `decision-criteria-signal-1`, label: "claim", value: 0.9 },
      { id: `decision-criteria-signal-2`, label: "options", value: 0.86 },
      { id: `decision-criteria-signal-3`, label: "proof", value: 0.92 },
      { id: `decision-criteria-signal-4`, label: "action", value: 0.84 }
    ],
    signalsTitle: "Decision inputs",
    summary: `Surface the criteria that connect ${context.slides[1] ? context.slides[1].currentTitle : "structure options"} to ${context.slides[2] ? context.slides[2].currentTitle : "proof"}.`,
    title: "Decision criteria",
    type: "content"
  });
}

function createReplacementOperatorChecklistSlide(context, proposedIndex, proposedTitle) {
  const proofSlide = context.slides.find((slide) => slide.index === 3);
  const proofTitle = proofSlide ? proofSlide.currentTitle : "the proof block";

  return validateSlideSpec({
    bullets: [
      {
        body: `Restate the main decision with ${proofTitle} attached as the supporting evidence.`,
        id: "operator-checklist-bullet-1",
        title: "State the call"
      },
      {
        body: "Carry forward the guardrails and the one apply path before asking for sign-off.",
        id: "operator-checklist-bullet-2",
        title: "Carry the guardrails"
      },
      {
        body: "Close with the explicit next owner, timing, and preview check that keeps the deck honest.",
        id: "operator-checklist-bullet-3",
        title: "Name the next move"
      }
    ],
    eyebrow: "Operator checklist",
    index: proposedIndex,
    resources: [
      {
        body: "Saved outline plus promoted slide titles and order",
        id: "operator-checklist-resource-1",
        title: "Plan source",
        bodyFontSize: 10.8
      },
      {
        body: "Preview rebuild plus npm run quality:gate",
        id: "operator-checklist-resource-2",
        title: "Approval gate",
        bodyFontSize: 10.8
      }
    ],
    resourcesTitle: "Keep nearby",
    summary: `Replace the closing slide with one operator-ready checklist that turns ${proofTitle} into an explicit handoff.`,
    title: proposedTitle || "Operator checklist",
    type: "summary"
  });
}

function rewriteCoverSlideSpec(baseSpec, proposedIndex, proposedTitle, content) {
  return validateSlideSpec({
    cards: baseSpec.cards.map((card, index) => ({
      ...card,
      body: content.cards[index].body,
      title: content.cards[index].title
    })),
    eyebrow: content.eyebrow,
    index: proposedIndex,
    note: content.note,
    summary: content.summary,
    title: proposedTitle,
    type: "cover"
  });
}

function rewriteTocSlideSpec(baseSpec, proposedIndex, proposedTitle, content) {
  return validateSlideSpec({
    cards: baseSpec.cards.map((card, index) => ({
      ...card,
      body: content.cards[index].body,
      title: content.cards[index].title
    })),
    eyebrow: content.eyebrow,
    index: proposedIndex,
    note: content.note,
    summary: content.summary,
    title: proposedTitle,
    type: "toc"
  });
}

function rewriteContentSlideSpec(baseSpec, proposedIndex, proposedTitle, content) {
  return validateSlideSpec({
    eyebrow: content.eyebrow,
    guardrails: baseSpec.guardrails.map((guardrail, index) => ({
      ...guardrail,
      label: content.guardrails[index].label,
      value: content.guardrails[index].value
    })),
    guardrailsTitle: content.guardrailsTitle,
    index: proposedIndex,
    signals: baseSpec.signals.map((signal, index) => ({
      ...signal,
      label: content.signals[index].label,
      value: content.signals[index].value
    })),
    signalsTitle: content.signalsTitle,
    summary: content.summary,
    title: proposedTitle,
    type: "content"
  });
}

function rewriteSummarySlideSpec(baseSpec, proposedIndex, proposedTitle, content) {
  return validateSlideSpec({
    bullets: baseSpec.bullets.map((bullet, index) => ({
      ...bullet,
      body: content.bullets[index].body,
      title: content.bullets[index].title
    })),
    eyebrow: content.eyebrow,
    index: proposedIndex,
    resources: baseSpec.resources.map((resource, index) => ({
      ...resource,
      body: content.resources[index].body,
      title: content.resources[index].title
    })),
    resourcesTitle: content.resourcesTitle,
    summary: content.summary,
    title: proposedTitle,
    type: "summary"
  });
}

function createDeckWideAuthoringPlan(context, definition) {
  return createDeckStructurePlan(context, {
    ...definition,
    kindLabel: definition.kindLabel || "Deck authoring",
    replacements: context.slides.map((slide, index) => ({
      createSlideSpec: (currentContext, proposedIndex, proposedTitle, currentSlide) => {
        const currentSpec = readSlideSpec(currentSlide.id);
        return definition.createSlideSpec(currentContext, {
          currentSlide,
          currentSpec,
          index,
          proposedIndex,
          proposedTitle
        });
      },
      currentIndex: slide.index,
      slideId: slide.id,
      summary: typeof definition.replacementSummary === "function"
        ? definition.replacementSummary(slide, index)
        : `Rewrite ${slide.currentTitle} as part of the ${definition.label.toLowerCase()} pass.`,
      type: slide.type || "content"
    })),
    titles: definition.titles
  });
}

function createDecisionDeckPatch(context) {
  return {
    subject: `Decision support for ${context.audience}`,
    themeBrief: "keep the deck crisp, direct, and centered on one decision path",
    tone: "decisive and evidence-led",
    visualTheme: {
      accent: "d97a2b",
      primary: "15304a",
      progressFill: "15304a",
      secondary: "215e8b"
    }
  };
}

function createOperatorDeckPatch() {
  return {
    subject: "Operator handoff and maintenance routine",
    themeBrief: "keep the deck sober, maintenance-oriented, and checklist-friendly",
    tone: "operational and exact",
    visualTheme: {
      accent: "4f7a28",
      panel: "f7faf7",
      progressFill: "4f7a28",
      secondary: "325d52"
    }
  };
}

function createBoundaryDeckPatch() {
  return {
    subject: "Ownership boundary map",
    themeBrief: "make boundaries explicit and keep the deck cleanly sectioned",
    tone: "structural and exact",
    visualTheme: {
      accent: "6b8de3",
      panel: "f5f8ff",
      progressFill: "275d8c",
      secondary: "3f67a8"
    }
  };
}

function createSequenceDeckPatch() {
  return {
    subject: "Start-to-finish operating sequence",
    themeBrief: "keep the deck sequential, concrete, and easy to follow from frame to handoff",
    tone: "linear, practical, and calm",
    visualTheme: {
      accent: "c76d2a",
      primary: "173449",
      progressFill: "2c6b73",
      secondary: "2c6b73"
    }
  };
}

function createCompressedDeckPatch() {
  return {
    designConstraints: {
      maxWordsPerSlide: 65,
      minContentGapIn: 0.22
    },
    subject: "Compressed proof and handoff path",
    themeBrief: "keep only the framing, proof, and handoff beats that survive a shorter run",
    tone: "brief, evidence-led, and action-oriented",
    visualTheme: {
      accent: "b05f2a",
      muted: "4f6070",
      progressFill: "b05f2a",
      secondary: "2f5f69"
    }
  };
}

function createComposedDecisionHandoffDeckPatch(context) {
  const decisionPatch = createDecisionDeckPatch(context);

  return {
    ...decisionPatch,
    designConstraints: {
      maxWordsPerSlide: 70,
      minContentGapIn: 0.2
    },
    subject: "Composed decision handoff",
    themeBrief: "keep decision criteria, proof, and operator handoff in one tight path",
    tone: "decisive, operational, and concise",
    visualTheme: {
      ...decisionPatch.visualTheme,
      panel: "f7faf7",
      progressFill: "d97a2b",
      secondary: "325d52"
    }
  };
}

function describeDeckPlanAction({ moved, replaced, retitled }) {
  if (moved && retitled && replaced) {
    return "move-retitle-and-replace";
  }

  if (moved && replaced) {
    return "move-and-replace";
  }

  if (retitled && replaced) {
    return "retitle-and-replace";
  }

  if (replaced) {
    return "replace";
  }

  if (moved && retitled) {
    return "move-and-retitle";
  }

  if (moved) {
    return "move";
  }

  if (retitled) {
    return "retitle";
  }

  return "keep";
}

function matchesDeckPlanSlide(entry, slide, sourceIndex) {
  return (
    (typeof entry.slideId === "string" && entry.slideId === slide.id)
    || (Number.isFinite(entry.currentIndex) && entry.currentIndex === slide.index)
    || (Number.isFinite(entry.sourceIndex) && entry.sourceIndex === sourceIndex)
  );
}

function buildRemovedDeckPlanEntry(context, removal, index) {
  const sourceIndex = Number.isFinite(removal.sourceIndex)
    ? removal.sourceIndex
    : context.slides.findIndex((slide) => (
      (typeof removal.slideId === "string" && removal.slideId === slide.id)
      || (Number.isFinite(removal.currentIndex) && removal.currentIndex === slide.index)
    ));
  const slide = context.slides[sourceIndex];

  if (!slide) {
    return null;
  }

  return {
    action: "remove",
    currentIndex: slide.index,
    currentTitle: slide.currentTitle,
    proposedIndex: null,
    proposedTitle: "",
    rationale: removal.rationale || removal.summary || `Remove ${slide.currentTitle} from the live deck path.`,
    replacement: null,
    role: removal.role || `Removed beat ${index + 1}`,
    slideId: slide.id,
    summary: removal.summary || `Archive ${slide.currentTitle} so the remaining deck moves faster.`,
    type: slide.type
  };
}

function collectDeckPlanStats(slides) {
  const stats = {
    archived: 0,
    inserted: 0,
    moved: 0,
    replaced: 0,
    shared: 0,
    retitled: 0,
    total: Array.isArray(slides) ? slides.length : 0
  };

  (Array.isArray(slides) ? slides : []).forEach((slide) => {
    const action = String(slide && slide.action ? slide.action : "");

    if (action === "insert") {
      stats.inserted += 1;
      return;
    }

    if (action === "remove") {
      stats.archived += 1;
      return;
    }

    if (action.includes("move")) {
      stats.moved += 1;
    }

    if (action.includes("replace")) {
      stats.replaced += 1;
    }

    if (action.includes("retitle")) {
      stats.retitled += 1;
    }
  });

  return stats;
}

function getDeckPlanLiveSlides(slides) {
  return (Array.isArray(slides) ? slides : [])
    .filter((slide) => Number.isFinite(slide.proposedIndex) && slide.proposedTitle)
    .slice()
    .sort((left, right) => left.proposedIndex - right.proposedIndex);
}

const deckPlanDeckFieldLabels = {
  audience: "Audience",
  author: "Author",
  company: "Company",
  constraints: "Constraints",
  lang: "Language",
  objective: "Objective",
  subject: "Subject",
  themeBrief: "Theme brief",
  title: "Deck title",
  tone: "Tone"
};

const deckPlanDesignConstraintLabels = {
  maxWordsPerSlide: "Max words per slide",
  minCaptionGapIn: "Min caption gap",
  minContentGapIn: "Min content gap",
  minFontSizePt: "Min font size",
  minPanelPaddingIn: "Min panel padding"
};

const deckPlanThemeLabels = {
  accent: "Accent color",
  bg: "Background color",
  light: "Light color",
  muted: "Muted color",
  panel: "Panel color",
  primary: "Primary color",
  progressFill: "Progress fill",
  progressTrack: "Progress track",
  secondary: "Secondary color",
  surface: "Surface color"
};

function formatDeckPlanDiffValue(value, kind = "text") {
  if (value == null || value === "") {
    return "(empty)";
  }

  if (kind === "color") {
    const normalized = String(value).trim().replace(/^#/, "");
    return /^[0-9a-fA-F]{6}$/.test(normalized) ? `#${normalized}` : String(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function buildDeckContextDiff(context, deckPatch) {
  if (!deckPatch || typeof deckPatch !== "object") {
    return {
      changes: [],
      count: 0,
      summary: "No shared deck changes."
    };
  }

  const currentDeck = context && context.deck && typeof context.deck === "object"
    ? context.deck
    : {};
  const changes = [];

  Object.entries(deckPlanDeckFieldLabels).forEach(([field, label]) => {
    if (!Object.prototype.hasOwnProperty.call(deckPatch, field)) {
      return;
    }

    if (deckPatch[field] === currentDeck[field]) {
      return;
    }

    changes.push({
      after: formatDeckPlanDiffValue(deckPatch[field]),
      before: formatDeckPlanDiffValue(currentDeck[field]),
      field,
      label,
      scope: "deck"
    });
  });

  const designConstraints = deckPatch.designConstraints && typeof deckPatch.designConstraints === "object"
    ? deckPatch.designConstraints
    : null;
  if (designConstraints) {
    Object.entries(deckPlanDesignConstraintLabels).forEach(([field, label]) => {
      if (!Object.prototype.hasOwnProperty.call(designConstraints, field)) {
        return;
      }

      const currentValue = currentDeck.designConstraints && currentDeck.designConstraints[field];
      const nextValue = designConstraints[field];
      if (nextValue === currentValue) {
        return;
      }

      changes.push({
        after: formatDeckPlanDiffValue(nextValue),
        before: formatDeckPlanDiffValue(currentValue),
        field,
        label,
        scope: "design-constraint"
      });
    });
  }

  const visualTheme = deckPatch.visualTheme && typeof deckPatch.visualTheme === "object"
    ? deckPatch.visualTheme
    : null;
  if (visualTheme) {
    Object.entries(deckPlanThemeLabels).forEach(([field, label]) => {
      if (!Object.prototype.hasOwnProperty.call(visualTheme, field)) {
        return;
      }

      const currentValue = currentDeck.visualTheme && currentDeck.visualTheme[field];
      const nextValue = visualTheme[field];
      if (nextValue === currentValue) {
        return;
      }

      changes.push({
        after: formatDeckPlanDiffValue(nextValue, "color"),
        before: formatDeckPlanDiffValue(currentValue, "color"),
        field,
        label,
        scope: "visual-theme"
      });
    });
  }

  return {
    changes,
    count: changes.length,
    summary: changes.length
      ? `${changes.length} shared deck setting${changes.length === 1 ? "" : "s"} change.`
      : "No shared deck changes."
  };
}

function buildDeckPlanStatsSummary(stats) {
  const parts = [];

  if (stats.inserted) {
    parts.push(`${stats.inserted} insert`);
  }

  if (stats.replaced) {
    parts.push(`${stats.replaced} replace`);
  }

  if (stats.archived) {
    parts.push(`${stats.archived} archive`);
  }

  if (stats.moved) {
    parts.push(`${stats.moved} move`);
  }

  if (stats.retitled) {
    parts.push(`${stats.retitled} retitle`);
  }

  if (stats.shared) {
    parts.push(`${stats.shared} shared`);
  }

  return parts.length ? parts.join(", ") : "keep-only plan";
}

function buildDeckPlanActionCue(slide) {
  const action = String(slide && slide.action ? slide.action : "");
  const currentTitle = slide && slide.currentTitle ? slide.currentTitle : "Untitled";
  const proposedTitle = slide && slide.proposedTitle ? slide.proposedTitle : currentTitle;

  if (action === "insert") {
    return `Insert ${proposedTitle} at ${slide.proposedIndex} as a new ${slide.type || "slide"} beat.`;
  }

  if (action === "remove") {
    return `Archive ${currentTitle} from the live deck while keeping the source recoverable.`;
  }

  if (action.includes("replace")) {
    return `Replace ${currentTitle} with ${proposedTitle} and keep the slide file under guarded apply.`;
  }

  if (action.includes("move")) {
    return `Move ${currentTitle} to ${slide.proposedIndex}${action.includes("retitle") ? ` and retitle it to ${proposedTitle}` : ""}.`;
  }

  if (action.includes("retitle")) {
    return `Retitle ${currentTitle} to ${proposedTitle}.`;
  }

  return `Keep ${currentTitle} in the live deck.`;
}

function getDeckPlanChangeKinds(action) {
  const normalized = String(action || "");
  const changeKinds = [];

  if (normalized === "insert") {
    return ["create"];
  }

  if (normalized === "remove") {
    return ["archive"];
  }

  if (normalized.includes("move")) {
    changeKinds.push("reorder");
  }

  if (normalized.includes("retitle")) {
    changeKinds.push("retitle");
  }

  if (normalized.includes("replace")) {
    changeKinds.push("replace");
  }

  return changeKinds.length ? changeKinds : ["keep"];
}

function buildDeckPlanPreviewHint(slide) {
  const action = String(slide && slide.action ? slide.action : "keep");
  const currentIndex = Number.isFinite(slide && slide.currentIndex) ? slide.currentIndex : null;
  const proposedIndex = Number.isFinite(slide && slide.proposedIndex) ? slide.proposedIndex : null;
  const currentTitle = slide && slide.currentTitle ? slide.currentTitle : "Untitled";
  const proposedTitle = slide && slide.proposedTitle ? slide.proposedTitle : currentTitle;

  return {
    action,
    cue: buildDeckPlanActionCue(slide),
    currentIndex,
    currentTitle,
    previewState: currentIndex ? "current" : "scaffold",
    proposedIndex,
    proposedTitle,
    slideId: slide && slide.slideId ? slide.slideId : null,
    type: slide && slide.type ? slide.type : null
  };
}

function buildDeckPlanDiff(context, slides, planStats, deckPatch) {
  const currentSequence = context.slides.map((slide) => ({
    index: slide.index,
    title: slide.currentTitle
  }));
  const proposedSequence = getDeckPlanLiveSlides(slides).map((slide) => ({
    index: slide.proposedIndex,
    title: slide.proposedTitle
  }));
  const nextStructuredFile = peekNextStructuredSlideFileName();
  const changedSlides = (Array.isArray(slides) ? slides : []).filter((slide) => String(slide && slide.action ? slide.action : "") !== "keep");
  const deck = buildDeckContextDiff(context, deckPatch);
  const insertedTitles = changedSlides
    .filter((slide) => String(slide.action || "") === "insert")
    .map((slide) => slide.proposedTitle)
    .filter(Boolean);
  const archivedTitles = changedSlides
    .filter((slide) => String(slide.action || "") === "remove")
    .map((slide) => slide.currentTitle)
    .filter(Boolean);
  const files = changedSlides.map((slide) => {
    const changeKinds = getDeckPlanChangeKinds(slide.action);
    const targetPath = slide.action === "insert"
      ? path.join("slides", nextStructuredFile)
      : path.join("slides", `${slide.slideId}.json`);

    return {
      after: slide.action === "remove"
        ? "(archived from live deck)"
        : slide.proposedTitle || slide.currentTitle || "",
      before: slide.action === "insert"
        ? "(new slide)"
        : slide.currentTitle || "",
      changeKinds,
      currentIndex: Number.isFinite(slide.currentIndex) ? slide.currentIndex : null,
      note: buildDeckPlanActionCue(slide),
      proposedIndex: Number.isFinite(slide.proposedIndex) ? slide.proposedIndex : null,
      slideId: slide.slideId || null,
      targetPath
    };
  });

  return {
    counts: {
      afterSlides: proposedSequence.length,
      archived: planStats.archived,
      beforeSlides: currentSequence.length,
      inserted: planStats.inserted,
      moved: planStats.moved,
      replaced: planStats.replaced,
      shared: deck.count,
      retitled: planStats.retitled
    },
    deck,
    files,
    outline: {
      added: insertedTitles,
      archived: archivedTitles,
      currentSequence,
      moved: changedSlides
        .filter((slide) => String(slide.action || "").includes("move") && Number.isFinite(slide.proposedIndex))
        .map((slide) => ({
          from: slide.currentIndex,
          title: slide.currentTitle,
          to: slide.proposedIndex
        })),
      proposedSequence,
      retitled: changedSlides
        .filter((slide) => String(slide.action || "").includes("retitle"))
        .map((slide) => ({
          after: slide.proposedTitle,
          before: slide.currentTitle
        }))
    },
    summary: currentSequence.length === proposedSequence.length
      ? `Live deck stays at ${proposedSequence.length} slides while changing ${files.length} file target${files.length === 1 ? "" : "s"}.`
      : `Live deck changes from ${currentSequence.length} to ${proposedSequence.length} slides while changing ${files.length} file target${files.length === 1 ? "" : "s"}.`
  };
}

function restoreDeckStructurePreviewState(originalSpecs) {
  originalSpecs.forEach((slideSpec, slideId) => {
    writeSlideSpec(slideId, slideSpec);
  });

  const currentSlides = getSlides({ includeArchived: true });
  currentSlides.forEach((slide) => {
    if (!originalSpecs.has(slide.id)) {
      removeAllowedPath(slide.path, { force: true });
    }
  });
}

async function renderDeckStructureCandidatePreview(candidate) {
  const originalSlides = getSlides({ includeArchived: true });
  const originalSpecs = new Map(originalSlides.map((slide) => [slide.id, readSlideSpec(slide.id)]));
  const originalContext = getDeckContext();
  const candidateDir = path.join(deckStructurePreviewDir, candidate.id);
  const currentRenderedPages = listPages(previewDir);

  ensureAllowedDir(deckStructurePreviewDir);
  removeAllowedPath(candidateDir, { force: true, recursive: true });
  ensureAllowedDir(candidateDir);

  try {
    const currentCopiedPages = currentRenderedPages.map((pageFile, index) => {
      const targetPath = path.join(candidateDir, `before-page-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);
      return targetPath;
    });
    const currentStripPath = path.join(candidateDir, "current-strip.png");
    if (currentCopiedPages.length) {
      createContactSheet(currentCopiedPages, currentStripPath);
    }

    applyDeckStructurePlan({
      deckPatch: candidate.deckPatch,
      label: candidate.label,
      outline: candidate.outline,
      slides: candidate.slides,
      summary: candidate.summary
    });

    await applyDeckStructureCandidate(candidate, {
      promoteIndices: true,
      promoteInsertions: true,
      promoteRemovals: true,
      promoteReplacements: true,
      promoteTitles: true
    });

    const renderedPages = listPages(previewDir);
    const copiedPages = renderedPages.map((pageFile, index) => {
      const targetPath = path.join(candidateDir, `page-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);
      return targetPath;
    });
    const stripPath = path.join(candidateDir, "strip.png");
    createContactSheet(copiedPages, stripPath);

    const preview = candidate.preview || {};
    const previewHints = Array.isArray(preview.previewHints) ? preview.previewHints : [];
    const renderedHints = previewHints.map((hint, index) => {
      const pageFile = Number.isFinite(hint.proposedIndex) ? copiedPages[hint.proposedIndex - 1] : null;

      if (!pageFile || !fs.existsSync(pageFile)) {
        return {
          ...hint,
          proposedPreview: null
        };
      }

      const targetPath = path.join(candidateDir, `hint-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);

      return {
        ...hint,
        proposedPreview: {
          fileName: path.basename(targetPath),
          url: asAssetUrl(targetPath)
        }
      };
    });

    candidate.preview = {
      ...preview,
      currentStrip: fs.existsSync(currentStripPath)
        ? {
          fileName: path.basename(currentStripPath),
          pageCount: currentCopiedPages.length,
          url: asAssetUrl(currentStripPath)
        }
        : null,
      previewHints: renderedHints,
      strip: {
        fileName: path.basename(stripPath),
        pageCount: copiedPages.length,
        url: asAssetUrl(stripPath)
      }
    };
  } finally {
    restoreDeckStructurePreviewState(originalSpecs);
    saveDeckContext(originalContext);
    await buildAndRenderDeck();
  }
}

function buildDeckPlanPreview(context, slides, planStats, deckDiff) {
  const currentSequence = context.slides.map((slide) => ({
    id: slide.id,
    index: slide.index,
    title: slide.currentTitle
  }));
  const proposedSequence = getDeckPlanLiveSlides(slides).map((slide) => ({
    action: slide.action,
    index: slide.proposedIndex,
    title: slide.proposedTitle
  }));
  const changedSlides = (Array.isArray(slides) ? slides : []).filter((slide) => String(slide && slide.action ? slide.action : "") !== "keep");
  const cues = changedSlides.slice(0, 3).map((slide) => buildDeckPlanActionCue(slide));
  const deckCues = deckDiff && Array.isArray(deckDiff.changes)
    ? deckDiff.changes.slice(0, 2).map((change) => `Set ${change.label.toLowerCase()} to ${change.after}.`)
    : [];
  const previewHints = changedSlides.slice(0, 4).map((slide) => buildDeckPlanPreviewHint(slide));
  const overview = proposedSequence.length === currentSequence.length
    ? `Live deck stays at ${proposedSequence.length} slides with ${buildDeckPlanStatsSummary(planStats)}.`
    : `Live deck changes from ${currentSequence.length} to ${proposedSequence.length} slides with ${buildDeckPlanStatsSummary(planStats)}.`;

  return {
    currentSequence,
    deckCues,
    overview,
    proposedSequence,
    cues: cues.concat(deckCues),
    previewHints
  };
}

function buildDeckPlanChangeSummary(definition, preview) {
  return [
    definition.changeLead,
    preview.overview,
    ...preview.cues.slice(0, 2),
    "Applying this candidate stays inside the guarded slide-file promotion path."
  ];
}

function buildDeckPlanEntries(context, definition) {
  const insertions = Array.isArray(definition.insertions) ? definition.insertions.slice() : [];
  const removals = Array.isArray(definition.removals) ? definition.removals.slice() : [];
  const replacements = Array.isArray(definition.replacements) ? definition.replacements.slice() : [];
  const removalSourceIndexes = new Set(
    removals
      .map((entry) => {
        if (Number.isFinite(entry.sourceIndex)) {
          return entry.sourceIndex;
        }

        return context.slides.findIndex((slide, sourceIndex) => matchesDeckPlanSlide(entry, slide, sourceIndex));
      })
      .filter((value) => Number.isFinite(value) && value >= 0)
  );
  const keptOrder = Array.isArray(definition.order) && definition.order.length
    ? definition.order.filter((sourceIndex) => !removalSourceIndexes.has(sourceIndex))
    : context.slides
      .map((_, index) => index)
      .filter((sourceIndex) => !removalSourceIndexes.has(sourceIndex));
  const totalEntries = keptOrder.length + insertions.length;
  const entries = [];
  let existingCursor = 0;

  for (let proposedPosition = 0; proposedPosition < totalEntries; proposedPosition += 1) {
    const insertion = insertions.find((entry) => entry.proposedIndex === proposedPosition + 1);
    const role = definition.roles[proposedPosition] || `Beat ${proposedPosition + 1}`;
    const title = definition.titles[proposedPosition];
    const focus = definition.focus[proposedPosition];
    const rationale = definition.rationales[proposedPosition] || focus || role;

    if (insertion) {
      const insertedTitle = title || insertion.title;
      entries.push({
        action: "insert",
        currentIndex: null,
        currentTitle: "",
        proposedIndex: proposedPosition + 1,
        proposedTitle: insertedTitle,
        rationale,
        role,
        scaffold: {
          slideSpec: insertion.createSlideSpec(context, proposedPosition + 1)
        },
        slideId: null,
        summary: focus || insertion.summary || rationale,
        type: insertion.type || "content"
      });
      continue;
    }

    const slide = context.slides[keptOrder[existingCursor]];
    existingCursor += 1;
    const nextTitle = title || slide.outlineLine || slide.currentTitle;
    const nextFocus = focus || slide.intent;
    const moved = slide.index !== proposedPosition + 1;
    const retitled = normalizeSentence(nextTitle).toLowerCase() !== normalizeSentence(slide.currentTitle).toLowerCase();
    const sourceIndex = keptOrder[existingCursor - 1];
    const replacement = replacements.find((entry) => matchesDeckPlanSlide(entry, slide, sourceIndex));
    const replacementSlideSpec = replacement && typeof replacement.createSlideSpec === "function"
      ? replacement.createSlideSpec(context, proposedPosition + 1, nextTitle, slide)
      : null;
    const replaced = Boolean(replacementSlideSpec);
    const action = describeDeckPlanAction({ moved, replaced, retitled });

    entries.push({
      action,
      currentIndex: slide.index,
      currentTitle: slide.currentTitle,
      proposedIndex: proposedPosition + 1,
      proposedTitle: nextTitle,
      rationale,
      replacement: replacementSlideSpec
        ? {
          slideSpec: replacementSlideSpec
        }
        : null,
      role,
      slideId: slide.id,
      summary: replacement && replacement.summary ? replacement.summary : nextFocus,
      type: replacement && replacement.type ? replacement.type : slide.type
    });
  }

  removals
    .map((removal, index) => buildRemovedDeckPlanEntry(context, removal, index))
    .filter(Boolean)
    .forEach((entry) => entries.push(entry));

  return entries;
}

function createDeckStructurePlan(context, definition) {
  const slides = buildDeckPlanEntries(context, definition);
  const planStats = collectDeckPlanStats(slides);
  const deckPatch = definition && definition.deckPatch && typeof definition.deckPatch === "object"
    ? definition.deckPatch
    : null;
  const diff = buildDeckPlanDiff(context, slides, planStats, deckPatch);
  planStats.shared = diff.deck && Number.isFinite(diff.deck.count) ? diff.deck.count : 0;
  const preview = buildDeckPlanPreview(context, slides, planStats, diff.deck);

  return {
    changeSummary: buildDeckPlanChangeSummary(definition, preview),
    deckPatch,
    id: `deck-structure-${definition.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    kindLabel: definition.kindLabel || "Deck plan",
    label: definition.label,
    notes: definition.notes,
    outline: slides
      .filter((slide) => Number.isFinite(slide.proposedIndex) && slide.proposedTitle)
      .map((slide) => slide.proposedTitle)
      .join("\n"),
    diff,
    planStats,
    preview,
    promptSummary: definition.promptSummary,
    slides,
    summary: definition.summary
  };
}

function createLocalDeckStructureCandidates(context) {
  const structureContext = collectDeckStructureContext(context);
  const currentLines = structureContext.slides.map((slide) => slide.outlineLine);
  const currentTitles = structureContext.slides.map((slide) => slide.currentTitle);
  const fallbackTitles = currentLines.length ? currentLines : currentTitles;

  return [
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck as a clearer start-to-finish operating sequence.",
      deckPatch: createSequenceDeckPatch(),
      focus: [
        `Open with the main claim for ${structureContext.audience}.`,
        "Show the shared system that makes the claim hold together.",
        "Put the strongest evidence and constraints in one place.",
        "Close on the operating or handoff path."
      ],
      label: "Sequence-led structure",
      notes: "Turns the deck into a stepwise path from framing through proof and handoff.",
      promptSummary: "Uses the deck objective and saved outline to build a cleaner sequence across the whole deck.",
      rationales: [
        "Keep the first slide as the frame so the deck states its claim immediately.",
        "Use the second slide to explain the shared system before proof details land.",
        "Let the third slide carry the strongest evidence and constraints.",
        "Reserve the final slide for the concrete handoff or next step."
      ],
      roles: ["Frame", "System", "Proof", "Handoff"],
      summary: `Organize the deck as a sequence that moves from ${fallbackTitles[0] || "framing"} toward ${fallbackTitles[fallbackTitles.length - 1] || "handoff"}.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        fallbackTitles[1] || "Shared system",
        fallbackTitles[2] || "Proof and guardrails",
        fallbackTitles[3] || "What to do next"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around ownership boundaries instead of a linear walkthrough.",
      deckPatch: createBoundaryDeckPatch(),
      focus: [
        "Start by showing what belongs in the deck itself.",
        "Make the validation and boundary logic explicit before the shared runtime details.",
        "Clarify which concerns belong to the shared runtime.",
        "Close on what the next operator should keep in view."
      ],
      label: "Boundary-led structure",
      notes: "Frames the presentation around authorship, runtime, validation, and handoff boundaries.",
      order: [0, 2, 1, 3],
      promptSummary: "Uses deck constraints, theme brief, and current slide roles to build a clearer ownership map.",
      rationales: [
        "Keep the first slide focused on what the deck owns.",
        "Move the proof slide earlier so the validation boundary is visible before runtime details.",
        "Push the shared runtime explanation after the validation frame.",
        "Close on handoff so the operator leaves with a clear next move."
      ],
      roles: ["Authoring", "Guardrails", "Runtime", "Handoff"],
      summary: `Organize the deck as a boundary map so ${structureContext.constraints}.`,
      titles: [
        "Slide-owned content",
        "Validation guardrails",
        "Shared runtime system",
        "Editor handoff"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around one decision path rather than a general demo tour.",
      deckPatch: createDecisionDeckPatch(structureContext),
      focus: [
        "Open with the core decision or claim the deck needs to support.",
        "Show the options or structure that shape that decision.",
        "Insert one explicit criteria slide before the proof block so the decision rules are visible.",
        "Make the strongest proof and operational limits explicit.",
        "Close on the action the team should take next."
      ],
      insertions: [
        {
          createSlideSpec: (context, proposedIndex) => createInsertedDecisionCriteriaSlide(context, proposedIndex),
          proposedIndex: 3,
          summary: "Insert one decision-criteria slide to bridge the options and proof sections.",
          title: "Decision criteria",
          type: "content"
        }
      ],
      label: "Decision-led structure",
      notes: "Turns the presentation into a decision-support flow aimed at a concrete next move.",
      promptSummary: "Uses audience, objective, and saved notes to build a more decision-oriented presentation structure.",
      rationales: [
        "Keep the opening slide focused on the decision instead of a generic intro.",
        "Use the second slide to surface the available structure options.",
        "Add one explicit criteria slide so the audience sees how options are judged before proof lands.",
        "Let the third slide act as the proof block that narrows the decision.",
        "Turn the final slide into the explicit action to take next."
      ],
      roles: ["Decision", "Options", "Criteria", "Evidence", "Action"],
      summary: `Organize the deck around one decision path for ${structureContext.audience}, then close on the next action.`,
      titles: [
        "The decision to make",
        "The structure options",
        "Decision criteria",
        "The proof and limits",
        "The next action"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around a stronger operator handoff by replacing the closing slide with a checklist scaffold.",
      deckPatch: createOperatorDeckPatch(),
      focus: [
        "Open with the deck claim and keep the audience anchored on the decision.",
        "Use the structure slide to show the available paths before the proof lands.",
        "Keep the proof slide focused on evidence and limits.",
        "Replace the final slide with an operator checklist that turns the proof into an explicit handoff."
      ],
      label: "Operator-checklist structure",
      notes: "Keeps the current deck length but repurposes the closing slot into a more operational summary surface.",
      promptSummary: "Uses the saved objective and tone to turn the final slide into an operator-ready checklist instead of a generic summary.",
      rationales: [
        "Keep the opening claim visible so the rest of the deck still has a clear frame.",
        "Use the second slide to orient the audience before the proof block.",
        "Leave the third slide as the concentrated evidence layer.",
        "Replace the last slide with one checklist surface so the deck ends on a concrete handoff."
      ],
      replacements: [
        {
          createSlideSpec: (context, proposedIndex, proposedTitle) => createReplacementOperatorChecklistSlide(context, proposedIndex, proposedTitle),
          currentIndex: 4,
          summary: "Replace the final summary slide with an operator checklist that names the decision, guardrails, and next owner.",
          type: "summary"
        }
      ],
      roles: ["Frame", "Orientation", "Proof", "Checklist"],
      summary: `Organize the deck as a proof-backed handoff for ${structureContext.audience}, then replace the closing slide with an explicit operator checklist.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        "The structure map",
        fallbackTitles[2] || "Proof and guardrails",
        "Operator checklist"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Compressed the deck by archiving the explicit outline slide and moving straight from framing to proof to handoff.",
      deckPatch: createCompressedDeckPatch(),
      focus: [
        "Open with the core claim and keep the audience oriented on the decision.",
        "Move directly into proof and operating limits without restating the outline.",
        "Close on the operator-facing handoff."
      ],
      label: "Compressed proof structure",
      notes: "Shortens the deck to three live slides by archiving the outline beat instead of deleting its source file.",
      order: [0, 2, 3],
      promptSummary: "Uses the saved outline and objective to collapse the deck into a shorter frame-proof-handoff path.",
      rationales: [
        "Keep the opening claim so the deck still has a clear frame.",
        "Move straight into the proof block once the audience has the frame.",
        "End on the handoff instead of keeping a separate outline recap."
      ],
      removals: [
        {
          currentIndex: 2,
          rationale: "Archive the outline slide once the opening frame already explains the path.",
          role: "Archived outline",
          summary: "Remove the explicit outline slide from the live deck while keeping its source file recoverable."
        }
      ],
      roles: ["Frame", "Proof", "Handoff"],
      summary: `Compress the deck for ${structureContext.audience} by archiving the outline beat and moving directly from frame to proof to handoff.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        fallbackTitles[2] || "Proof and guardrails",
        "Operator handoff"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Composed a tighter decision path by archiving the outline slide, inserting explicit criteria, and replacing the close with an operator checklist.",
      deckPatch: createComposedDecisionHandoffDeckPatch(structureContext),
      focus: [
        "Open with the decision or claim the audience needs to make.",
        "Insert one compact criteria slide immediately so the audience knows how options will be judged.",
        "Move from criteria into proof and constraints without the separate outline beat.",
        "Replace the final close with an operator checklist that turns the proof into an explicit handoff."
      ],
      insertions: [
        {
          createSlideSpec: (context, proposedIndex) => createInsertedDecisionCriteriaSlide(context, proposedIndex),
          proposedIndex: 2,
          summary: "Insert a compact criteria slide before the proof block so the decision rules are visible early.",
          title: "Decision criteria",
          type: "content"
        }
      ],
      label: "Composed decision handoff",
      notes: "Combines archive, insert, replacement, retitle, and reorder moves into one guarded deck-level compose pass.",
      order: [0, 2, 3],
      promptSummary: "Uses the saved objective and outline to compose one tighter decision-support deck path with explicit criteria and handoff scaffolding.",
      rationales: [
        "Keep the opening slide focused on the decision instead of re-explaining the outline.",
        "Insert criteria before the proof so the audience knows how evidence will be judged.",
        "Let the proof slide narrow the decision with the strongest constraints in one place.",
        "Replace the final close with a checklist so the deck ends on a concrete operating handoff."
      ],
      removals: [
        {
          currentIndex: 2,
          rationale: "Archive the explicit outline beat once the deck already moves as a clear decision path.",
          role: "Archived outline",
          summary: "Remove the separate outline slide from the live deck while keeping the source file available."
        }
      ],
      replacements: [
        {
          createSlideSpec: (context, proposedIndex, proposedTitle) => createReplacementOperatorChecklistSlide(context, proposedIndex, proposedTitle),
          currentIndex: 4,
          summary: "Replace the closing summary with an operator checklist that carries the decision and guardrails into execution.",
          type: "summary"
        }
      ],
      roles: ["Decision", "Criteria", "Proof", "Checklist"],
      summary: `Compose the deck into a tighter decision-support path for ${structureContext.audience} by combining criteria, proof, and handoff in one guarded plan.`,
      titles: [
        "The decision to make",
        "Decision criteria",
        "The proof and limits",
        "Operator checklist"
      ]
    }),
    createDeckWideAuthoringPlan(structureContext, {
      changeLead: "Rewrote the full deck around one explicit decision path so every live slide carries claim, proof, and next action language.",
      createSlideSpec: (currentContext, details) => {
        const objective = currentContext.objective;
        const audience = currentContext.audience;
        const baseSpec = details.currentSpec;

        switch (baseSpec.type) {
          case "cover":
            return rewriteCoverSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: `State the decision clearly for ${audience} before showing tooling detail.`,
                  title: "Decision"
                },
                {
                  body: "Make the judging criteria visible so the audience knows how proof will be read.",
                  title: "Criteria"
                },
                {
                  body: "Close the opener on the concrete move the team should approve next.",
                  title: "Next move"
                }
              ],
              eyebrow: "Decision",
              note: "Carry one claim, the evaluation criteria, and the next move through the whole deck.",
              summary: `Frame the presentation as one decision-support path that helps ${audience} ${objective}.`
            });
          case "toc":
            return rewriteTocSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "Open with the decision and the audience context instead of a generic product tour.",
                  title: "Frame the call"
                },
                {
                  body: "Show the shared runtime and the checks that explain why the decision is defensible.",
                  title: "Explain the system"
                },
                {
                  body: "End on proof, limits, and the concrete approval step.",
                  title: "Approve the move"
                }
              ],
              eyebrow: "Path",
              note: "The outline should read like a decision path, not a neutral contents page.",
              summary: `Map the deck as a short path from framing through proof to the next move for ${audience}.`
            });
          case "content":
            return rewriteContentSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              eyebrow: "Evidence",
              guardrails: [
                { label: "slides in path", value: String(currentContext.slides.length) },
                { label: "approval steps", value: "1" },
                { label: "quality gate", value: "1" }
              ],
              guardrailsTitle: "Decision guardrails",
              signals: [
                { label: "claim", value: 0.92 },
                { label: "system", value: 0.88 },
                { label: "proof", value: 0.95 },
                { label: "action", value: 0.84 }
              ],
              signalsTitle: "Decision signals",
              summary: "Concentrate the strongest proof and operating limits on one slide before asking for approval."
            });
          case "summary":
            return rewriteSummarySlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              bullets: [
                {
                  body: "Restate the decision in one sentence so the close names the actual call to make.",
                  title: "Approve the call"
                },
                {
                  body: "Name the owner, timing, and apply step so the audience knows what happens next.",
                  title: "Assign the next move"
                },
                {
                  body: "Run the rebuild and validation gate before treating the deck as approved output.",
                  title: "Validate the result"
                }
              ],
              eyebrow: "Action",
              resources: [
                {
                  body: "slides/output/demo-presentation.pdf",
                  title: "Approval artifact"
                },
                {
                  body: "npm run quality:gate",
                  title: "Final check"
                }
              ],
              resourcesTitle: "Decision support",
              summary: `Close on an explicit approval path so ${audience} can act on the deck without guessing.`
            });
          default:
            return baseSpec;
        }
      },
      focus: [
        "Open on the decision and the audience context instead of a generic demo frame.",
        "Turn the outline into an explicit path from framing through proof to approval.",
        "Make the strongest evidence and operating limits visible on one concentrated slide.",
        "Close on approval, ownership, and the validation step."
      ],
      deckPatch: createDecisionDeckPatch(structureContext),
      kindLabel: "Deck authoring",
      label: "Decision narrative authoring",
      notes: "Batch-authors every live slide so the whole deck reads as one decision path instead of a demo tour.",
      promptSummary: "Uses the saved deck objective and audience to rewrite the current slide files into a tighter decision-support narrative.",
      rationales: [
        "Retitle and rewrite the opener so the whole deck starts on the decision to make.",
        "Rewrite the outline slide as a real narrative path instead of a neutral contents list.",
        "Turn the evidence slide into an explicit proof-and-guardrails surface.",
        "Close on approval, ownership, and the final validation step."
      ],
      replacementSummary: (slide) => `Rewrite ${slide.currentTitle} so it supports the full-deck decision narrative instead of only its current local role.`,
      roles: ["Decision", "Path", "Evidence", "Approval"],
      summary: `Rewrite the live deck for ${structureContext.audience} as one decision narrative with explicit proof and action language.`,
      titles: [
        "The decision to make",
        "The decision path",
        "Evidence and guardrails",
        "Approve the next move"
      ]
    }),
    createDeckWideAuthoringPlan(structureContext, {
      changeLead: "Rewrote the full deck as an operator-facing handoff so every slide carries maintenance, validation, and ownership language.",
      createSlideSpec: (currentContext, details) => {
        const objective = currentContext.objective;
        const baseSpec = details.currentSpec;

        switch (baseSpec.type) {
          case "cover":
            return rewriteCoverSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "State what the deck must preserve when someone new edits or extends it.",
                  title: "Hold the source"
                },
                {
                  body: "Make the runtime and layout rules readable before any edits are proposed.",
                  title: "Understand the system"
                },
                {
                  body: "Leave the opener with the one approval gate the next operator must run.",
                  title: "Keep the gate"
                }
              ],
              eyebrow: "Operator",
              note: "Treat the deck as a maintained system: source, runtime, preview, and validation stay connected.",
              summary: `Frame the deck as an operator handoff that helps the next editor ${objective}.`
            });
          case "toc":
            return rewriteTocSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "Start with the authoring boundary so slide-local and shared logic do not blur together.",
                  title: "Authoring boundary"
                },
                {
                  body: "Show how the runtime and preview loop keep structure, rendering, and state aligned.",
                  title: "Runtime loop"
                },
                {
                  body: "End on validation and handoff so the operating routine is explicit.",
                  title: "Validation routine"
                }
              ],
              eyebrow: "Routine",
              note: "The outline should read like a maintenance loop for the next operator.",
              summary: "Map the deck as one operating routine from authoring boundary through runtime checks to handoff."
            });
          case "content":
            return rewriteContentSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              eyebrow: "Guardrails",
              guardrails: [
                { label: "slide files", value: String(currentContext.slides.length) },
                { label: "runtime path", value: "1" },
                { label: "render gate", value: "1" }
              ],
              guardrailsTitle: "Operating guardrails",
              signals: [
                { label: "authoring", value: 0.9 },
                { label: "runtime", value: 0.87 },
                { label: "preview", value: 0.91 },
                { label: "validation", value: 0.96 }
              ],
              signalsTitle: "Operating signals",
              summary: "Make the runtime signals and validation guardrails explicit so the next editor knows what keeps the deck stable."
            });
          case "summary":
            return rewriteSummarySlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              bullets: [
                {
                  body: "Save the brief, context, and structure plan before changing slide files.",
                  title: "Carry the context"
                },
                {
                  body: "Rebuild previews after edits so the working deck stays visible and comparable.",
                  title: "Rebuild the truth"
                },
                {
                  body: "Run the quality gate before treating the change as a finished handoff.",
                  title: "Close the gate"
                }
              ],
              eyebrow: "Handoff",
              resources: [
                {
                  body: "studio/state/deck-context.json",
                  title: "Saved context"
                },
                {
                  body: "render baseline + npm run quality:gate",
                  title: "Gate surface"
                }
              ],
              resourcesTitle: "Keep nearby",
              summary: "End with the concrete operating routine the next editor should follow before shipping a change."
            });
          default:
            return baseSpec;
        }
      },
      focus: [
        "Open on the maintenance contract the next editor must preserve.",
        "Explain the operating routine instead of only listing sections.",
        "Show the signals and guardrails that keep the deck stable.",
        "End on the handoff checklist the next editor should follow."
      ],
      deckPatch: createOperatorDeckPatch(),
      kindLabel: "Deck authoring",
      label: "Operator handoff authoring",
      notes: "Batch-authors every live slide around ownership boundaries, runtime routine, and the operator-facing validation loop.",
      promptSummary: "Uses the saved constraints, objective, and theme brief to rewrite the live deck as an operator handoff rather than a product demo.",
      rationales: [
        "Rewrite the opener so the deck starts on the maintenance contract instead of the demo surface.",
        "Turn the outline into an operating routine the next editor can actually follow.",
        "Make the proof slide explicitly about signals and guardrails that keep the deck stable.",
        "Finish on a checklist-style handoff for the next editor."
      ],
      replacementSummary: (slide) => `Rewrite ${slide.currentTitle} so it contributes to one operator-facing handoff across the full deck.`,
      roles: ["Contract", "Routine", "Guardrails", "Handoff"],
      summary: `Rewrite the live deck as an operator handoff so the next editor can maintain the system without reconstructing the workflow.`,
      titles: [
        "What the deck must hold",
        "How the deck is maintained",
        "What keeps it stable",
        "Operator handoff"
      ]
    })
  ];
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
  ensureAllowedDir(variantPreviewDir);

  try {
    writeSlideSpec(slideId, slideSpec);
    await buildAndRenderDeck();
    const pages = listPages(previewDir);
    const pageFile = pages[slide.index - 1];

    if (!pageFile) {
      throw new Error(`Missing rendered page for slide ${slide.index}`);
    }

    const targetFile = path.join(variantPreviewDir, `${variantId}.png`);
    copyAllowedFile(pageFile, targetFile);

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
    reportProgress(options, {
      message: "Gathering saved context for ideation...",
      stage: "gathering-context"
    });

    reportProgress(options, {
      message: generation.mode === "llm"
        ? `Generating slide variants with ${generation.provider} ${generation.model}...`
        : "Generating slide variants from saved context...",
      stage: "generating-variants"
    });
    const candidates = generation.mode === "llm"
      ? await createLlmIdeateCandidates(slide, slideType, serializeSlideSpec(originalSlideSpec), context)
      : createLocalIdeateCandidates(slide, slideType, context, {
        dryRun,
        persistToSlide: slide.structured
      });

    reportProgress(options, {
      message: `Rendering ${candidates.length} candidate preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
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
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
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
    reportProgress(options, {
      message: "Gathering the current slide copy for wording passes...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: "Generating wording variants...",
      stage: "generating-variants"
    });
    const candidates = createLocalWordingCandidates(originalSlideSpec, {
      dryRun,
      persistToSlide: slide.structured
    });
    reportProgress(options, {
      message: `Rendering ${candidates.length} wording preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      dryRun,
      labelFormatter: (label) => `${label} ${dryRun ? "dry run" : "variant"}`,
      operation: "drill-wording"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
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

async function ideateThemeSlide(slideId, options = {}) {
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
    reportProgress(options, {
      message: "Gathering saved theme context for the selected slide...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: "Generating theme variants from the saved deck brief...",
      stage: "generating-variants"
    });
    const candidates = createLocalThemeCandidates(slide, originalSlideSpec, context, {
      dryRun,
      persistToSlide: slide.structured
    });
    reportProgress(options, {
      message: `Rendering ${candidates.length} theme preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      dryRun,
      labelFormatter: (label) => `${label} ${dryRun ? "dry run" : "variant"}`,
      operation: "ideate-theme"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
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
      ? `Generated ${createdVariants.length} dry-run theme variants for ${slide.title} using local theme rules.`
      : `Generated ${createdVariants.length} theme variants for ${slide.title} using local theme rules.`,
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
    reportProgress(options, {
      message: "Gathering current layout context...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: "Generating layout variants...",
      stage: "generating-variants"
    });
    const candidates = createLocalLayoutCandidates(slide, originalSlideSpec, context, {
      dryRun,
      persistToSlide: slide.structured
    });
    reportProgress(options, {
      message: `Rendering ${candidates.length} layout preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      dryRun,
      labelFormatter: (label) => `${label} ${dryRun ? "dry run" : "variant"}`,
      operation: "redo-layout"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
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

async function ideateStructureSlide(slideId, options = {}) {
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
    reportProgress(options, {
      message: "Gathering current slide role and nearby outline context...",
      stage: "gathering-context"
    });
    reportProgress(options, {
      message: "Generating structure variants...",
      stage: "generating-variants"
    });
    const candidates = createLocalStructureCandidates(slide, originalSlideSpec, context, {
      dryRun,
      persistToSlide: slide.structured
    });
    reportProgress(options, {
      message: `Rendering ${candidates.length} structure preview${candidates.length === 1 ? "" : "s"}...`,
      stage: "rendering-variants"
    });
    const variants = await materializeCandidatesToVariants(slideId, candidates, {
      dryRun,
      labelFormatter: (label) => `${label} ${dryRun ? "dry run" : "variant"}`,
      operation: "ideate-structure"
    });
    createdVariants.push(...variants);
  } finally {
    try {
      reportProgress(options, {
        message: "Restoring the working slide and rebuilding previews...",
        stage: "rebuilding-previews"
      });
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
      ? `Generated ${createdVariants.length} dry-run structure variants for ${slide.title} using local structure rules.`
      : `Generated ${createdVariants.length} structure variants for ${slide.title} using local structure rules.`,
    variants: createdVariants
  };
}

async function ideateDeckStructure(options = {}) {
  const context = getDeckContext();
  const dryRun = options.dryRun !== false;
  const generation = {
    available: false,
    fallbackReason: null,
    mode: "local",
    model: null,
    provider: "local",
    requestedMode: "local"
  };

  reportProgress(options, {
    message: "Gathering deck brief, outline, and current slide roles...",
    stage: "gathering-context"
  });

  reportProgress(options, {
    message: "Generating deck-plan candidates...",
    stage: "generating-variants"
  });

  const candidates = createLocalDeckStructureCandidates(context);

  reportProgress(options, {
    message: `Rendering ${candidates.length} deck-plan preview${candidates.length === 1 ? "" : "s"}...`,
    stage: "rendering-variants"
  });

  for (const candidate of candidates) {
    await renderDeckStructureCandidatePreview(candidate);
  }

  return {
    candidates,
    dryRun,
    generation,
    summary: dryRun
      ? `Generated ${candidates.length} dry-run deck-plan candidates from the saved deck context.`
      : `Generated ${candidates.length} deck-plan candidates from the saved deck context.`
  };
}

async function applyDeckStructureCandidate(candidate, options = {}) {
  const plan = Array.isArray(candidate && candidate.slides) ? candidate.slides : [];
  const promoteInsertions = options.promoteInsertions !== false;
  const promoteRemovals = options.promoteRemovals !== false;
  const promoteReplacements = options.promoteReplacements !== false;
  let insertedSlides = 0;
  const promoteIndices = options.promoteIndices !== false;
  const promoteTitles = options.promoteTitles !== false;
  let indexUpdates = 0;
  let removedSlides = 0;
  let replacedSlides = 0;
  let titleUpdates = 0;

  if (promoteInsertions) {
    for (const entry of plan) {
      if (!entry || entry.action !== "insert" || !entry.scaffold || !entry.scaffold.slideSpec) {
        continue;
      }

      createStructuredSlide(entry.scaffold.slideSpec);
      insertedSlides += 1;
    }
  }

  if (promoteReplacements) {
    for (const entry of plan) {
      if (!entry || typeof entry.slideId !== "string" || !entry.slideId || !entry.replacement || !entry.replacement.slideSpec) {
        continue;
      }

      writeSlideSpec(entry.slideId, entry.replacement.slideSpec);
      replacedSlides += 1;
    }
  }

  if (promoteRemovals) {
    for (const entry of plan) {
      if (!entry || entry.action !== "remove" || typeof entry.slideId !== "string" || !entry.slideId) {
        continue;
      }

      const slideSpec = readSlideSpec(entry.slideId);
      if (slideSpec.archived === true) {
        continue;
      }

      writeSlideSpec(entry.slideId, {
        ...slideSpec,
        archived: true
      });
      removedSlides += 1;
    }
  }

  if (promoteTitles || promoteIndices) {
    for (const entry of plan) {
      if (!entry || entry.action === "remove" || typeof entry.slideId !== "string" || !entry.slideId) {
        continue;
      }

      const nextIndex = Number(entry.proposedIndex);
      const nextTitle = sentence(entry.proposedTitle, "", 18);
      if (!nextTitle) {
        if (!Number.isFinite(nextIndex)) {
          continue;
        }
      }

      const slideSpec = readSlideSpec(entry.slideId);
      const currentIndex = Number(slideSpec.index);
      const currentTitle = sentence(slideSpec.title, "", 18);
      const shouldUpdateIndex = promoteIndices && Number.isFinite(nextIndex) && currentIndex !== nextIndex;
      const shouldUpdateTitle = promoteTitles && nextTitle
        && normalizeSentence(currentTitle).toLowerCase() !== normalizeSentence(nextTitle).toLowerCase();

      if (!shouldUpdateIndex && !shouldUpdateTitle) {
        continue;
      }

      writeSlideSpec(entry.slideId, {
        ...slideSpec,
        archived: false,
        index: shouldUpdateIndex ? nextIndex : slideSpec.index,
        title: shouldUpdateTitle ? nextTitle : slideSpec.title
      });
      if (shouldUpdateIndex) {
        indexUpdates += 1;
      }
      if (shouldUpdateTitle) {
        titleUpdates += 1;
      }
    }
  }

  const previews = (await buildAndRenderDeck()).previews;

  return {
    insertedSlides,
    indexUpdates,
    previews,
    removedSlides,
    replacedSlides,
    titleUpdates
  };
}

module.exports = {
  _test: {
    createLocalDeckStructureCandidates
  },
  applyDeckStructureCandidate,
  drillWordingSlide,
  ideateDeckStructure,
  ideateStructureSlide,
  ideateThemeSlide,
  ideateSlide,
  redoLayoutSlide
};
