import * as fs from "fs";
import * as path from "path";
import {
  createSlug,
  normalizeCompactText,
  normalizeTargetSlideCount
} from "./compact-text.ts";
import {
  presentationsDir,
  stateDir
} from "./paths.ts";
import {
  assertPresentationId,
  defaultPresentationId,
  getPresentationPaths,
  presentationRuntimeFile,
  presentationRoot,
  type PresentationPaths
} from "./presentation-paths.ts";
import {
  normalizeVisualTheme,
  theme as defaultVisualTheme
} from "./deck-theme.ts";
import { readJson, writeJson } from "./service-json.ts";
import { ensureAllowedDir } from "./write-boundary.ts";
import {
  normalizeOutlinePlan,
  type OutlinePlan,
  type OutlinePlanSection,
  type OutlinePlanSlide
} from "./outline-plans.ts";
import { createOutlinePlanStore } from "./outline-plan-store.ts";
import { validateSlideSpec } from "./slide-specs/index.ts";
import {
  asJsonObject,
  asJsonObjectArray,
  createDefaultDeckContext,
  createDefaultPresentationMeta,
  createDefaultRegistry,
  createInitialSlideSpecs,
  defaultActivePresentationId,
  normalizeCreationDraft,
  normalizeRegistry,
  normalizeRuntimeState,
  presentationsRegistryFile,
  type DeckContext,
  type JsonObject,
  type PresentationSummary,
  type PresentationsRegistry,
  type RegistryEntry,
  type RuntimeState
} from "./presentation-state.ts";

type DeckPlanSlide = JsonObject & {
  intent: string;
  keyMessage: string;
  role: string;
  sourceNeed: string;
  title: string;
  type: string;
  value: string;
  visualNeed: string;
};

type DeckPlan = JsonObject & {
  audience: string;
  language: string;
  narrativeArc: string;
  outline: string;
  slides: DeckPlanSlide[];
  thesis: string;
};

type SourceStore = {
  sources: JsonObject[];
};

type MaterialStore = {
  materials: JsonObject[];
};

type CurrentSlideEntry = {
  id: string;
  index: number;
  title: string;
  type: string;
};

type PlanCandidateEntry = JsonObject & {
  action: string;
  currentIndex: number | null;
  currentTitle: string;
  proposedIndex: number | null;
  proposedTitle: string;
  slideId: string | null;
};

function writeSlideFile(paths: PresentationPaths, index: number, slideSpec: JsonObject): void {
  const validated = validateSlideSpec({
    ...slideSpec,
    index
  });
  writeJson(path.join(paths.slidesDir, `slide-${String(index).padStart(2, "0")}.json`), validated);
}

function removeSlideFiles(paths: PresentationPaths): void {
  const files = fs.existsSync(paths.slidesDir) ? fs.readdirSync(paths.slidesDir) : [];
  files
    .filter((fileName: string) => /^slide-\d+\.(json|js)$/.test(fileName))
    .forEach((fileName: string) => {
      fs.rmSync(path.join(paths.slidesDir, fileName), {
        force: true
      });
  });
}

function readRegistry(): PresentationsRegistry {
  return normalizeRegistry(readJson(presentationsRegistryFile, createDefaultRegistry()));
}

function readRuntimeState(registry: PresentationsRegistry = readRegistry()): RuntimeState {
  return normalizeRuntimeState(readJson(presentationRuntimeFile, {
    activePresentationId: defaultActivePresentationId(registry)
  }), registry);
}

function writeRuntimeState(runtime: JsonObject, registry: PresentationsRegistry = readRegistry()): RuntimeState {
  const current = readJson(presentationRuntimeFile, {});
  const normalized = normalizeRuntimeState({
    ...asJsonObject(current),
    ...runtime
  }, registry);
  writeJson(presentationRuntimeFile, normalized);
  return normalized;
}

function writeRegistry(registry: unknown): PresentationsRegistry {
  const normalized = normalizeRegistry(registry);
  writeJson(presentationsRegistryFile, normalized);
  return normalized;
}

function ensurePresentationFiles(id: unknown, fields: JsonObject = {}): void {
  const paths = getPresentationPaths(id);
  ensureAllowedDir(paths.materialsDir);
  ensureAllowedDir(paths.slidesDir);
  ensureAllowedDir(paths.stateDir);

  if (!fs.existsSync(paths.metaFile)) {
    writeJson(paths.metaFile, createDefaultPresentationMeta({
      ...fields,
      id
    }));
  }

  if (!fs.existsSync(paths.deckContextFile)) {
    writeJson(paths.deckContextFile, createDefaultDeckContext({
      title: fields.title || id,
      subject: fields.description || ""
    }));
  }

  if (!fs.existsSync(paths.variantsFile)) {
    writeJson(paths.variantsFile, { variants: [] });
  }

  if (!fs.existsSync(paths.materialsFile)) {
    writeJson(paths.materialsFile, { materials: [] });
  }

  if (!fs.existsSync(paths.customVisualsFile)) {
    writeJson(paths.customVisualsFile, { customVisuals: [] });
  }

  if (!fs.existsSync(paths.sourcesFile)) {
    writeJson(paths.sourcesFile, { sources: [] });
  }

  if (!fs.existsSync(paths.memoryFile)) {
    writeJson(paths.memoryFile, { items: [], links: [], derivedSets: [] });
  }

  if (!fs.existsSync(paths.outlinePlansFile)) {
    writeJson(paths.outlinePlansFile, { plans: [] });
  }
}

function ensurePresentationsState(): PresentationsRegistry {
  ensureAllowedDir(stateDir);
  ensureAllowedDir(presentationsDir);

  if (!fs.existsSync(presentationsRegistryFile)) {
    writeRegistry(createDefaultRegistry());
  }

  const registry = readRegistry();
  registry.presentations.forEach((entry: RegistryEntry) => ensurePresentationFiles(entry.id, entry));
  return registry;
}

function getActivePresentationId(): string {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).activePresentationId;
}

function getActivePresentationPaths(): PresentationPaths {
  return getPresentationPaths(getActivePresentationId());
}

function writeActivePresentationId(id: string, registry: PresentationsRegistry): RuntimeState {
  return writeRuntimeState({
    activePresentationId: id
  }, registry);
}

