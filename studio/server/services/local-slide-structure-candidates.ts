import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray,
  compactSentence as sentence
} from "../../shared/json-utils.ts";
import { getSlides } from "./slides.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

type SlideRecord = JsonObject & {
  id: string;
  index?: number;
  path?: string;
  title?: string;
  type?: string;
};

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
};

type Candidate = JsonObject & {
  changeScope?: string;
  changeSummary?: string[];
  label: string;
  notes?: unknown;
  promptSummary?: unknown;
  remediationStrategy?: string;
  slideSpec: SlideSpec;
  sourceIssues?: JsonObject[];
};

type OperationOptions = JsonObject & {
  dryRun?: unknown;
  labelFormatter?: (label: string) => string;
};

export type StructureContext = JsonObject & {
  audience: string;
  currentTitle: string;
  intent: string;
  layoutHint: string;
  mustInclude: string;
  nextTitle: string;
  note: string;
  objective: string;
  outlineCurrent: string;
  outlineNext: string;
  previousTitle: string;
  themeBrief: string;
  tone: string;
};

type LocalStructureVariant = {
  label: string;
  notes: string;
  promptSummary: string;
  slideSpec: SlideSpec;
};

type FamilyChangeDetails = {
  label: string;
  notes: string;
  preservation: string;
  promptSummary: string;
};

function getIndexedJsonObject(items: unknown[], index: number): JsonObject {
  return asJsonObject(items[index]);
}

