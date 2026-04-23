const fs = require("fs");
const path = require("path");
const { buildAndRenderDeck } = require("./build");
const { createStructuredResponse, getLlmConfig, getLlmStatus } = require("./llm/client");
const { buildIdeateSlidePrompts } = require("./llm/prompts");
const { getIdeateSlideResponseSchema } = require("./llm/schemas");
const { outputDir, previewDir, variantPreviewDir } = require("./paths");
const { getDeckContext } = require("./state");
const { getSlide, readSlideSource, writeSlideSource } = require("./slides");
const { extractSlideTypeFromSource, materializeSlideSpec, validateSlideSpec } = require("./slide-specs");
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

function ensureJavaScriptSyntax(source) {
  try {
    // Parse candidate source before storing or previewing it.
    new Function(source);
  } catch (error) {
    throw new Error(`Generated variant source is invalid: ${error.message}`);
  }
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
      throw new Error("LLM generation is not configured. Set OPENAI_API_KEY or switch generation mode to local.");
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
    fallbackReason: "LLM unavailable, used local generation.",
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

async function renderVariantPreview(slideId, source, variantId) {
  const slide = getSlide(slideId);
  const originalSource = readSlideSource(slideId);
  ensureDir(variantPreviewDir);

  try {
    writeSlideSource(slideId, source);
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
    writeSlideSource(slideId, originalSource);
  }
}

async function ideateSlide(slideId, options = {}) {
  if (ideateSlideLocks.has(slideId)) {
    throw new Error(`Ideate Slide is already running for ${slideId}`);
  }

  ideateSlideLocks.add(slideId);
  const slide = getSlide(slideId);
  const originalSource = readSlideSource(slideId);
  const context = getDeckContext();
  const createdVariants = [];
  let previews = null;
  const dryRun = options.dryRun === true;
  const slideType = extractSlideTypeFromSource(originalSource);
  const generation = resolveGeneration(options);

  try {
    const candidates = generation.mode === "llm"
      ? await createLlmIdeateCandidates(slide, slideType, originalSource, context)
      : createLocalIdeateCandidates(slide, slideType, context, { dryRun });

    for (const candidate of candidates) {
      const slideSpec = validateSlideSpec(candidate.slideSpec);
      const source = materializeSlideSpec(originalSource, slideSpec);
      ensureJavaScriptSyntax(source);

      if (dryRun) {
        const variant = createTransientVariant({
          changeSummary: candidate.changeSummary,
          generator: candidate.generator,
          kind: "generated",
          label: generation.mode === "llm" ? candidate.label : `${candidate.label} dry run`,
          model: candidate.model,
          notes: candidate.notes,
          operation: "ideate-slide",
          promptSummary: candidate.promptSummary,
          provider: candidate.provider,
          slideId,
          slideSpec,
          source
        });
        const previewImage = await renderVariantPreview(slideId, source, variant.id);
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
        label: generation.mode === "llm" ? candidate.label : `${candidate.label} variant`,
        model: candidate.model,
        notes: candidate.notes,
        operation: "ideate-slide",
        promptSummary: candidate.promptSummary,
        provider: candidate.provider,
        slideId,
        slideSpec,
        source
      });
      const previewImage = await renderVariantPreview(slideId, source, variant.id);
      createdVariants.push(updateVariant(variant.id, { previewImage }));
    }
  } finally {
    try {
      writeSlideSource(slideId, originalSource);
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

module.exports = {
  ideateSlide
};