function assertPresentationInRegistry(registry: PresentationsRegistry, id: unknown): string {
  const safeId = assertPresentationId(id);
  if (!registry.presentations.some((entry: RegistryEntry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }

  return safeId;
}

function setActivePresentation(id: unknown): RuntimeState {
  const registry = ensurePresentationsState();
  const safeId = assertPresentationInRegistry(registry, id);

  return writeActivePresentationId(safeId, registry);
}

function getPresentationCreationDraft(): JsonObject {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).creationDraft;
}

function savePresentationCreationDraft(draft: JsonObject): JsonObject {
  const registry = ensurePresentationsState();
  const nextDraft = normalizeCreationDraft({
    ...draft,
    updatedAt: new Date().toISOString()
  });
  writeRuntimeState({
    creationDraft: nextDraft
  }, registry);
  return nextDraft;
}

function clearPresentationCreationDraft(): JsonObject {
  return savePresentationCreationDraft({
    approvedOutline: false,
    deckPlan: null,
    fields: {},
    outlineLocks: {},
    retrieval: null,
    stage: "brief"
  });
}

function getRuntimeLlmSettings(): JsonObject {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).llm;
}

function saveRuntimeLlmSettings(fields: JsonObject = {}): JsonObject {
  const registry = ensurePresentationsState();
  const modelOverride = typeof fields.modelOverride === "string"
    ? fields.modelOverride.trim()
    : "";

  return writeRuntimeState({
    llm: {
      modelOverride
    }
  }, registry).llm;
}

function listSavedThemes(): JsonObject[] {
  const registry = ensurePresentationsState();
  return readRuntimeState(registry).savedThemes;
}

function saveRuntimeTheme(fields: JsonObject = {}): JsonObject {
  const registry = ensurePresentationsState();
  const runtime = readRuntimeState(registry);
  const timestamp = new Date().toISOString();
  const name = String(fields.name || "Saved theme").trim() || "Saved theme";
  const id = createSlug(fields.id || name, "theme");
  const existing = runtime.savedThemes.filter((theme: JsonObject) => theme.id !== id);
  const savedTheme = {
    id,
    name,
    theme: normalizeVisualTheme({
      ...defaultVisualTheme,
      ...(fields.theme || fields.visualTheme || {})
    }),
    updatedAt: timestamp
  };

  writeRuntimeState({
    savedThemes: [
      savedTheme,
      ...existing
    ].slice(0, 30)
  }, registry);

  return savedTheme;
}

function updatePresentationMeta(id: unknown, fields: JsonObject): JsonObject {
  const paths = getPresentationPaths(id);
  const current = readJson(paths.metaFile, createDefaultPresentationMeta({ id }));
  const next = {
    ...asJsonObject(current),
    ...fields,
    id,
    updatedAt: new Date().toISOString()
  };
  writeJson(paths.metaFile, next);
  return next;
}

function readPresentationDeckContext(id: unknown): DeckContext {
  const paths = getPresentationPaths(id);
  if (!fs.existsSync(paths.rootDir)) {
    throw new Error(`Unknown presentation: ${id}`);
  }

  const source = asJsonObject(readJson(paths.deckContextFile, createDefaultDeckContext({ id })));
  return {
    ...source,
    deck: asJsonObject(source.deck),
    slides: Object.fromEntries(Object.entries(asJsonObject(source.slides))
      .map(([slideId, slideContext]) => [slideId, asJsonObject(slideContext)]))
  };
}

function readPresentationSlideSpecs(id: unknown): JsonObject[] {
  const paths = getPresentationPaths(id);
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? fs.readdirSync(paths.slidesDir).filter((fileName: string) => /^slide-\d+\.json$/.test(fileName)).sort((left: string, right: string) => left.localeCompare(right, undefined, { numeric: true }))
    : [];

  return slideFiles
    .map((fileName: string) => readJson(path.join(paths.slidesDir, fileName), null))
    .filter((slide: unknown) => {
      const source = asJsonObject(slide);
      return slide && source.archived !== true && source.skipped !== true;
    })
    .map((slide: unknown) => asJsonObject(slide));
}

const outlinePlanStore = createOutlinePlanStore({
  assertPresentationId,
  ensureAllowedDir,
  ensurePresentationExists(id: string): void {
    const registry = ensurePresentationsState();
    if (!registry.presentations.some((entry: RegistryEntry) => entry.id === id)) {
      throw new Error(`Unknown presentation: ${id}`);
    }
  },
  getActivePresentationId,
  getPresentationPaths,
  readJson,
  writeJson
});

function listOutlinePlans(id: unknown = getActivePresentationId(), options: { includeArchived?: boolean } = {}): OutlinePlan[] {
  return outlinePlanStore.listOutlinePlans(id, options);
}

function getActiveOutlinePlanId(id: unknown = getActivePresentationId()): string {
  return outlinePlanStore.getActiveOutlinePlanId(id);
}

function getOutlinePlan(id: unknown, planId: unknown): OutlinePlan {
  return outlinePlanStore.getOutlinePlan(id, planId);
}

function saveOutlinePlan(id: unknown, plan: unknown): OutlinePlan | undefined {
  return outlinePlanStore.saveOutlinePlan(id, plan);
}

function deleteOutlinePlan(id: unknown, planId: unknown): OutlinePlan[] {
  return outlinePlanStore.deleteOutlinePlan(id, planId);
}

function duplicateOutlinePlan(id: unknown, planId: unknown, fields: JsonObject = {}): OutlinePlan | undefined {
  return outlinePlanStore.duplicateOutlinePlan(id, planId, fields);
}

function archiveOutlinePlan(id: unknown, planId: unknown): OutlinePlan | undefined {
  return outlinePlanStore.archiveOutlinePlan(id, planId);
}

function setActiveOutlinePlan(id: unknown, planId: unknown): string {
  return outlinePlanStore.setActiveOutlinePlan(id, planId).activePlanId;
}

function normalizeDeckPlanSlide(slide: unknown, index: number): DeckPlanSlide {
  const source = asJsonObject(slide);
  return {
    ...source,
    intent: normalizeCompactText(source.intent),
    keyMessage: normalizeCompactText(source.keyMessage),
    role: normalizeCompactText(source.role),
    sourceNeed: normalizeCompactText(source.sourceNeed),
    title: normalizeCompactText(source.title, `Slide ${index + 1}`),
    type: normalizeCompactText(source.type, "content"),
    value: normalizeCompactText(source.value),
    visualNeed: normalizeCompactText(source.visualNeed)
  };
}

