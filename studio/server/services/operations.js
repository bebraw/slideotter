const fs = require("fs");
const path = require("path");
const { buildAndRenderDeck } = require("./build");
const { outputDir, previewDir, variantPreviewDir } = require("./paths");
const { getDeckContext } = require("./state");
const { getSlide, readSlideSource, writeSlideSource } = require("./slides");
const { captureVariant, updateVariant } = require("./variants");
const { ensureDir, listPages } = require("../../../generator/render-utils");

function asAssetUrl(fileName) {
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
}

function escapeString(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"");
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

function replaceConstArray(source, constName, items) {
  const pattern = new RegExp(`const ${constName} = \\[[\\s\\S]*?\\n\\];`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find array constant ${constName}`);
  }

  const body = items.map((item) => {
    const lines = Object.entries(item).map(([key, value], index, entries) => {
      if (typeof value === "number") {
        return `    ${key}: ${value}${index < entries.length - 1 ? "," : ""}`;
      }

      return `    ${key}: "${escapeString(value)}"${index < entries.length - 1 ? "," : ""}`;
    });

    return ["  {", ...lines, "  }"].join("\n");
  }).join(",\n");

  return source.replace(pattern, `const ${constName} = [\n${body}\n];`);
}

function replaceSlideTitle(source, nextTitle) {
  return source.replace(
    /(const slideConfig = \{[\s\S]*?title:\s*")([^"]*)(")/,
    `$1${escapeString(nextTitle)}$3`
  );
}

function replaceSectionTitle(source, eyebrow, body) {
  const pattern = /addSectionTitle\(\s*canvas,\s*theme,\s*"[^"]*",\s*slideConfig\.title,\s*"[^"]*"\s*\)/;
  if (!pattern.test(source)) {
    throw new Error("Could not find addSectionTitle call");
  }

  return source.replace(pattern, [
    "addSectionTitle(",
    "    canvas,",
    "    theme,",
    `    "${escapeString(eyebrow)}",`,
    "    slideConfig.title,",
    `    "${escapeString(body)}"`,
    "  )"
  ].join("\n"));
}

function replaceAddTextValue(source, id, nextText) {
  const pattern = new RegExp(`(canvas\\.addText\\("${id}",\\s*")([^"]*)(")`);
  if (!pattern.test(source)) {
    throw new Error(`Could not find text block ${id}`);
  }

  return source.replace(pattern, `$1${escapeString(nextText)}$3`);
}

function ensureJavaScriptSyntax(source) {
  try {
    // Parse candidate source before storing or previewing it.
    new Function(source);
  } catch (error) {
    throw new Error(`Generated variant source is invalid: ${error.message}`);
  }
}

function extractSlideType(source) {
  const match = source.match(/type:\s*"([^"]+)"/);
  return match ? match[1] : "unknown";
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

function buildCoverVariant(source, theme) {
  let next = replaceSlideTitle(source, theme.title);
  next = replaceConstArray(next, "capabilityCards", theme.cards);
  next = replaceAddTextValue(next, "cover-eyebrow", theme.eyebrow);
  next = replaceAddTextValue(next, "cover-summary", theme.summary);
  next = replaceAddTextValue(next, "cover-footnote", theme.notes);
  return next;
}

function buildTocVariant(source, theme) {
  let next = replaceSlideTitle(source, theme.title);
  next = replaceSectionTitle(next, theme.eyebrow, theme.summary);
  next = replaceConstArray(next, "outlineCards", theme.cards);
  next = replaceAddTextValue(next, "outline-note", theme.notes);
  return next;
}

function buildContentVariant(source, theme) {
  let next = replaceSlideTitle(source, theme.title);
  next = replaceSectionTitle(next, theme.eyebrow, theme.summary);
  next = replaceConstArray(next, "signalBars", theme.signals);
  next = replaceConstArray(next, "guardrails", theme.guardrails);
  next = replaceAddTextValue(next, "content-signals-title", `${theme.label} signals`);
  next = replaceAddTextValue(next, "content-guardrails-title", "Workflow guardrails");
  return next;
}

function buildSummaryVariant(source, theme) {
  let next = replaceSlideTitle(source, theme.title);
  next = replaceSectionTitle(next, theme.eyebrow, theme.summary);
  next = replaceConstArray(next, "checklistItems", theme.bullets);
  next = replaceConstArray(next, "resourceCards", theme.resources);
  next = replaceAddTextValue(next, "summary-resources-title", "Keep nearby");
  return next;
}

function buildVariantSource(source, theme) {
  const type = extractSlideType(source);

  switch (type) {
    case "cover":
      return buildCoverVariant(source, theme);
    case "toc":
      return buildTocVariant(source, theme);
    case "content":
      return buildContentVariant(source, theme);
    case "summary":
      return buildSummaryVariant(source, theme);
    default:
      throw new Error(`Ideate Slide does not support slide type "${type}" yet`);
  }
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

async function ideateSlide(slideId) {
  const slide = getSlide(slideId);
  const originalSource = readSlideSource(slideId);
  const context = getDeckContext();
  const themes = createIdeaThemes(slide, context);
  const createdVariants = [];
  let previews = null;

  try {
    for (const theme of themes) {
      const source = buildVariantSource(originalSource, theme);
      ensureJavaScriptSyntax(source);
      const variant = captureVariant({
        kind: "generated",
        label: `${theme.label} variant`,
        notes: theme.notes,
        operation: "ideate-slide",
        promptSummary: theme.promptSummary,
        slideId,
        source
      });
      const previewImage = await renderVariantPreview(slideId, source, variant.id);
      createdVariants.push(updateVariant(variant.id, { previewImage }));
    }
  } finally {
    writeSlideSource(slideId, originalSource);
    previews = (await buildAndRenderDeck()).previews;
  }

  return {
    previews,
    slideId,
    summary: `Generated ${createdVariants.length} slide variants from saved context for ${slide.title}.`,
    variants: createdVariants
  };
}

module.exports = {
  ideateSlide
};