function splitLines(value: unknown): string[] {
  return String(value || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function toBody(value: unknown, fallback: unknown): string {
  return sentence(value, fallback, 18);
}

function describeVariantPersistence(_options: OperationOptions = {}): string {
  return "Stored as a transient session variant until explicitly applied.";
}

export function collectStructureContext(slide: SlideRecord, currentSpec: SlideSpec, context: DeckContext): StructureContext {
  const deck = asJsonObject(context.deck);
  const slideContext = context.slides[slide.id] || {};
  const slides = asJsonObjectArray(getSlides()).map((entry: JsonObject, index: number) => ({
    ...entry,
    id: String(entry.id || `slide-${index + 1}`),
    title: String(entry.title || `Slide ${index + 1}`)
  }));
  const slideIndex = slides.findIndex((entry: SlideRecord) => entry.id === slide.id);
  const previousSlide = slideIndex > 0 ? slides[slideIndex - 1] : null;
  const nextSlide = slideIndex >= 0 && slideIndex < slides.length - 1 ? slides[slideIndex + 1] : null;
  const outline = unique(splitLines(deck.outline));

  return {
    audience: sentence(deck.audience, "the next editor"),
    currentTitle: sentence(currentSpec.title || slide.title, slide.id, 12),
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

function intentForMissingStructure(deck: JsonObject, slideContext: JsonObject): string {
  return sentence(
    slideContext.intent || deck.objective,
    "make the slide's role explicit"
  );
}

function createCardStructureCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const cards = asJsonObjectArray(currentSpec.cards);

  return [
    {
      label: "Sequence structure",
      notes: "Turns the slide into a clearer three-step sequence instead of a flat card list.",
      promptSummary: "Uses the saved outline and the next slide to reframe the card stack as a sequence.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        cards: [
          {
            ...getIndexedJsonObject(cards, 0),
            body: toBody(`Open with ${structureContext.outlineCurrent}.`, "Open with the saved starting point."),
            title: "Start"
          },
          {
            ...getIndexedJsonObject(cards, 1),
            body: toBody(`Use ${structureContext.themeBrief}.`, "Use the shared system as the middle step."),
            title: "System"
          },
          {
            ...getIndexedJsonObject(cards, 2),
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
            ...getIndexedJsonObject(cards, 0),
            body: toBody(`Keep ${structureContext.intent}.`, "Keep the slide-specific job explicit."),
            title: "Authoring"
          },
          {
            ...getIndexedJsonObject(cards, 1),
            body: toBody(`Let the shared system carry ${structureContext.themeBrief}.`, "Let the shared system do the middle work."),
            title: "Runtime"
          },
          {
            ...getIndexedJsonObject(cards, 2),
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
            ...getIndexedJsonObject(cards, 0),
            body: toBody(structureContext.mustInclude, "Make the main point obvious."),
            title: "Now"
          },
          {
            ...getIndexedJsonObject(cards, 1),
            body: toBody(`Set up ${structureContext.nextTitle}.`, "Set up the next slide cleanly."),
            title: "Next"
          },
          {
            ...getIndexedJsonObject(cards, 2),
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
  ].map((variant: LocalStructureVariant) => ({
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

function createContentStructureCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const guardrails = asJsonObjectArray(currentSpec.guardrails);
  const signals = asJsonObjectArray(currentSpec.signals);

  return [
    {
      label: "Sequence structure",
      notes: "Turns the scorecard into a visible operating sequence from setup through validation.",
      promptSummary: "Uses outline and adjacent slide context to structure the slide around a stepwise path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        eyebrow: "Sequence",
        guardrails: [
          { ...getIndexedJsonObject(guardrails, 0), label: "selected slide", value: "1" },
          { ...getIndexedJsonObject(guardrails, 1), label: "working file", value: "1" },
          { ...getIndexedJsonObject(guardrails, 2), label: "apply step", value: "1" }
        ],
        guardrailsTitle: "Sequence guardrails",
        signals: [
          { ...getIndexedJsonObject(signals, 0), label: "brief", value: getIndexedJsonObject(signals, 0).value },
          { ...getIndexedJsonObject(signals, 2), label: "layout", value: getIndexedJsonObject(signals, 2).value },
          { ...getIndexedJsonObject(signals, 1), label: "render", value: getIndexedJsonObject(signals, 1).value },
          { ...getIndexedJsonObject(signals, 3), label: "validate", value: getIndexedJsonObject(signals, 3).value }
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
          { ...getIndexedJsonObject(guardrails, 0), label: "slide source", value: "1" },
          { ...getIndexedJsonObject(guardrails, 1), label: "shared engine", value: "1" },
          { ...getIndexedJsonObject(guardrails, 2), label: "quality gate", value: "1" }
        ],
        guardrailsTitle: "Boundary checks",
        signals: [
          { ...getIndexedJsonObject(signals, 0), label: "authoring", value: getIndexedJsonObject(signals, 0).value },
          { ...getIndexedJsonObject(signals, 2), label: "system", value: getIndexedJsonObject(signals, 2).value },
          { ...getIndexedJsonObject(signals, 1), label: "runtime", value: getIndexedJsonObject(signals, 1).value },
          { ...getIndexedJsonObject(signals, 3), label: "gate", value: getIndexedJsonObject(signals, 3).value }
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
          { ...getIndexedJsonObject(guardrails, 0), label: "must-show", value: "1" },
          { ...getIndexedJsonObject(guardrails, 1), label: "compare pass", value: "1" },
          { ...getIndexedJsonObject(guardrails, 2), label: "apply once", value: "1" }
        ],
        guardrailsTitle: "Decision checks",
        signals: [
          { ...getIndexedJsonObject(signals, 0), label: "claim", value: getIndexedJsonObject(signals, 0).value },
          { ...getIndexedJsonObject(signals, 3), label: "proof", value: getIndexedJsonObject(signals, 3).value },
          { ...getIndexedJsonObject(signals, 2), label: "boundary", value: getIndexedJsonObject(signals, 2).value },
          { ...getIndexedJsonObject(signals, 1), label: "next step", value: getIndexedJsonObject(signals, 1).value }
        ],
        signalsTitle: "Decision inputs",
        summary: `Use the slide to support one decision for ${structureContext.audience}, then hand off cleanly to ${structureContext.nextTitle}.`,
        title: currentSpec.title
      })
    }
  ].map((variant: LocalStructureVariant) => ({
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

function createSummaryStructureCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const modeLabel = describeVariantPersistence(options);
  const bullets = asJsonObjectArray(currentSpec.bullets);
  const resources = asJsonObjectArray(currentSpec.resources);

  return [
    {
      label: "Operating structure",
      notes: "Turns the closing slide into a cleaner operating sequence instead of a loose recap.",
      promptSummary: "Uses the deck objective and slide outline to structure the checklist as a run path.",
      slideSpec: validateSlideSpec({
        ...currentSpec,
        bullets: [
          { ...getIndexedJsonObject(bullets, 0), title: "Prepare", body: toBody(`Start with ${structureContext.outlineCurrent}.`, "Start with the saved setup.") },
          { ...getIndexedJsonObject(bullets, 1), title: "Run", body: toBody(`Move toward ${structureContext.outlineNext}.`, "Move through the active workflow.") },
          { ...getIndexedJsonObject(bullets, 2), title: "Check", body: toBody(structureContext.mustInclude, "Keep the final check visible.") }
        ],
        eyebrow: "Run path",
        resources: resources.map((item: JsonObject) => ({ ...item })),
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
          { ...getIndexedJsonObject(bullets, 0), title: "Slide layer", body: toBody(structureContext.intent, "Keep slide-specific content local.") },
          { ...getIndexedJsonObject(bullets, 1), title: "Shared layer", body: toBody(structureContext.themeBrief, "Let the shared system carry layout rules.") },
          { ...getIndexedJsonObject(bullets, 2), title: "Gate layer", body: toBody(`Close with ${structureContext.note}.`, "Close with explicit validation.") }
        ],
        eyebrow: "Ownership",
        resources: resources.map((item: JsonObject) => ({ ...item })),
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
          { ...getIndexedJsonObject(bullets, 0), title: "Do now", body: toBody(structureContext.mustInclude, "Do the main thing now.") },
          { ...getIndexedJsonObject(bullets, 1), title: "Do next", body: toBody(`Set up ${structureContext.nextTitle}.`, "Set up the next move.") },
          { ...getIndexedJsonObject(bullets, 2), title: "Keep in view", body: toBody(structureContext.note, "Keep the review step visible.") }
        ],
        eyebrow: "Handoff",
        resources: resources.map((item: JsonObject) => ({ ...item })),
        resourcesTitle: "Keep nearby",
        summary: `Use the close as a handoff for ${structureContext.audience}: do one thing now, set up the next step, and keep the right references nearby.`,
        title: currentSpec.title
      })
    }
  ].map((variant: LocalStructureVariant) => ({
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

function collectFamilyChangeText(spec: unknown): string[] {
  const source = asJsonObject(spec);
  if (!Object.keys(source).length) {
    return [];
  }

  const parts = [
    source.eyebrow,
    source.title,
    source.summary,
    source.note,
    source.caption,
    source.context,
    source.quote,
    source.signalsTitle,
    source.guardrailsTitle,
    source.resourcesTitle
  ];

  ["cards", "signals", "guardrails", "bullets", "resources"].forEach((field) => {
    if (!Array.isArray(source[field])) {
      return;
    }

    source[field].forEach((item: unknown) => {
      const entry = asJsonObject(item);
      parts.push(entry.title, entry.body, entry.label, entry.value);
    });
  });

  return parts
    .filter((part) => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function firstFamilyChangeText(spec: SlideSpec, fallback: unknown, maxWords = 18): string {
  return sentence(collectFamilyChangeText(spec).find((part: string) => part !== spec.title), fallback, maxWords);
}

function summarizeDroppedFamilyFields(currentSpec: SlideSpec, nextSpec: SlideSpec): string {
  const nextType = nextSpec.type;
  const dropped: string[] = [];

  [
    "cards",
    "signals",
    "guardrails",
    "bullets",
    "resources",
    "quote",
    "media",
    "mediaItems",
    "summary",
    "note",
    "caption"
  ].forEach((field) => {
    const nextValue = nextSpec[field];
    const currentValue = currentSpec[field];
    const explicitlyCleared = Object.hasOwn(nextSpec, field) && (
      nextValue === null ||
      (Array.isArray(currentValue) && currentValue.length > 0 && Array.isArray(nextValue) && nextValue.length === 0)
    );

    if (
      Object.hasOwn(currentSpec, field) &&
      (!Object.hasOwn(nextSpec, field) || explicitlyCleared) &&
      currentValue !== undefined &&
      currentValue !== null
    ) {
      dropped.push(field);
    }
  });

  if (!dropped.length) {
    return `Changed the slide family from ${currentSpec.type} to ${nextType} without dropping stored structured fields.`;
  }

  return `Changed the slide family from ${currentSpec.type} to ${nextType}; dropped ${dropped.slice(0, 4).join(", ")}${dropped.length > 4 ? ", ..." : ""} from the candidate spec.`;
}

function createFamilyChangeCandidate(currentSpec: SlideSpec, _structureContext: StructureContext, nextSpec: SlideSpec, details: FamilyChangeDetails, options: OperationOptions = {}): Candidate {
  const modeLabel = describeVariantPersistence(options);
  const slideSpec = asJsonObject(validateSlideSpec(nextSpec));

  return {
    changeSummary: [
      `Changed slide family from ${currentSpec.type} to ${slideSpec.type}.`,
      summarizeDroppedFamilyFields(currentSpec, slideSpec),
      details.preservation,
      modeLabel
    ],
    generator: "local",
    label: details.label,
    model: null,
    notes: details.notes,
    promptSummary: details.promptSummary,
    provider: "local",
    slideSpec
  };
}

function collectFamilyMediaItems(currentSpec: SlideSpec): JsonObject[] {
  if (Array.isArray(currentSpec.mediaItems) && currentSpec.mediaItems.length) {
    return currentSpec.mediaItems.map((item: unknown) => ({ ...asJsonObject(item) }));
  }

  if (currentSpec.media) {
    return [{ ...asJsonObject(currentSpec.media) }];
  }

  return [];
}

export function createLocalFamilyChangeCandidates(currentSpec: SlideSpec, structureContext: StructureContext, options: OperationOptions = {}): Candidate[] {
  const candidates: Candidate[] = [];
  const baseTitle = sentence(currentSpec.title || structureContext.currentTitle, "Untitled slide", 8);
  const textClaim = firstFamilyChangeText(currentSpec, structureContext.mustInclude, 18);
  const mediaItems = collectFamilyMediaItems(currentSpec);

  if (!["divider"].includes(String(currentSpec.type))) {
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        index: currentSpec.index,
        layout: undefined,
        media: null,
        mediaItems: [],
        title: sentence(baseTitle, "Section break", 8),
        type: "divider"
      },
      {
        label: "Change family: divider",
        notes: "Turns the current slide into a title-only section marker.",
        preservation: "Preserved the current title as the divider text and removed body-level content.",
        promptSummary: "Converts the slide into a first-class divider candidate."
      },
      options
    ));
  }

  if (!["quote"].includes(String(currentSpec.type))) {
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        attribution: currentSpec.attribution,
        context: sentence(structureContext.intent, currentSpec.context || "", 16),
        index: currentSpec.index,
        layout: undefined,
        media: null,
        mediaItems: [],
        quote: textClaim,
        source: currentSpec.source,
        title: baseTitle,
        type: "quote"
      },
      {
        label: "Change family: quote",
        notes: "Turns the strongest available text into a dominant pull quote.",
        preservation: "Preserved one compact claim as the quote and kept attribution/source when available.",
        promptSummary: "Converts the slide into a quote-family candidate."
      },
      options
    ));
  }

  if (currentSpec.type !== "photo" && (currentSpec.media || mediaItems.length)) {
    const media = currentSpec.media ? { ...asJsonObject(currentSpec.media) } : { ...getIndexedJsonObject(mediaItems, 0) };
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        caption: sentence(currentSpec.caption || structureContext.intent, "Use the image as visual evidence.", 16),
        index: currentSpec.index,
        layout: undefined,
        media,
        mediaItems: [],
        title: baseTitle,
        type: "photo"
      },
      {
        label: "Change family: photo",
        notes: "Turns the slide into one dominant image with a compact caption.",
        preservation: "Preserved the first attached media item as the dominant photo.",
        promptSummary: "Converts the slide into a photo-family candidate."
      },
      options
    ));
  }

  if (currentSpec.type !== "photoGrid" && mediaItems.length >= 2) {
    candidates.push(createFamilyChangeCandidate(
      currentSpec,
      structureContext,
      {
        caption: sentence(currentSpec.caption || structureContext.intent, "Compare the image set.", 16),
        index: currentSpec.index,
        layout: undefined,
        media: null,
        mediaItems: mediaItems.slice(0, 3),
        summary: sentence(structureContext.mustInclude, currentSpec.summary || "", 16),
        title: baseTitle,
        type: "photoGrid"
      },
      {
        label: "Change family: photo grid",
        notes: "Turns attached images into a two-to-three image comparison grid.",
        preservation: "Preserved up to three attached media items and kept captions/source metadata with each image.",
        promptSummary: "Converts the slide into a photo-grid-family candidate."
      },
      options
    ));
  }

  return candidates;
}

export function createLocalStructureCandidates(slide: SlideRecord, currentSpec: SlideSpec, context: DeckContext, options: OperationOptions = {}): Candidate[] {
  const structureContext = collectStructureContext(slide, currentSpec, context);
  const modeLabel = describeVariantPersistence(options);
  const withFamilyChanges = (candidates: Candidate[]): Candidate[] => [
    ...candidates,
    ...createLocalFamilyChangeCandidates(currentSpec, structureContext, options)
  ];

  if (currentSpec.type === "divider") {
    return withFamilyChanges([
      {
        label: "Boundary divider",
        notes: "Frames the divider as a boundary between the previous and next sections.",
        promptSummary: "Uses the adjacent slide titles to rewrite the divider as a clear boundary marker.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          title: sentence(`From ${structureContext.previousTitle} to ${structureContext.nextTitle}`, currentSpec.title, 8)
        })
      },
      {
        label: "Decision divider",
        notes: "Turns the divider into a short decision-stage heading.",
        promptSummary: "Uses the current outline and objective to rewrite the divider as a decision-stage title.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          title: sentence(`${structureContext.outlineCurrent}: the call`, currentSpec.title, 8)
        })
      },
      {
        label: "Operator divider",
        notes: "Reframes the divider around the operating routine the next section explains.",
        promptSummary: "Uses the saved notes and next-slide title to rewrite the divider as an operator-ready section marker.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          title: sentence(`Operating ${structureContext.nextTitle}`, currentSpec.title, 8)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the divider toward a ${variant.label.toLowerCase()}.`,
        "Changed the section title so the divider does more narrative work without adding body content.",
        "Kept the divider family title-only instead of expanding it into another content slide.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  if (currentSpec.type === "quote") {
    return withFamilyChanges([
      {
        label: "Claim quote",
        notes: "Turns the pull quote into a sharper claim for the current section.",
        promptSummary: "Uses the slide intent and surrounding titles to tighten the quote around one claim.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          context: sentence(`Sets up ${structureContext.nextTitle} for ${structureContext.audience}.`, currentSpec.context || "", 16),
          quote: sentence(structureContext.mustInclude, currentSpec.quote, 18),
          title: sentence(structureContext.outlineCurrent, currentSpec.title, 8)
        })
      },
      {
        label: "Evidence quote",
        notes: "Frames the quote as proof the audience should carry into the next slide.",
        promptSummary: "Uses the saved notes to rewrite the quote as compact evidence.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          context: sentence(structureContext.note, currentSpec.context || "Use this as compact evidence.", 16),
          quote: sentence(structureContext.intent, currentSpec.quote, 18)
        })
      },
      {
        label: "Handoff quote",
        notes: "Makes the quote point toward the next authoring or review action.",
        promptSummary: "Uses the next-slide title to make the quote act as a handoff.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          context: sentence(`Carry this into ${structureContext.nextTitle}.`, currentSpec.context || "", 14),
          quote: sentence(`The next move is ${structureContext.nextTitle}.`, currentSpec.quote, 14)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the quote toward a ${variant.label.toLowerCase()}.`,
        "Changed the quote/context while keeping the quote slide family intact.",
        "Kept attribution and source fields attached below the dominant quote.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  if (currentSpec.type === "photo") {
    return withFamilyChanges([
      {
        label: "Evidence photo",
        notes: "Frames the image as visual evidence for the current section.",
        promptSummary: "Uses the slide intent to retitle the photo as a proof point.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(structureContext.intent, currentSpec.caption || asJsonObject(currentSpec.media).caption || "", 16),
          title: sentence(structureContext.outlineCurrent, currentSpec.title, 8)
        })
      },
      {
        label: "Context photo",
        notes: "Makes the caption explain why the viewer should inspect the image.",
        promptSummary: "Uses saved notes and audience context to tighten the photo caption.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`For ${structureContext.audience}: ${structureContext.mustInclude}.`, currentSpec.caption || "", 16)
        })
      },
      {
        label: "Handoff photo",
        notes: "Points the visual toward the next slide's job.",
        promptSummary: "Uses the next-slide title to make the image act as a handoff.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`Use this image to set up ${structureContext.nextTitle}.`, currentSpec.caption || "", 14)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the photo toward a ${variant.label.toLowerCase()}.`,
        "Changed the title/caption while preserving the attached material.",
        "Kept the photo family and single-image structure intact.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  if (currentSpec.type === "photoGrid") {
    return withFamilyChanges([
      {
        label: "Comparison grid",
        notes: "Frames the image set as a direct comparison.",
        promptSummary: "Uses the slide intent to retitle the image grid as visual comparison.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(structureContext.intent, currentSpec.caption || currentSpec.summary || "", 16),
          title: sentence(structureContext.outlineCurrent, currentSpec.title, 8)
        })
      },
      {
        label: "Evidence grid",
        notes: "Makes the grid read as grouped evidence for the audience.",
        promptSummary: "Uses saved context to tighten the grid caption.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`For ${structureContext.audience}: ${structureContext.mustInclude}.`, currentSpec.caption || currentSpec.summary || "", 16)
        })
      },
      {
        label: "Handoff grid",
        notes: "Points the image set toward the next slide's job.",
        promptSummary: "Uses the next-slide title to make the image grid act as a handoff.",
        slideSpec: validateSlideSpec({
          ...currentSpec,
          caption: sentence(`Use these images to set up ${structureContext.nextTitle}.`, currentSpec.caption || currentSpec.summary || "", 14)
        })
      }
    ].map((variant) => ({
      changeSummary: [
        `Reworked the photo grid toward a ${variant.label.toLowerCase()}.`,
        "Changed the title/caption while preserving the media item set.",
        "Kept the photo-grid family and fixed grid arrangement intact.",
        modeLabel
      ],
      generator: "local",
      label: variant.label,
      model: null,
      notes: variant.notes,
      promptSummary: variant.promptSummary,
      provider: "local",
      slideSpec: variant.slideSpec
    })));
  }

  switch (currentSpec.type) {
    case "cover":
    case "toc":
      return withFamilyChanges(createCardStructureCandidates(currentSpec, structureContext, options));
    case "content":
      return withFamilyChanges(createContentStructureCandidates(currentSpec, structureContext, options));
    case "summary":
      return withFamilyChanges(createSummaryStructureCandidates(currentSpec, structureContext, options));
    default:
      throw new Error(`Ideate Structure does not support slide type "${currentSpec.type}" yet`);
  }
}