function normalizeDeckPlan(deckPlan: unknown): DeckPlan {
  const source = asJsonObject(deckPlan);
  return {
    ...source,
    audience: normalizeCompactText(source.audience),
    language: normalizeCompactText(source.language),
    narrativeArc: normalizeCompactText(source.narrativeArc),
    outline: normalizeCompactText(source.outline),
    slides: Array.isArray(source.slides)
      ? source.slides.map(normalizeDeckPlanSlide)
      : [],
    thesis: normalizeCompactText(source.thesis)
  };
}

function deckPlanToOutlinePlan(presentationId: unknown, deckPlan: unknown, fields: JsonObject = {}): OutlinePlan {
  const normalizedDeckPlan = normalizeDeckPlan(deckPlan);
  const slides = normalizedDeckPlan.slides;
  if (!slides.length) {
    throw new Error("Expected deck plan slides before saving an outline plan");
  }

  return normalizeOutlinePlan({
    audience: fields.audience || normalizedDeckPlan.audience,
    intendedUse: fields.intendedUse || "derived-deck",
    name: fields.name || `${fields.title || "Approved"} outline`,
    objective: fields.objective || normalizedDeckPlan.thesis,
    presentationDensity: fields.presentationDensity || "balanced",
    purpose: fields.purpose || fields.objective || normalizedDeckPlan.thesis,
    sourcePresentationId: presentationId,
    sourceScope: {
      materials: [],
      slides: [],
      sources: []
    },
    targetSlideCount: fields.targetSlideCount || slides.length,
    tone: fields.tone || "",
    traceability: [],
    sections: [
      {
        id: "approved-outline",
        title: "Approved outline",
        intent: normalizedDeckPlan.narrativeArc || "Approved staged creation outline.",
        slides: slides.map((slide: DeckPlanSlide, index: number) => ({
          id: `slide-${String(index + 1).padStart(2, "0")}`,
          intent: slide.intent || slide.keyMessage || "",
          layoutHint: slide.visualNeed || "",
          mustInclude: [slide.keyMessage || ""].filter(Boolean),
          role: slide.role || "",
          sourceSlideId: "",
          traceability: [],
          type: slide.type || "content",
          workingTitle: slide.title || `Slide ${index + 1}`
        }))
      }
    ]
  });
}

function createOutlinePlanFromDeckPlan(presentationId: unknown, deckPlan: unknown, fields: JsonObject = {}): OutlinePlan | undefined {
  return saveOutlinePlan(presentationId, deckPlanToOutlinePlan(presentationId, deckPlan, fields));
}

function buildPresentationTraceability(slides: JsonObject[], sourceStore: SourceStore, materialStore: MaterialStore): JsonObject[] {
  const sourceTraceability = sourceStore.sources.map((source: JsonObject) => ({
    kind: "source-snippet",
    range: source.text ? `0-${Math.min(String(source.text).length, 240)}` : "",
    snippetId: "chunk-0",
    sourceId: source.id
  }));
  const materialTraceability = materialStore.materials.map((material: JsonObject) => ({
    kind: "material",
    materialId: material.id
  }));

  return [
    ...slides.map((slide: JsonObject, index: number) => ({
      kind: "slide",
      slideId: slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`
    })),
    ...sourceTraceability,
    ...materialTraceability
  ];
}

function presentationSourceScopeSlides(slides: JsonObject[]): string[] {
  return slides.map((slide: JsonObject, index: number) => normalizeCompactText(
    slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`
  ));
}

function outlineSlideRole(index: number, slideCount: number): string {
  if (index === 0) {
    return "opening";
  }
  return index === slideCount - 1 && slideCount > 1 ? "handoff" : "concept";
}

function outlineSourceSlideId(flowSlide: JsonObject, sourceSlide: JsonObject, sourceIndex: number): string {
  return normalizeCompactText(
    flowSlide.sourceSlideId || sourceSlide.id || `slide-${String(sourceSlide.index || sourceIndex + 1).padStart(2, "0")}`
  );
}

function outlineMustInclude(flowSlide: JsonObject, slideContext: JsonObject, summary: string): unknown[] {
  return [flowSlide.mustInclude || slideContext.mustInclude || summary].filter(Boolean);
}

function flowSlideToOutlineSlide(flowSlide: JsonObject, params: {
  context: DeckContext;
  flowSlideCount: number;
  index: number;
  slides: JsonObject[];
}): JsonObject {
  const sourceIndex = Number.isFinite(Number(flowSlide.sourceIndex)) ? Number(flowSlide.sourceIndex) : params.index;
  const sourceSlide = params.slides[sourceIndex] || params.slides[params.index] || {};
  const slideId = outlineSourceSlideId(flowSlide, sourceSlide, sourceIndex);
  const slideContext = asJsonObject(params.context.slides[slideId]);
  const summary = normalizeCompactText(sourceSlide.summary || sourceSlide.note || slideContext.mustInclude || "");

  return {
    id: `intent-${String(params.index + 1).padStart(2, "0")}`,
    intent: flowSlide.intent || slideContext.intent || summary || `Explain ${sourceSlide.title || `slide ${params.index + 1}`}.`,
    layoutHint: flowSlide.layoutHint || slideContext.layoutHint || sourceSlide.type || "",
    mustInclude: outlineMustInclude(flowSlide, slideContext, summary),
    role: outlineSlideRole(params.index, params.flowSlideCount),
    sourceSlideId: slideId,
    traceability: [
      {
        kind: "slide",
        slideId
      }
    ],
    type: normalizeCompactText(flowSlide.type || sourceSlide.type, "content"),
    value: flowSlide.value || slideContext.value || "",
    workingTitle: flowSlide.workingTitle || sourceSlide.title || `Slide ${params.index + 1}`
  };
}

function createOutlinePlanFromPresentation(id: unknown = getActivePresentationId(), fields: JsonObject = {}): OutlinePlan | undefined {
  const safeId = assertPresentationId(id);
  const paths = getPresentationPaths(safeId);
  if (!fs.existsSync(paths.rootDir)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }

  const context = readPresentationDeckContext(safeId);
  const deck = context.deck;
  const slides = readPresentationSlideSpecs(safeId);
  if (!slides.length) {
    throw new Error("Expected at least one slide before generating an outline plan");
  }

  const sourceStore: SourceStore = {
    sources: asJsonObjectArray(asJsonObject(readJson(paths.sourcesFile, { sources: [] })).sources)
  };
  const materialStore: MaterialStore = {
    materials: asJsonObjectArray(asJsonObject(readJson(paths.materialsFile, { materials: [] })).materials)
  };
  const deckTraceability = buildPresentationTraceability(slides, sourceStore, materialStore);
  const targetSlideCount = normalizeTargetSlideCount(fields.targetSlideCount) || slides.length;
  const flowSlides = buildOutlineFlowSlides(slides, context.slides, targetSlideCount);
  const plan = normalizeOutlinePlan({
    audience: fields.audience || deck.audience || "",
    intendedUse: fields.intendedUse || "current-deck-review",
    name: fields.name || `${deck.title || "Current deck"} outline plan`,
    objective: fields.objective || deck.objective || "",
    presentationDensity: fields.presentationDensity || "balanced",
    purpose: fields.purpose || deck.objective || `Review ${deck.title || safeId}.`,
    sourcePresentationId: safeId,
    sourceScope: {
      slides: presentationSourceScopeSlides(slides),
      sources: [],
      materials: []
    },
    targetSlideCount,
    tone: fields.tone || deck.tone || "",
    traceability: deckTraceability,
    sections: [
      {
        id: "current-deck",
        title: "Current deck",
        intent: deck.objective || "Represent the current slide sequence as an editable outline plan.",
        traceability: deckTraceability,
        slides: flowSlides.map((flowSlide: JsonObject, index: number) => flowSlideToOutlineSlide(flowSlide, {
          context,
          flowSlideCount: flowSlides.length,
          index,
          slides
        }))
      }
    ]
  });

  const savedPlan = saveOutlinePlan(safeId, plan);
  if (savedPlan) {
    setActiveOutlinePlan(safeId, savedPlan.id);
  }
  return savedPlan;
}

function buildOutlineFlowSlides(slides: JsonObject[], slideContexts: JsonObject, targetSlideCount: number): JsonObject[] {
  if (targetSlideCount <= slides.length) {
    return slides.slice(0, targetSlideCount).map((slide: JsonObject, index: number) => ({
      sourceIndex: index,
      sourceSlideId: normalizeCompactText(slide.id || `slide-${String(slide.index || index + 1).padStart(2, "0")}`)
    }));
  }

  const expanded: JsonObject[] = [];
  const expansionLabels = ["Setup", "Evidence", "Implication", "Example", "Decision"];
  for (let index = 0; index < targetSlideCount; index += 1) {
    const sourceIndex = index < slides.length ? index : (index - slides.length) % slides.length;
    const sourceSlide = slides[sourceIndex] || {};
    const sourceSlideId = normalizeCompactText(sourceSlide.id || `slide-${String(sourceSlide.index || sourceIndex + 1).padStart(2, "0")}`);
    const sourceContext = asJsonObject(slideContexts[sourceSlideId]);
    const baseTitle = normalizeCompactText(sourceSlide.title || sourceContext.title, `Slide ${sourceIndex + 1}`);
    if (index < slides.length) {
      expanded.push({
        sourceIndex,
        sourceSlideId
      });
      continue;
    }

    const label = expansionLabels[(index - slides.length) % expansionLabels.length] || "Detail";
    expanded.push({
      intent: `${label} detail for ${baseTitle}.`,
      layoutHint: sourceContext.layoutHint || sourceSlide.type || "content",
      mustInclude: sourceContext.mustInclude || sourceSlide.summary || sourceSlide.note || baseTitle,
      sourceIndex,
      sourceSlideId,
      type: "content",
      value: sourceContext.value || "",
      workingTitle: `${label}: ${baseTitle}`
    });
  }

  return expanded;
}

function outlinePlanToDeckPlan(plan: OutlinePlan): DeckPlan {
  const sections = Array.isArray(plan.sections) ? plan.sections : [];
  const slides = sections.flatMap((section: OutlinePlanSection) => Array.isArray(section.slides) ? section.slides : []);
  if (!slides.length) {
    throw new Error("Outline plan needs at least one slide intent before derivation");
  }

  return {
    audience: plan.audience || "",
    language: "",
    narrativeArc: sections.map((section: OutlinePlanSection) => `${section.title}: ${section.intent}`).join("\n"),
    outline: slides.map((slide: OutlinePlanSlide, index: number) => `${index + 1}. ${slide.workingTitle}`).join("\n"),
    slides: slides.map((slide: OutlinePlanSlide, index: number) => ({
      intent: slide.intent || "",
      keyMessage: Array.isArray(slide.mustInclude) && slide.mustInclude.length ? slide.mustInclude.join("; ") : slide.intent || "",
      role: slide.role || (index === 0 ? "opening" : index === slides.length - 1 && slides.length > 1 ? "handoff" : "concept"),
      sourceNeed: slide.sourceSlideId ? `Use source slide ${slide.sourceSlideId} when relevant.` : "Use selected source material when relevant.",
      title: slide.workingTitle || `Slide ${index + 1}`,
      type: slide.type || "content",
      value: slide.value || "",
      visualNeed: slide.layoutHint || "Use a simple readable layout."
    })),
    thesis: plan.objective || plan.purpose || ""
  };
}

function createDerivedCoverPlaceholderSlide(planSlide: DeckPlanSlide, title: string, message: string): JsonObject {
  return {
      type: "cover",
      title,
      logo: "slideotter",
      eyebrow: "Derived outline",
      summary: message,
      note: planSlide.intent || "",
      cards: [
        {
          id: "derived-intent",
          title: "Intent",
          body: planSlide.intent || message
        },
        {
          id: "derived-source",
          title: "Source",
          body: planSlide.sourceNeed || "Use selected source material when relevant."
        },
        {
          id: "derived-visual",
          title: "Visual",
          body: planSlide.visualNeed || "Use a simple readable layout."
        }
      ]
  };
}

function createDerivedSummaryPlaceholderSlide(planSlide: DeckPlanSlide, title: string, message: string): JsonObject {
  return {
      type: "summary",
      title,
      eyebrow: "Derived outline",
      summary: message,
      resourcesTitle: "Plan cues",
      bullets: [
        {
          id: "derived-intent",
          title: "Intent",
          body: planSlide.intent || message
        },
        {
          id: "derived-message",
          title: "Message",
          body: message
        },
        {
          id: "derived-next",
          title: "Next",
          body: planSlide.value || "Use the outline as the drafting handoff."
        }
      ],
      resources: [
        {
          id: "derived-source",
          title: "Source need",
          body: planSlide.sourceNeed || "Use selected source material when relevant."
        },
        {
          id: "derived-role",
          title: "Slide role",
          body: planSlide.role || "Closing slide"
        }
      ]
  };
}

function createDerivedContentPlaceholderSlide(planSlide: DeckPlanSlide, title: string, message: string): JsonObject {
  return {
    type: "content",
    title,
    eyebrow: "Derived outline",
    summary: message,
    signalsTitle: "Plan cues",
    guardrailsTitle: "Drafting notes",
    signals: [
      {
        id: "derived-intent",
        title: "Intent",
        body: planSlide.intent || message
      },
      {
        id: "derived-message",
        title: "Message",
        body: message
      },
      {
        id: "derived-source",
        title: "Source",
        body: planSlide.sourceNeed || "Use selected source material when relevant."
      }
    ],
    guardrails: [
      {
        id: "derived-visual",
        title: "Visual",
        body: planSlide.visualNeed || "Use a simple readable layout."
      },
      {
        id: "derived-audience",
        title: "Audience",
        body: planSlide.value || "Keep the slide useful for the stated audience."
      },
      {
        id: "derived-scope",
        title: "Scope",
        body: "Preserve the outline intent without adding unsupported claims."
      }
    ]
  };
}

function createDerivedPlaceholderSlide(planSlide: DeckPlanSlide, index: number, slideCount: number): JsonObject {
  const title = planSlide.title || `Slide ${index + 1}`;
  const message = planSlide.keyMessage || planSlide.intent || "Draft this slide from the outline plan.";

  if (index === 0) {
    return createDerivedCoverPlaceholderSlide(planSlide, title, message);
  }

  if (index === slideCount - 1 && slideCount > 1) {
    return createDerivedSummaryPlaceholderSlide(planSlide, title, message);
  }

  return createDerivedContentPlaceholderSlide(planSlide, title, message);
}

function createOutlinePlanScaffoldSlide(planSlide: DeckPlanSlide, index: number): JsonObject {
  const title = planSlide.title || `Slide ${index + 1}`;
  const message = planSlide.keyMessage || planSlide.intent || "Draft this slide from the outline plan.";

  return {
    type: "content",
    title,
    eyebrow: "Outline plan",
    summary: message,
    signalsTitle: "Plan cues",
    guardrailsTitle: "Drafting notes",
    signals: [
      {
        id: "plan-intent",
        title: "Intent",
        body: planSlide.intent || message
      },
      {
        id: "plan-message",
        title: "Message",
        body: message
      },
      {
        id: "plan-source",
        title: "Source",
        body: planSlide.sourceNeed || "Use selected source material when relevant."
      }
    ],
    guardrails: [
      {
        id: "plan-visual",
        title: "Visual",
        body: planSlide.visualNeed || "Use a simple readable layout."
      },
      {
        id: "plan-audience",
        title: "Audience",
        body: planSlide.value || "Keep the slide useful for the stated audience."
      },
      {
        id: "plan-scope",
        title: "Scope",
        body: "Preserve the outline intent without adding unsupported claims."
      }
    ]
  };
}

function createPlanCandidateStats(entries: PlanCandidateEntry[]): JsonObject {
  return {
    archived: entries.filter((entry: PlanCandidateEntry) => entry.action === "remove").length,
    inserted: entries.filter((entry: PlanCandidateEntry) => entry.action === "insert").length,
    moved: entries.filter((entry: PlanCandidateEntry) => Number.isFinite(entry.currentIndex) && Number.isFinite(entry.proposedIndex) && entry.currentIndex !== entry.proposedIndex).length,
    replaced: 0,
    retitled: entries.filter((entry: PlanCandidateEntry) => entry.currentTitle && entry.proposedTitle && normalizeCompactText(entry.currentTitle).toLowerCase() !== normalizeCompactText(entry.proposedTitle).toLowerCase()).length,
    shared: 0,
    total: entries.length
  };
}

function getCurrentSlideEntries(presentationId: string): CurrentSlideEntry[] {
  return readPresentationSlideSpecs(presentationId).map((slide: JsonObject, index: number) => ({
    id: `slide-${String(slide.index || index + 1).padStart(2, "0")}`,
    index: Number(slide.index || index + 1),
    title: normalizeCompactText(slide.title, `Slide ${index + 1}`),
    type: normalizeCompactText(slide.type, "content")
  }));
}

function createInsertedPlanCandidateEntry(planSlide: DeckPlanSlide, proposedIndex: number): PlanCandidateEntry {
  const proposedTitle = planSlide.title || `Slide ${proposedIndex}`;
  return {
    action: "insert",
    currentIndex: null,
    currentTitle: "",
    proposedIndex,
    proposedTitle,
    rationale: planSlide.intent || planSlide.keyMessage || "",
    role: planSlide.role || "concept",
    scaffold: {
      slideSpec: createOutlinePlanScaffoldSlide(planSlide, proposedIndex)
    },
    slideId: null,
    summary: planSlide.keyMessage || planSlide.intent || "",
    type: "content"
  };
}

function createMatchedPlanCandidateEntry(currentSlide: CurrentSlideEntry, planSlide: DeckPlanSlide, proposedIndex: number): PlanCandidateEntry {
  const proposedTitle = planSlide.title || `Slide ${proposedIndex}`;
  const moved = currentSlide.index !== proposedIndex;
  const retitled = normalizeCompactText(currentSlide.title).toLowerCase() !== normalizeCompactText(proposedTitle).toLowerCase();
  return {
    action: moved && retitled ? "move-retitle" : moved ? "move" : retitled ? "retitle" : "keep",
    currentIndex: currentSlide.index,
    currentTitle: currentSlide.title,
    proposedIndex,
    proposedTitle,
    rationale: planSlide.intent || planSlide.keyMessage || "",
    role: planSlide.role || "concept",
    slideId: currentSlide.id,
    summary: planSlide.keyMessage || planSlide.intent || "",
    type: currentSlide.type
  };
}

function createRemovedPlanCandidateEntry(slide: CurrentSlideEntry): PlanCandidateEntry {
  return {
    action: "remove",
    currentIndex: slide.index,
    currentTitle: slide.title,
    proposedIndex: null,
    proposedTitle: "",
    rationale: "Outside the selected outline plan target length.",
    role: "archive",
    slideId: slide.id,
    summary: "Archive this slide if applying the outline plan to the current deck.",
    type: slide.type
  };
}

function createPlanCandidateEntries(deckPlan: DeckPlan, currentSlides: CurrentSlideEntry[]): PlanCandidateEntry[] {
  const entries = deckPlan.slides.map((planSlide: DeckPlanSlide, index: number) => {
    const currentSlide = currentSlides[index] || null;
    const proposedIndex = index + 1;
    return currentSlide
      ? createMatchedPlanCandidateEntry(currentSlide, planSlide, proposedIndex)
      : createInsertedPlanCandidateEntry(planSlide, proposedIndex);
  });

  return [
    ...entries,
    ...currentSlides.slice(deckPlan.slides.length).map(createRemovedPlanCandidateEntry)
  ];
}

function createPlanProposedSequence(entries: PlanCandidateEntry[]): Array<{ index: number; title: string }> {
  return entries
    .filter((entry: PlanCandidateEntry): entry is PlanCandidateEntry & { proposedIndex: number } => Number.isFinite(entry.proposedIndex) && Boolean(entry.proposedTitle))
    .sort((left, right) => left.proposedIndex - right.proposedIndex)
    .map((entry: PlanCandidateEntry & { proposedIndex: number }) => ({
      index: entry.proposedIndex,
      title: entry.proposedTitle
    }));
}

function createPlanCandidateDiff(entries: PlanCandidateEntry[], currentSlides: CurrentSlideEntry[], proposedSequence: Array<{ index: number; title: string }>, planStats: JsonObject): JsonObject {
  return {
    counts: {
      afterSlides: proposedSequence.length,
      beforeSlides: currentSlides.length
    },
    deck: {
      changes: [],
      count: 0,
      summary: "No shared deck settings are changed by this outline-plan candidate."
    },
    files: [],
    outline: {
      added: entries.filter((entry: PlanCandidateEntry) => entry.action === "insert").map((entry: PlanCandidateEntry) => entry.proposedTitle),
      archived: entries.filter((entry: PlanCandidateEntry) => entry.action === "remove").map((entry: PlanCandidateEntry) => entry.currentTitle),
      moved: entries.filter((entry: PlanCandidateEntry) => Number.isFinite(entry.currentIndex) && Number.isFinite(entry.proposedIndex) && entry.currentIndex !== entry.proposedIndex).map((entry: PlanCandidateEntry) => ({
        from: entry.currentIndex,
        title: entry.proposedTitle || entry.currentTitle,
        to: entry.proposedIndex
      })),
      retitled: entries.filter((entry: PlanCandidateEntry) => entry.currentTitle && entry.proposedTitle && normalizeCompactText(entry.currentTitle).toLowerCase() !== normalizeCompactText(entry.proposedTitle).toLowerCase()).map((entry: PlanCandidateEntry) => ({
        before: entry.currentTitle,
        after: entry.proposedTitle
      }))
    },
    summary: `Plan proposes ${planStats.total} current-deck step${planStats.total === 1 ? "" : "s"}.`
  };
}

function createDerivedSlideContexts(deckPlan: DeckPlan): Record<string, JsonObject> {
  return Object.fromEntries(deckPlan.slides.map((slide, index) => [
    `slide-${String(index + 1).padStart(2, "0")}`,
    {
      intent: slide.intent,
      layoutHint: slide.visualNeed,
      mustInclude: slide.keyMessage,
      notes: slide.sourceNeed,
      title: slide.title,
      value: slide.value || ""
    }
  ]));
}

function copyDerivedPresentationSources(sourcePresentationId: string, targetPaths: PresentationPaths): void {
  writeJson(targetPaths.sourcesFile, readJson(getPresentationPaths(sourcePresentationId).sourcesFile, { sources: [] }));
}

function copyDerivedPresentationMaterials(sourcePresentationId: string, targetPaths: PresentationPaths): void {
  const sourcePaths = getPresentationPaths(sourcePresentationId);
  duplicateDirectory(sourcePaths.materialsDir, targetPaths.materialsDir);
  writeJson(targetPaths.materialsFile, readJson(sourcePaths.materialsFile, { materials: [] }));
}

function writeDerivedPresentationContext(params: {
  deckPlan: DeckPlan;
  outlinePlanId: string;
  sourcePresentationId: string;
  targetContext: DeckContext;
  targetPaths: PresentationPaths;
}): void {
  writeJson(params.targetPaths.deckContextFile, {
    ...params.targetContext,
    deck: {
      ...params.targetContext.deck,
      lineage: {
        derivedAt: new Date().toISOString(),
        outlinePlanId: params.outlinePlanId,
        sourcePresentationId: params.sourcePresentationId
      },
      outline: params.deckPlan.outline
    },
    slides: createDerivedSlideContexts(params.deckPlan)
  });
}

function proposeDeckChangesFromOutlinePlan(presentationId: unknown, planId: unknown): JsonObject {
  const safeId = assertPresentationId(presentationId);
  const plan = getOutlinePlan(safeId, planId);
  if (plan.archivedAt) {
    throw new Error("Archived outline plans cannot propose deck changes.");
  }

  const deckPlan = outlinePlanToDeckPlan(plan);
  const currentSlides = getCurrentSlideEntries(safeId);
  const entries = createPlanCandidateEntries(deckPlan, currentSlides);
  const planStats = createPlanCandidateStats(entries);
  const proposedSequence = createPlanProposedSequence(entries);

  return {
    id: `outline-plan-candidate-${plan.id}`,
    kindLabel: "Outline plan",
    label: plan.name,
    outline: deckPlan.outline,
    diff: createPlanCandidateDiff(entries, currentSlides, proposedSequence, planStats),
    planStats,
    preview: {
      currentSequence: currentSlides.map((slide) => ({
        index: slide.index,
        title: slide.title
      })),
      overview: plan.purpose || plan.objective || "Apply this outline plan to the current deck.",
      previewHints: [],
      proposedSequence
    },
    promptSummary: plan.purpose || "",
    slides: entries,
    summary: `Propose current-deck changes from outline plan "${plan.name}".`
  };
}

function derivePresentationFromOutlinePlan(sourcePresentationId: unknown, planId: unknown, options: JsonObject = {}): JsonObject {
  const safeSourceId = assertPresentationId(sourcePresentationId);
  const plan = getOutlinePlan(safeSourceId, planId);
  const sourceContext = readPresentationDeckContext(safeSourceId);
  const sourceDeck = sourceContext.deck || {};
  const deckPlan = outlinePlanToDeckPlan(plan);
  const title = normalizeCompactText(options.title, `${plan.name} deck`);
  const slideSpecs = deckPlan.slides.map((slide, index) => createDerivedPlaceholderSlide(slide, index, deckPlan.slides.length));
  const presentation = createPresentation({
    audience: options.copyDeckContext === false ? plan.audience : plan.audience || sourceDeck.audience || "",
    constraints: options.copyDeckContext === false ? "" : sourceDeck.constraints || "",
    createDefaultFlow: false,
    initialSlideSpecs: slideSpecs,
    objective: plan.objective || plan.purpose || sourceDeck.objective || "",
    outline: deckPlan.outline,
    targetSlideCount: deckPlan.slides.length,
    themeBrief: options.copyDeckContext === false ? "" : sourceDeck.themeBrief || "",
    title,
    tone: plan.tone || sourceDeck.tone || "",
    visualTheme: options.copyTheme === false ? undefined : sourceDeck.visualTheme
  });
  const targetPaths = getPresentationPaths(presentation.id);
  const targetContext = readPresentationDeckContext(presentation.id);
  if (options.copySources === true) {
    copyDerivedPresentationSources(safeSourceId, targetPaths);
  }
  if (options.copyMaterials === true) {
    copyDerivedPresentationMaterials(safeSourceId, targetPaths);
  }
  writeDerivedPresentationContext({
    deckPlan,
    outlinePlanId: plan.id,
    sourcePresentationId: safeSourceId,
    targetContext,
    targetPaths
  });
  saveOutlinePlan(presentation.id, {
    ...plan,
    id: plan.id,
    parentPlanId: plan.id,
    sourcePresentationId: safeSourceId
  });

  return {
    outlinePlan: plan,
    presentation: readPresentationSummary(presentation.id)
  };
}

function getUniquePresentationId(title: unknown): string {
  const registry = ensurePresentationsState();
  const base = createSlug(title, "presentation");
  let candidate = base;
  let suffix = 2;

  while (registry.presentations.some((entry) => entry.id === candidate) || fs.existsSync(presentationRoot(candidate))) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function readFileMtime(fileName: string): number {
  try {
    return fs.statSync(fileName).mtime.getTime();
  } catch (error) {
    return 0;
  }
}

function readPresentationSummary(id: unknown): PresentationSummary {
  const safeId = assertPresentationId(id);
  const paths = getPresentationPaths(id);
  const meta = asJsonObject(readJson(paths.metaFile, createDefaultPresentationMeta({ id: safeId })));
  const deckContext = asJsonObject(readJson(paths.deckContextFile, null));
  const deck = asJsonObject(deckContext.deck);
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? fs.readdirSync(paths.slidesDir).filter((fileName: string) => /^slide-\d+\.json$/.test(fileName)).sort((left: string, right: string) => left.localeCompare(right, undefined, { numeric: true }))
    : [];
  const firstSlideFile = slideFiles[0];
  const firstSlideSpec = firstSlideFile ? readJson(path.join(paths.slidesDir, firstSlideFile), null) : null;
  const slidePaths = slideFiles.map((fileName: string) => path.join(paths.slidesDir, fileName));
  const updatedAtMs = [
    paths.metaFile,
    paths.deckContextFile,
    ...slidePaths
  ].reduce((latest: number, fileName: string) => Math.max(latest, readFileMtime(fileName)), 0);
  const lengthProfile = asJsonObject(deck.lengthProfile);

  return {
    audience: deck.audience || "",
    id: safeId,
    title: normalizeCompactText(deck.title || meta.title || safeId, safeId),
    description: normalizeCompactText(deck.objective || meta.description || deck.subject),
    targetSlideCount: normalizeTargetSlideCount(lengthProfile.targetCount),
    createdAt: meta.createdAt || "",
    objective: deck.objective || "",
    subject: deck.subject || "",
    tone: deck.tone || "",
    updatedAt: updatedAtMs ? new Date(updatedAtMs).toISOString() : (meta.updatedAt || ""),
    slideCount: slideFiles.filter((fileName: string) => {
      const slide = asJsonObject(readJson(path.join(paths.slidesDir, fileName), {}));
      return slide.archived !== true && slide.skipped !== true;
    }).length,
    firstSlideSpec,
    theme: deck.visualTheme || null
  };
}

function listPresentations(): JsonObject {
  const registry = ensurePresentationsState();
  const runtime = readRuntimeState(registry);

  return {
    activePresentationId: runtime.activePresentationId,
    presentations: registry.presentations.map((entry: RegistryEntry) => readPresentationSummary(entry.id))
  };
}

function createPresentation(fields: JsonObject = {}): PresentationSummary {
  const id = getUniquePresentationId(fields.title || "Untitled presentation");
  const paths = getPresentationPaths(id);
  const timestamp = new Date().toISOString();
  const title = normalizeCompactText(fields.title, "Untitled presentation");
  const context = createDefaultDeckContext({
    ...fields,
    title,
    outline: fields.outline || "1. Opening claim\n2. Supporting evidence\n3. Decision or handoff"
  });
  const meta = createDefaultPresentationMeta({
    id,
    title,
    description: fields.objective || fields.description || "",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  ensurePresentationFiles(id, meta);
  writeJson(paths.metaFile, meta);
  writeJson(paths.deckContextFile, context);
  writeJson(paths.variantsFile, { variants: [] });
  const initialSlideSpecs = Array.isArray(fields.initialSlideSpecs) && fields.initialSlideSpecs.length
    ? fields.initialSlideSpecs
    : createInitialSlideSpecs(asJsonObject(context.deck));

  initialSlideSpecs.forEach((slideSpec: unknown, index: number) => {
    writeSlideFile(paths, index + 1, asJsonObject(slideSpec));
  });

  const registry = ensurePresentationsState();
  const nextRegistry = writeRegistry({
    presentations: [
      ...registry.presentations,
      {
        id,
        title
      }
    ]
  });
  writeRuntimeState({
    activePresentationId: id
  }, nextRegistry);

  if (fields.createDefaultFlow !== false) {
    createOutlinePlanFromPresentation(id, {
      name: `${title} default flow`,
      presentationDensity: fields.presentationDensity || "balanced",
      purpose: fields.objective || `Maintain the default flow for ${title}.`,
      targetSlideCount: normalizeTargetSlideCount(fields.targetSlideCount ?? fields.targetCount) || initialSlideSpecs.length
    });
  }

  return readPresentationSummary(id);
}

function regeneratePresentationSlides(id: unknown, slideSpecs: unknown, fields: JsonObject = {}): PresentationSummary {
  const safeId = assertPresentationId(id);
  const registry = ensurePresentationsState();
  if (!registry.presentations.some((entry: RegistryEntry) => entry.id === safeId)) {
    throw new Error(`Unknown presentation: ${safeId}`);
  }
  if (!Array.isArray(slideSpecs) || !slideSpecs.length) {
    throw new Error("Expected generated slide specs");
  }

  const paths = getPresentationPaths(safeId);
  const currentContext = readPresentationDeckContext(safeId);
  const currentDeck = currentContext.deck;
  const timestamp = new Date().toISOString();
  const normalizedSlideSpecs = slideSpecs.map((slideSpec: unknown) => asJsonObject(slideSpec));
  const activeCount = normalizedSlideSpecs.filter((slideSpec: JsonObject) => slideSpec.skipped !== true).length;
  const skippedCount = normalizedSlideSpecs.filter((slideSpec: JsonObject) => slideSpec.skipped === true).length;
  const currentLengthProfile = asJsonObject(currentDeck.lengthProfile);
  const targetCount = normalizeTargetSlideCount(
    fields.targetSlideCount ?? fields.targetCount ?? currentLengthProfile.targetCount
  ) || normalizedSlideSpecs.length;

  removeSlideFiles(paths);
  normalizedSlideSpecs.forEach((slideSpec: JsonObject, index: number) => {
    writeSlideFile(paths, index + 1, slideSpec);
  });
  writeJson(paths.deckContextFile, {
    ...currentContext,
    deck: {
      ...currentDeck,
      lengthProfile: {
        activeCount,
        skippedCount,
        targetCount,
        updatedAt: timestamp
      },
      outline: fields.outline || currentDeck.outline || ""
    },
    slides: fields.slideContexts && typeof fields.slideContexts === "object" && !Array.isArray(fields.slideContexts)
      ? fields.slideContexts
      : currentContext.slides
  });
  updatePresentationMeta(safeId, {});

  return readPresentationSummary(safeId);
}

function duplicateDirectory(sourceDir: string, targetDir: string): void {
  ensureAllowedDir(targetDir);
  fs.cpSync(sourceDir, targetDir, {
    recursive: true
  });
}

function duplicatePresentation(sourceId: unknown, fields: JsonObject = {}): PresentationSummary {
  const safeSourceId = assertPresentationId(sourceId);
  const sourcePaths = getPresentationPaths(sourceId);
  if (!fs.existsSync(sourcePaths.rootDir)) {
    throw new Error(`Unknown presentation: ${sourceId}`);
  }

  const sourceSummary = readPresentationSummary(safeSourceId);
  const title = fields.title || `${sourceSummary.title} copy`;
  const id = getUniquePresentationId(title);
  const targetPaths = getPresentationPaths(id);
  duplicateDirectory(sourcePaths.rootDir, targetPaths.rootDir);
  const timestamp = new Date().toISOString();
  updatePresentationMeta(id, {
    id,
    title,
    description: sourceSummary.description,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  const context = readPresentationDeckContext(id);
  writeJson(targetPaths.deckContextFile, {
    ...context,
    deck: {
      ...context.deck,
      title
    }
  });

  const registry = ensurePresentationsState();
  const nextRegistry = writeRegistry({
    presentations: [
      ...registry.presentations,
      {
        id,
        title
      }
    ]
  });
  writeActivePresentationId(id, nextRegistry);

  return readPresentationSummary(id);
}

function deletePresentation(id: unknown): PresentationsRegistry {
  const registry = ensurePresentationsState();
  const safeId = assertPresentationInRegistry(registry, id);
  if (registry.presentations.length <= 1) {
    throw new Error("Cannot delete the only presentation.");
  }

  const runtime = readRuntimeState(registry);
  const nextPresentations = registry.presentations.filter((entry: RegistryEntry) => entry.id !== safeId);
  const nextActiveId = runtime.activePresentationId === safeId
    ? nextPresentations[0]?.id || defaultPresentationId
    : runtime.activePresentationId;
  const rootDir = presentationRoot(safeId);
  if (fs.existsSync(rootDir)) {
    fs.rmSync(rootDir, {
      recursive: true,
      force: true
    });
  }

  const nextRegistry = writeRegistry({
    presentations: nextPresentations
  });
  writeRuntimeState({
    activePresentationId: nextActiveId
  }, nextRegistry);

  return nextRegistry;
}

export {
  createDefaultDeckContext,
  createDefaultPresentationMeta,
  archiveOutlinePlan,
  createOutlinePlanFromDeckPlan,
  createOutlinePlanFromPresentation,
  createPresentation,
  deletePresentation,
  deleteOutlinePlan,
  derivePresentationFromOutlinePlan,
  duplicateOutlinePlan,
  duplicatePresentation,
  ensurePresentationFiles,
  ensurePresentationsState,
  getActivePresentationId,
  getActiveOutlinePlanId,
  getActivePresentationPaths,
  getOutlinePlan,
  getPresentationPaths,
  getPresentationCreationDraft,
  getRuntimeLlmSettings,
  listOutlinePlans,
  outlinePlanToDeckPlan,
  proposeDeckChangesFromOutlinePlan,
  readPresentationDeckContext,
  readPresentationSummary,
  regeneratePresentationSlides,
  listPresentations,
  listSavedThemes,
  presentationRuntimeFile,
  presentationsRegistryFile,
  clearPresentationCreationDraft,
  savePresentationCreationDraft,
  saveOutlinePlan,
  saveRuntimeLlmSettings,
  saveRuntimeTheme,
  setActiveOutlinePlan,
  setActivePresentation,
  updatePresentationMeta
};
