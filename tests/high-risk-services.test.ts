const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  listPresentations,
  presentationRuntimeFile,
  presentationsRegistryFile,
  setActivePresentation
} = require("../studio/server/services/presentations.ts");
const {
  archiveStructuredSlide,
  getSlides,
  insertStructuredSlide,
  readSlideSpec
} = require("../studio/server/services/slides.ts");
const {
  applyDeckLengthPlan,
  planDeckLength,
  planDeckLengthSemantic,
  restoreSkippedSlides
} = require("../studio/server/services/deck-length.ts");
const {
  generateInitialPresentation,
  generatePresentationFromDeckPlanIncremental,
  materializePlan
} = require("../studio/server/services/presentation-generation.ts");
const { normalizeVisualTheme } = require("../studio/server/services/deck-theme.ts");
const { getDeckContext } = require("../studio/server/services/state.ts");
const {
  createMaterialFromDataUrl,
  getMaterial,
  getMaterialFilePath,
  listMaterials
} = require("../studio/server/services/materials.ts");
const { importImageSearchResults } = require("../studio/server/services/image-search.ts");
const {
  createSource,
  deleteSource,
  getGenerationSourceContext,
  listSources,
  retrieveSourceSnippets
} = require("../studio/server/services/sources.ts");
const {
  applyVariant,
  captureVariant,
  getVariantStorageStatus,
  listVariantsForSlide,
  updateVariant
} = require("../studio/server/services/variants.ts");
const {
  assertAllowedWriteTarget,
  copyAllowedFile,
  ensureAllowedDir,
  removeAllowedPath,
  writeAllowedBinary,
  writeAllowedJson
} = require("../studio/server/services/write-boundary.ts");
const { getPresentationPaths } = require("../studio/server/services/presentations.ts");

const createdPresentationIds = new Set();
const originalActivePresentationId = listPresentations().activePresentationId;
const originalFetch = global.fetch;
const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC";
const htmxPresentationFixture = require("./fixtures/intro-to-htmx/presentation.json");
const htmxDeckContextFixture = require("./fixtures/intro-to-htmx/deck-context.json");
const llmEnvKeys = [
  "LMSTUDIO_MODEL",
  "STUDIO_LLM_MODEL",
  "STUDIO_LLM_PROVIDER"
];
const originalLlmEnv = Object.fromEntries(llmEnvKeys.map((key) => [key, process.env[key]]));

function testRelativeLuminance(hex) {
  const normalized = String(hex || "").replace(/^#/, "");
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function testContrastRatio(foreground, background) {
  const first = testRelativeLuminance(foreground);
  const second = testRelativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function createCoveragePresentation(suffix, fields: any = {}) {
  const presentation = createPresentation({
    audience: "Coverage validation",
    constraints: "Created by automated tests and removed after the run.",
    objective: "Exercise high-risk filesystem-backed studio services.",
    title: `Coverage Risk ${Date.now()} ${suffix}`,
    ...fields
  });
  createdPresentationIds.add(presentation.id);
  setActivePresentation(presentation.id);
  return presentation;
}

function cleanupCoveragePresentations() {
  const current = listPresentations();
  const knownIds = new Set(current.presentations.map((presentation) => presentation.id));

  for (const id of createdPresentationIds) {
    if (!knownIds.has(id)) {
      continue;
    }

    try {
      deletePresentation(id);
    } catch (error) {
      // Keep cleanup best-effort so the original assertion failure remains visible.
    }
  }

  const afterCleanup = listPresentations();
  if (afterCleanup.presentations.some((presentation) => presentation.id === originalActivePresentationId)) {
    setActivePresentation(originalActivePresentationId);
  }
}

function createContentSlideSpec(title, index = 2) {
  return {
    type: "content",
    index,
    title,
    eyebrow: "Coverage",
    summary: "A structured slide used to verify insert, archive, and variant behavior.",
    signalsTitle: "Signals",
    guardrailsTitle: "Guardrails",
    signals: [
      { id: "signal-one", label: "one", value: 0.8 },
      { id: "signal-two", label: "two", value: 0.7 },
      { id: "signal-three", label: "three", value: 0.6 },
      { id: "signal-four", label: "four", value: 0.5 }
    ],
    guardrails: [
      { id: "guardrail-one", label: "one", value: "1" },
      { id: "guardrail-two", label: "two", value: "1" },
      { id: "guardrail-three", label: "three", value: "1" }
    ]
  };
}

test("visual theme normalization enforces readable contrast", () => {
  const visualTheme = normalizeVisualTheme({
    accent: "123456",
    bg: "000000",
    muted: "1b2a3a",
    primary: "113153",
    progressFill: "222222",
    progressTrack: "111111",
    secondary: "123456"
  });

  assert.ok(testContrastRatio(visualTheme.primary, visualTheme.bg) >= 4.5, "primary text should meet WCAG AA contrast");
  assert.ok(testContrastRatio(visualTheme.muted, visualTheme.bg) >= 4.5, "muted text should meet WCAG AA contrast");
  assert.ok(testContrastRatio(visualTheme.secondary, visualTheme.bg) >= 4.5, "secondary text should meet WCAG AA contrast");
  assert.ok(testContrastRatio(visualTheme.progressFill, visualTheme.progressTrack) >= 3, "progress fill should contrast against the track");
});

function createLmStudioStreamResponse(data) {
  const content = JSON.stringify(data);
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const payload = {
        choices: [
          {
            delta: {
              content
            },
            finish_reason: null
          }
        ],
        id: "chatcmpl-coverage",
        model: "semantic-coverage-model"
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream"
    },
    status: 200
  });
}

function withVisiblePlanFields(slide, fields: any = {}) {
  return {
    eyebrow: fields.eyebrow || "Section",
    guardrails: fields.guardrails || [
      { body: "Keep the slide focused on one useful idea.", title: "Focus" },
      { body: "Make the claim concrete enough to discuss.", title: "Concrete" },
      { body: "Avoid adding unsupported details.", title: "Evidence" }
    ],
    guardrailsTitle: fields.guardrailsTitle || "Checks",
    mediaMaterialId: fields.mediaMaterialId || "",
    note: fields.note || "Introduce the slide in one clear sentence.",
    resources: fields.resources || [
      { body: "Use the next action while reviewing the draft.", title: "Action" },
      { body: "Keep one example ready for questions.", title: "Example" }
    ],
    resourcesTitle: fields.resourcesTitle || "Cues",
    signalsTitle: fields.signalsTitle || "Points",
    ...slide
  };
}

function createGeneratedPlan(title, slideCount, options: any = {}) {
  const startIndex = Number.isFinite(Number(options.startIndex)) ? Number(options.startIndex) : 0;
  const total = Number.isFinite(Number(options.total)) ? Number(options.total) : slideCount;
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const absoluteIndex = startIndex + index;
    const isFirst = absoluteIndex === 0;
    const isLast = absoluteIndex === total - 1 && total > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : ["context", "concept", "mechanics", "example", "tradeoff"][(absoluteIndex - 1) % 5];
    const label = `${title} ${absoluteIndex + 1}`;
    const sourceBody = options.sourceText && index === 1 ? options.sourceText : `${label} carries generated draft content.`;
    const mediaMaterialId = options.mediaMaterialId && index === (options.mediaSlideIndex || 1) ? options.mediaMaterialId : "";

    return withVisiblePlanFields({
      keyPoints: [
        { body: sourceBody, title: `${label} point A` },
        { body: `${label} adds a second distinct idea.`, title: `${label} point B` },
        { body: `${label} adds a third distinct idea.`, title: `${label} point C` },
        { body: `${label} adds a fourth distinct idea.`, title: `${label} point D` }
      ],
      mediaMaterialId,
      role,
      summary: `${label} summarizes one useful generated idea.`,
      title: label
    }, {
      eyebrow: isFirst ? "Opening" : isLast ? "Close" : `Section ${index + 1}`,
      guardrails: [
        { body: `${label} guardrail one is specific.`, title: `${label} check A` },
        { body: `${label} guardrail two is specific.`, title: `${label} check B` },
        { body: `${label} guardrail three is specific.`, title: `${label} check C` }
      ],
      guardrailsTitle: `${label} checks`,
      note: `${label} has a speaker note.`,
      resources: [
        { body: `${label} resource one.`, title: `${label} resource A` },
        { body: `${label} resource two.`, title: `${label} resource B` }
      ],
      resourcesTitle: `${label} resources`,
      signalsTitle: `${label} points`
    });
  });

  return {
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    references: [],
    slides,
    summary: `${title} generated plan`
  };
}

function createGeneratedDeckPlan(title, slideCount) {
  const slides = Array.from({ length: slideCount }, (_unused, index) => {
    const isFirst = index === 0;
    const isLast = index === slideCount - 1 && slideCount > 1;
    const role = isFirst ? "opening" : isLast ? "handoff" : ["context", "concept", "mechanics", "example", "tradeoff"][(index - 1) % 5];
    const label = `${title} ${index + 1}`;

    return {
      intent: `${label} has a distinct planning intent.`,
      keyMessage: `${label} carries one clear generated message.`,
      role,
      sourceNeed: `${label} should use supplied context when relevant.`,
      title: label,
      visualNeed: `${label} may use fitting supplied imagery.`
    };
  });

  return {
    audience: "Coverage audience",
    language: "English",
    narrativeArc: `${title} moves from context to action.`,
    outline: slides.map((slide, index) => `${index + 1}. ${slide.title}`).join("\n"),
    slides,
    thesis: `${title} should exercise phased generation.`
  };
}

test.after(() => {
  cleanupCoveragePresentations();
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
});

test("presentation lifecycle keeps registry, active deck, and copied files consistent", () => {
  const presentation = createCoveragePresentation("lifecycle", { targetSlideCount: 8 });
  const paths = getPresentationPaths(presentation.id);

  assert.ok(fs.existsSync(paths.rootDir), "created presentation should have a root directory");
  assert.equal(listPresentations().activePresentationId, presentation.id, "created presentation should become active");
  assert.equal(getSlides().length, 3, "new presentations should start with a three-slide scaffold");
  assert.equal(getDeckContext().deck.lengthProfile.targetCount, 8, "new presentations should persist the requested target slide count");
  assert.equal(
    listPresentations().presentations.find((entry) => entry.id === presentation.id)?.targetSlideCount,
    8,
    "presentation summaries should expose the requested target slide count"
  );

  const duplicate = duplicatePresentation(presentation.id);
  createdPresentationIds.add(duplicate.id);
  const duplicatePaths = getPresentationPaths(duplicate.id);

  assert.equal(listPresentations().activePresentationId, duplicate.id, "duplicated presentation should become active");
  assert.ok(fs.existsSync(duplicatePaths.rootDir), "duplicate should copy presentation files");
  assert.equal(getSlides().length, 3, "duplicate should copy the slide scaffold");
  assert.equal(
    listPresentations().presentations.find((entry) => entry.id === duplicate.id)?.title,
    duplicate.title,
    "duplicate should retitle the deck summary"
  );

  deletePresentation(duplicate.id);
  createdPresentationIds.delete(duplicate.id);
  assert.ok(
    !listPresentations().presentations.some((entry) => entry.id === duplicate.id),
    "deleted duplicate should leave the registry"
  );
  assert.ok(!fs.existsSync(duplicatePaths.rootDir), "deleted duplicate should remove copied files");

  assert.throws(
    () => setActivePresentation("missing-presentation"),
    /Unknown presentation/,
    "selecting an unknown presentation should fail explicitly"
  );
});

test("active presentation selection writes runtime state without rewriting the registry", () => {
  const current = listPresentations();
  let target = current.presentations.find((presentation) => presentation.id !== current.activePresentationId);

  if (!target) {
    target = createCoveragePresentation("runtime-selection");
  }

  const registryBefore = fs.readFileSync(presentationsRegistryFile, "utf8");
  setActivePresentation(target.id);
  const registryAfter = fs.readFileSync(presentationsRegistryFile, "utf8");
  const runtime = JSON.parse(fs.readFileSync(presentationRuntimeFile, "utf8"));

  assert.equal(registryAfter, registryBefore, "selecting a deck should not rewrite the tracked presentation registry");
  assert.equal(runtime.activePresentationId, target.id, "runtime state should carry the active deck selection");
});

test("structured slide insert and archive preserve active order and hidden history", () => {
  createCoveragePresentation("slides");

  const created = insertStructuredSlide(createContentSlideSpec("Inserted coverage slide", 2), 2);
  const activeSlides = getSlides();

  assert.equal(created.id, "slide-04", "insert should allocate the next slide file instead of overwriting");
  assert.deepEqual(
    activeSlides.map((slide) => `${slide.id}:${slide.index}`),
    ["slide-01:1", "slide-04:2", "slide-02:3", "slide-03:4"],
    "insert should move later active slides forward"
  );

  const removed = archiveStructuredSlide(created.id);
  const remainingSlides = getSlides();
  const archivedSlides = getSlides({ includeArchived: true });

  assert.equal(removed.id, created.id, "archive should report the removed active slide");
  assert.deepEqual(
    remainingSlides.map((slide) => `${slide.id}:${slide.index}`),
    ["slide-01:1", "slide-02:2", "slide-03:3"],
    "archive should close the active slide index gap"
  );
  assert.equal(
    archivedSlides.find((slide) => slide.id === created.id)?.archived,
    true,
    "archived slides should stay inspectable when requested"
  );
});

test("deck length scaling marks slides as skipped and restores them without losing files", () => {
  createCoveragePresentation("deck-length");

  insertStructuredSlide(createContentSlideSpec("Implementation detail slide", 4), 4);
  insertStructuredSlide(createContentSlideSpec("Technical appendix slide", 5), 5);
  insertStructuredSlide(createContentSlideSpec("Reference material slide", 6), 6);

  assert.equal(getSlides().length, 6, "fixture should start with six active slides");

  const plan = planDeckLength({ mode: "appendix-first", targetCount: 4 });
  const skipActions = plan.actions.filter((action) => action.action === "skip");

  assert.equal(plan.currentCount, 6, "planning should describe the active deck length");
  assert.equal(plan.nextCount, 4, "planning should converge on the requested shorter length");
  assert.equal(skipActions.length, 2, "shortening should propose skips instead of deletion");

  const shortened = applyDeckLengthPlan({
    actions: plan.actions,
    mode: plan.mode,
    targetCount: plan.targetCount
  });
  const skippedSlideIds = getSlides({ includeSkipped: true })
    .filter((slide) => slide.skipped)
    .map((slide) => slide.id);

  assert.equal(shortened.lengthProfile.activeCount, 4, "applying a shorter plan should reduce only the active slide count");
  assert.equal(shortened.lengthProfile.skippedCount, 2, "skipped slides should be counted in the length profile");
  assert.equal(getSlides().length, 4, "default slide listing should hide skipped slides");
  assert.equal(getSlides({ includeSkipped: true }).length, 6, "skipped slides should remain inspectable");
  assert.equal(skippedSlideIds.length, 2, "skipped slides should be marked on their slide specs");
  skippedSlideIds.forEach((slideId) => {
    const slideSpec = readSlideSpec(slideId);
    assert.equal(slideSpec.skipped, true, "skipped specs should persist the skipped marker");
    assert.equal(slideSpec.skipMeta.operation, "scale-deck-length", "skipped specs should record their source operation");
  });

  const restorePlan = planDeckLength({ targetCount: 6 });
  assert.equal(
    restorePlan.actions.filter((action) => action.action === "restore").length,
    2,
    "lengthening should propose restoring previously skipped slides first"
  );

  const restoredByPlan = applyDeckLengthPlan({
    actions: restorePlan.actions,
    targetCount: restorePlan.targetCount
  });
  assert.equal(restoredByPlan.lengthProfile.activeCount, 6, "restore actions should return skipped slides to the active deck");
  assert.equal(getSlides({ includeSkipped: true }).filter((slide) => slide.skipped).length, 0, "restore actions should clear skipped markers");

  const oneSkipPlan = planDeckLength({ targetCount: 5 });
  applyDeckLengthPlan({
    actions: oneSkipPlan.actions,
    targetCount: oneSkipPlan.targetCount
  });
  assert.equal(getSlides().length, 5, "second shortening pass should leave one skipped slide");

  const restoredAll = restoreSkippedSlides({ all: true });
  assert.equal(restoredAll.restoredSlides, 1, "bulk restore should report restored skipped slides");
  assert.deepEqual(
    getSlides().map((slide) => slide.index),
    [1, 2, 3, 4, 5, 6],
    "restored slides should be compacted back into a contiguous active order"
  );
});

test("semantic deck length planning can insert detail slides when growing", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  createCoveragePresentation("semantic-length-grow");

  const plan = await planDeckLengthSemantic({
    mode: "semantic",
    targetCount: 5
  });
  const insertActions = plan.actions.filter((action) => action.action === "insert");

  assert.equal(plan.currentCount, 3, "semantic growth planning should start from the active deck length");
  assert.equal(plan.nextCount, 5, "semantic growth planning should converge on the target length");
  assert.equal(insertActions.length, 2, "semantic growth should add new detail slide actions when there are no skipped slides to restore");
  assert.ok(insertActions.every((action) => action.slideSpec && action.slideSpec.type === "content"), "insert actions should carry valid structured slide specs");

  const applied = applyDeckLengthPlan({
    actions: plan.actions,
    targetCount: plan.targetCount
  });

  assert.equal(applied.insertedSlides, 2, "applying semantic growth should insert generated detail slides");
  assert.equal(getSlides().length, 5, "semantic growth should increase the active deck length");
});

test("semantic deck length planning can use LLM slide-ranking for shrink decisions", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  createCoveragePresentation("semantic-length-shrink");
  insertStructuredSlide(createContentSlideSpec("Optional technical detail", 4), 3);

  global.fetch = async (_url, init) => {
    const requestBody = JSON.parse(init.body);
    assert.equal(requestBody.response_format.json_schema.name, "semantic_deck_length_plan");
    assert.match(requestBody.messages[1].content, /Optional technical detail/);

    return createLmStudioStreamResponse({
      actions: [
        {
          action: "skip",
          confidence: "high",
          keyPoints: [],
          reason: "This is optional implementation detail and can return when the deck has more room.",
          slideId: "slide-04",
          summary: "",
          targetIndex: 0,
          title: "Optional technical detail"
        }
      ],
      summary: "Skip one optional technical detail slide."
    });
  };

  try {
    const plan = await planDeckLengthSemantic({
      mode: "semantic",
      targetCount: 3
    });

    assert.equal(plan.actions.length, 1, "semantic shrink planning should return one skip action");
    assert.equal(plan.actions[0].slideId, "slide-04", "semantic shrink planning should honor the ranked LLM skip candidate");
    assert.match(plan.actions[0].reason, /optional implementation detail/i);
  } finally {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("initial presentation generation requires complete LLM-visible plans", async () => {
  const fields = {
    ...htmxDeckContextFixture.deck,
    description: htmxPresentationFixture.description,
    targetSlideCount: htmxDeckContextFixture.deck.lengthProfile.targetCount
  };
  const weakPlan = {
    outline: "Intro to HTMX",
    references: [
      {
        note: "Invented citation from a weak model response.",
        title: "Smith et al.",
        url: ""
      }
    ],
    slides: [
      {
        keyPoints: [
          { body: "HTMX enables rich interactions with minimal JavaScript by extending HTML attributes.", title: "summary" },
          { body: "It shifts complexity from client-side scripting to server-driven responses.", title: "title:" },
          { body: "HTMX enables rich interactions with minimal JavaScript by extending HTML attributes.", title: "summary" },
          { body: "Students should see a concrete request and response example.", title: "Example" }
        ],
        role: "opening",
        summary: "This presentation introduces HTMX as a server-driven way to build interactive web applications.",
        title: "Intro to HTMX"
      },
      {
        keyPoints: [
          { body: "hx-get issues a GET request from an HTML element.", title: "summary" },
          { body: "hx-target chooses the element that receives the returned fragment.", title: "Target" },
          { body: "hx-swap chooses how the fragment is inserted.", title: "Swap" },
          { body: "The server returns HTML, not a JSON view model.", title: "Response" }
        ],
        role: "mechanics",
        summary: "HTMX behavior is mostly declared through attributes on ordinary HTML elements.",
        title: "How requests work"
      },
      {
        keyPoints: [
          { body: "Review official documentation before citing specific behavior.", title: "Verify docs" },
          { body: "Try a small form submission before adopting HTMX broadly.", title: "Practice" },
          { body: "Compare server-rendered fragments with JSON API client rendering.", title: "Compare" },
          { body: "Academic References: Smith et al., Journal of Web Technologies, 2023...", title: "Academic References" }
        ],
        role: "handoff",
        summary: "Close by showing what students should verify and try next...",
        title: "References and next steps"
      }
    ],
    summary: "Weak model response shaped like the HTMX trial deck."
  };
  assert.throws(
    () => materializePlan(fields, weakPlan),
    /missing usable/,
    "materializer should reject weak LLM plans instead of inventing visible fallback copy"
  );

  const duplicatePlan = {
    outline: "Workshop planning",
    references: [],
    slides: Array.from({ length: 4 }, () => createGeneratedPlan("Repeated generated slide", 1).slides[0]),
    summary: "Weak model repeated one plan slide."
  };
  assert.throws(
    () => materializePlan({
      audience: "Workshop participants",
      objective: "Explain a planning workflow clearly.",
      title: "Workshop planning"
    }, duplicatePlan),
    /repeats slide/,
    "materializer should reject duplicate plans instead of replacing them with template copy"
  );

  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = JSON.parse(init.body);
    if (requestBody.response_format.json_schema.name === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Intro to HTMX", fields.targetSlideCount));
    }

    assert.equal(requestBody.response_format.json_schema.name, "initial_presentation_plan");
    assert.ok(
      requestBody.max_tokens >= fields.targetSlideCount * 900,
      "initial presentation slide drafting should reserve enough output tokens for complete structured JSON"
    );
    return createLmStudioStreamResponse(createGeneratedPlan("Intro to HTMX", fields.targetSlideCount));
  };

  const generated = await generateInitialPresentation(fields);
  const generatedVisibleText = generated.slideSpecs.flatMap((slideSpec) => [
    slideSpec.eyebrow,
    slideSpec.title,
    slideSpec.summary,
    slideSpec.note,
    slideSpec.signalsTitle,
    slideSpec.guardrailsTitle,
    slideSpec.resourcesTitle,
    ...(slideSpec.cards || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.signals || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.guardrails || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.bullets || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.resources || []).flatMap((item) => [item.title, item.body])
  ].filter(Boolean));

  assert.equal(generated.slideSpecs.length, 20, "LLM generation should respect the HTMX target length fixture");
  assert.ok(!generatedVisibleText.some((value) => /\.{3,}|…/.test(String(value))), "LLM generation should avoid ellipsis truncation");
  assert.ok(!generatedVisibleText.some((value) => /\b(a|an|and|as|at|before|by|for|from|in|into|of|on|or|the|through|to|when|where|while|with|within|without)$/i.test(String(value).trim())), "LLM generation should avoid dangling sentence endings");
  assert.ok(!generatedVisibleText.some((value) => /Refine constraints before expanding the deck|^Guardrails$|^Sources to verify$/i.test(String(value))), "LLM generation should avoid visible scaffolding labels");
  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
});

test("presentation sources are presentation-scoped and retrieved during LLM generation", async () => {
  const presentation = createCoveragePresentation("sources");
  const paths = getPresentationPaths(presentation.id);

  const source = await createSource({
    text: [
      "HTMX swaps HTML fragments into the page so the server can own more interface behavior.",
      "Progressive enhancement remains practical because plain HTML forms and links can keep working."
    ].join(" "),
    title: "HTMX implementation notes"
  });
  const duplicateSource = await createSource({
    text: "HTMX swaps HTML fragments into the page so the server can own more interface behavior.",
    title: "Duplicate HTMX notes"
  });

  assert.ok(fs.existsSync(paths.sourcesFile), "sources should persist beside the active presentation state");
  assert.equal(listSources().length, 2, "created sources should be listed for the active presentation");

  const snippets = retrieveSourceSnippets("HTMX HTML fragments progressive enhancement", { limit: 4 });
  assert.equal(snippets[0].sourceId, source.id, "retrieval should return matching source snippets");
  assert.match(snippets[0].text, /HTML fragments/, "retrieved snippet should carry grounded source text");
  assert.equal(
    new Set(snippets.map((snippet) => snippet.text)).size,
    snippets.length,
    "retrieval should suppress duplicate chunks"
  );

  const budgetedContext = getGenerationSourceContext({
    includeActiveSources: false,
    presentationSources: [{
      text: Array.from({ length: 10 }, (_unused, index) => (
        `HTMX fragment budget ${index + 1}. ${"Detailed retrieval material for prompt budgeting. ".repeat(18)}`
      )).join("\n\n"),
      title: "Budget source"
    }],
    title: "HTMX fragment budget"
  });
  assert.ok(budgetedContext.snippets.length <= 6, "generation source context should cap prompt snippets");
  assert.ok(budgetedContext.budget.promptCharCount <= budgetedContext.budget.maxPromptChars, "generation source context should cap prompt source characters");
  assert.ok(
    budgetedContext.snippets.every((snippet) => snippet.text.length <= budgetedContext.budget.maxSnippetChars),
    "generation source context should cap each snippet excerpt"
  );
  assert.ok(
    budgetedContext.budget.truncatedSnippetCount > 0 || budgetedContext.budget.omittedSnippetCount > 0,
    "generation source context should report source prompt budget pressure"
  );
  deleteSource(duplicateSource.id);

  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  let generationRequestCount = 0;
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = JSON.parse(init.body);
    generationRequestCount += 1;
    const schemaName = requestBody.response_format.json_schema.name;

    if (generationRequestCount <= 2) {
      assert.match(requestBody.messages[1].content, /HTML fragments/);
    } else {
      assert.doesNotMatch(requestBody.messages[1].content, /HTML fragments/);
    }

    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Intro to HTMX", generationRequestCount <= 2 ? 5 : 3));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    if (generationRequestCount <= 2) {
      return createLmStudioStreamResponse(createGeneratedPlan("Intro to HTMX", 5, {
        sourceText: "HTMX swaps HTML fragments into the page."
      }));
    }

    return createLmStudioStreamResponse(createGeneratedPlan("Intro to HTMX", 3));
  };

  const generated = await generateInitialPresentation({
    objective: "Explain how HTMX handles HTML fragment swaps.",
    targetSlideCount: 5,
    title: "Intro to HTMX"
  });
  const visibleText = generated.slideSpecs.flatMap((slideSpec) => [
    slideSpec.summary,
    ...(slideSpec.cards || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.signals || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.guardrails || []).flatMap((item) => [item.title, item.body]),
    ...(slideSpec.bullets || []).flatMap((item) => [item.title, item.body])
  ].filter(Boolean));

  assert.equal(generated.retrieval.snippets[0].sourceId, source.id, "generation should report the retrieved source metadata");
  assert.ok(
    visibleText.some((value) => /HTML fragments/i.test(String(value))),
    "LLM generation should receive retrieved source snippets as candidate content"
  );

  const generatedWithoutActiveSources = await generateInitialPresentation({
    includeActiveSources: false,
    objective: "Explain how HTMX handles HTML fragment swaps.",
    targetSlideCount: 3,
    title: "Intro to HTMX"
  });
  assert.equal(
    generatedWithoutActiveSources.retrieval.snippets.length,
    0,
    "new presentation generation can opt out of previously active presentation sources"
  );

  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });

  await assert.rejects(
    () => createSource({ url: "http://localhost/source.html" }),
    /local host/,
    "source URL fetching should reject local hosts before making a request"
  );

  deleteSource(source.id);
  assert.equal(listSources().length, 0, "deleted sources should be removed from the active presentation");
});

test("LLM presentation generation repairs duplicate deck plans before drafting", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  const progressEvents = [];
  const requestSchemas = [];
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = JSON.parse(init.body);
    const schemaName = requestBody.response_format.json_schema.name;
    requestSchemas.push(schemaName);

    if (schemaName === "initial_presentation_deck_plan") {
      const duplicated = createGeneratedDeckPlan("Finnish berries", 4);
      duplicated.slides[2] = {
        ...duplicated.slides[1],
        role: "concept"
      };
      return createLmStudioStreamResponse(duplicated);
    }

    if (schemaName === "initial_presentation_deck_plan_repair") {
      assert.match(requestBody.messages[1].content, /repeats an earlier slide/);
      return createLmStudioStreamResponse(createGeneratedDeckPlan("Finnish berries", 4));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    assert.match(requestBody.messages[1].content, /Approved deck plan/);
    return createLmStudioStreamResponse(createGeneratedPlan("Berry", 4));
  };

  try {
    const generated = await generateInitialPresentation({
      audience: "Beginners",
      constraints: "Theme like a Finnish forest.",
      objective: "What kind of berries exist in Finland?",
      onProgress: (event) => progressEvents.push(event),
      targetSlideCount: 4,
      title: "Introduction to Finnish Berries",
      tone: "Executive"
    });

    assert.deepEqual(
      requestSchemas,
      ["initial_presentation_deck_plan", "initial_presentation_deck_plan_repair", "initial_presentation_plan"],
      "duplicate deck planning should repair before slide drafting"
    );
    assert.equal(generated.slideSpecs.length, 4, "generation should continue after deck-plan repair");
    assert.ok(progressEvents.some((event) => event.stage === "deck-plan-repair"), "deck-plan repair should publish progress");
  } finally {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation drafts approved outlines one slide at a time", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "incremental-coverage-model";

  const deckPlan = createGeneratedDeckPlan("Incremental deck", 4);
  const progressEvents = [];
  const writtenCounts = [];
  const targetSlides = [];
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = JSON.parse(init.body);
    const schemaName = requestBody.response_format.json_schema.name;
    assert.equal(schemaName, "initial_presentation_plan");

    const prompt = String(requestBody.messages.map((message) => message.content).join("\n"));
    const targetMatch = prompt.match(/Target outline slide:\s*(\d+)\s+of\s+(\d+)/);
    assert.ok(targetMatch, "incremental drafting should name the target outline slide");
    const slideNumber = Number.parseInt(targetMatch[1], 10);
    const total = Number.parseInt(targetMatch[2], 10);
    targetSlides.push(slideNumber);

    return createLmStudioStreamResponse(createGeneratedPlan("Incremental deck", 1, {
      startIndex: slideNumber - 1,
      total
    }));
  };

  try {
    const generated = await generatePresentationFromDeckPlanIncremental({
      audience: "Maintainers",
      objective: "Show incremental reliability",
      onProgress: (event) => progressEvents.push(event),
      targetSlideCount: 4,
      title: "Incremental deck",
      tone: "Direct"
    }, deckPlan, {}, {
      onSlide: ({ slideSpecs }) => {
        writtenCounts.push(slideSpecs.length);
      }
    });

    assert.deepEqual(targetSlides, [1, 2, 3, 4], "drafting should request each outline slide in order");
    assert.deepEqual(writtenCounts, [1, 2, 3, 4], "partial slide specs should be available after every slide");
    assert.equal(generated.slideSpecs.length, 4, "incremental generation should return the complete deck");
    assert.equal(generated.slideSpecs[0].type, "cover", "first generated slide should remain a cover");
    assert.equal(generated.slideSpecs[3].type, "summary", "last generated slide should remain a handoff summary");
    assert.ok(progressEvents.some((event) => event.stage === "drafting-slide"), "drafting should publish per-slide progress");
  } finally {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation semantically shortens overlong visible text", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  const progressEvents = [];
  let repairRequestSeen = false;
  let requestCount = 0;
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = JSON.parse(init.body);
    requestCount += 1;

    if (requestBody.response_format.json_schema.name === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("How to Make Presentations", 3));
    }

    if (requestBody.response_format.json_schema.name === "initial_presentation_plan") {
      return createLmStudioStreamResponse({
        outline: "1. Open\n2. Practice\n3. Close",
        references: [],
        slides: [
          withVisiblePlanFields({
            keyPoints: [
              { body: "Frame the practical goal for the audience before you show any detail.", title: "Goal" },
              { body: "Name the specific audience need that the talk will answer.", title: "Audience" },
              { body: "Preview the workflow in plain words before moving into examples.", title: "Workflow" },
              { body: "Promise one repeatable method that the listener can reuse.", title: "Promise" }
            ],
            role: "opening",
            summary: "Open by explaining the practical outcome and how the deck will help new presenters plan a clear talk.",
            title: "How to Make Presentations"
          }, { eyebrow: "Opening", note: "Start with the practical outcome." }),
          withVisiblePlanFields({
            keyPoints: [
              {
                body: "Practice your talk three times while timing each run to stay within the planned session limit and keep confidence.",
                title: "Practice under real timing conditions"
              },
              {
                body: "Record one rehearsal and watch it once to find distracting habits before the real delivery.",
                title: "Record one rehearsal"
              },
              {
                body: "Ask one peer to identify the moment where the presentation first becomes unclear.",
                title: "Ask for feedback"
              },
              {
                body: "Cut one low-value detail so the central lesson has more space.",
                title: "Trim the middle"
              }
            ],
            role: "example",
            summary: "Show a concrete rehearsal loop that keeps a presentation clear, timed, and easier to deliver.",
            title: "Practice Before You Present"
          }, { eyebrow: "Example", guardrailsTitle: "Checks" }),
          withVisiblePlanFields({
            keyPoints: [
              { body: "Use the same checklist on your next short talk.", title: "Reuse" },
              { body: "Keep notes about what changed after feedback.", title: "Reflect" },
              { body: "Turn one improvement into a habit for next time.", title: "Improve" },
              { body: "Share the deck only after the spoken path works.", title: "Share" }
            ],
            role: "handoff",
            summary: "Close with one next action and a reusable checklist for the next presentation.",
            title: "Use the Checklist"
          }, { eyebrow: "Close", resourcesTitle: "Next cues" })
        ],
        summary: "Coverage plan"
      });
    }

    assert.equal(requestBody.response_format.json_schema.name, "presentation_semantic_text_repairs");
    repairRequestSeen = /Practice your talk three times/.test(requestBody.messages[1].content);
    return createLmStudioStreamResponse({
      repairs: [
        {
          id: "slide-2-point-1-title",
          text: "Practice with timing"
        },
        {
          id: "slide-2-point-1-body",
          text: "Run three timed rehearsals before presenting."
        }
      ]
    });
  };

  try {
    const generated = await generateInitialPresentation({
      generationMode: "llm",
      includeActiveSources: false,
      onProgress: (event) => progressEvents.push(event),
      targetSlideCount: 3,
      title: "How to Make Presentations"
    });
    const visibleText = generated.slideSpecs.flatMap((slideSpec) => [
      slideSpec.title,
      slideSpec.summary,
      ...(slideSpec.cards || []).flatMap((item) => [item.title, item.body]),
      ...(slideSpec.signals || []).flatMap((item) => [item.title, item.body]),
      ...(slideSpec.bullets || []).flatMap((item) => [item.title, item.body])
    ].filter(Boolean));

    assert.equal(requestCount, 3, "LLM generation should request deck planning, slide drafting, and semantic repair");
    assert.equal(repairRequestSeen, true, "semantic repair prompt should receive the original overlong text");
    assert.ok(visibleText.some((value) => value === "Run three timed rehearsals before presenting."), "semantic repair should preserve meaning in a shorter field");
    assert.ok(!visibleText.some((value) => /Practice your talk three times while timing each run to stay$/i.test(String(value))), "semantic repair should avoid deterministic clipped fragments");
    assert.ok(progressEvents.some((event) => event.stage === "semantic-repair"), "semantic repair should publish progress");
  } finally {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("LLM presentation generation preserves non-English visible structure", async () => {
  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";

  let requestCount = 0;
  global.fetch = async (_url, init) => {
    const requestBody = JSON.parse(init.body);
    requestCount += 1;
    const schemaName = requestBody.response_format.json_schema.name;
    if (schemaName === "initial_presentation_deck_plan") {
      assert.match(requestBody.messages[0].content, /Use the language requested or implied by the brief/);
      return createLmStudioStreamResponse({
        audience: "suomenkieliset esiintyjät",
        language: "suomi",
        narrativeArc: "Esitys kulkee lupauksesta menetelmään ja seuraavaan toimeen.",
        outline: "1. Alku\n2. Menetelmä\n3. Seuraavat askeleet",
        slides: [
          {
            intent: "Avaa aihe kuulijan hyödyn kautta.",
            keyMessage: "Hyvä esitys alkaa selkeällä lupauksella.",
            role: "opening",
            sourceNeed: "Käytä käyttäjän tavoitetta.",
            title: "Hyvä esitys",
            visualNeed: "Ei välttämätöntä kuvaa."
          },
          {
            intent: "Näytä rakenteen käytännön merkitys.",
            keyMessage: "Rakenne pitää viestin koossa.",
            role: "concept",
            sourceNeed: "Käytä briefin rajausta.",
            title: "Rakenna selkeä polku",
            visualNeed: "Yksinkertainen rakennekuva voi auttaa."
          },
          {
            intent: "Sulje yhdellä seuraavalla toimella.",
            keyMessage: "Kuulijan pitää tietää mitä tehdä seuraavaksi.",
            role: "handoff",
            sourceNeed: "Käytä tavoitetta.",
            title: "Seuraava askel",
            visualNeed: "Ei välttämätöntä kuvaa."
          }
        ],
        thesis: "Hyvä esitys auttaa kuulijaa toimimaan."
      });
    }

    assert.equal(schemaName, "initial_presentation_plan");
    assert.match(requestBody.messages[0].content, /Use the language requested or implied by the brief/);

    return createLmStudioStreamResponse({
      outline: "1. Alku\n2. Menetelmä\n3. Seuraavat askeleet",
      references: [],
      slides: [
        withVisiblePlanFields({
          keyPoints: [
            { body: "Kuulija näkee heti miksi aihe on hyödyllinen.", title: "Hyöty" },
            { body: "Tavoite rajaa esityksen yhteen selkeään lupaukseen.", title: "Tavoite" },
            { body: "Esimerkki tekee ideasta helpomman muistaa.", title: "Esimerkki" },
            { body: "Lopetus kertoo mitä tehdä seuraavaksi.", title: "Lopetus" }
          ],
          role: "opening",
          summary: "Avaa esitys yhdellä selkeällä lupauksella.",
          title: "Hyvä esitys"
        }, {
          eyebrow: "Alku",
          note: "Kerro miksi aihe on kuulijalle hyödyllinen.",
          resourcesTitle: "Vihjeet",
          signalsTitle: "Pääkohdat"
        }),
        withVisiblePlanFields({
          keyPoints: [
            { body: "Rakenne kuljettaa kuulijaa alusta päätökseen.", title: "Rakenne" },
            { body: "Jokainen dia vastaa yhteen kysymykseen.", title: "Kysymys" },
            { body: "Turha yksityiskohta jää puhujan muistiinpanoihin.", title: "Rajaus" },
            { body: "Kuva tukee sanomaa eikä täytä tilaa.", title: "Kuva" }
          ],
          role: "concept",
          summary: "Näytä miten rakenne pitää viestin koossa.",
          title: "Rakenna selkeä polku"
        }, {
          eyebrow: "Periaate",
          guardrails: [
            { body: "Pidä jokaisella dialla vain yksi tehtävä.", title: "Yksi tehtävä" },
            { body: "Siirrä lisätiedot puheeseen tai lähteisiin.", title: "Rajaa" },
            { body: "Tarkista että otsikko kertoo asian.", title: "Otsikko" }
          ],
          guardrailsTitle: "Tarkistukset",
          resourcesTitle: "Vihjeet",
          signalsTitle: "Pääkohdat"
        }),
        withVisiblePlanFields({
          keyPoints: [
            { body: "Harjoittele ääneen ennen jakamista.", title: "Harjoittele" },
            { body: "Pyydä palautetta yhdestä epäselvästä kohdasta.", title: "Palaute" },
            { body: "Korjaa ensin viesti ja vasta sitten ulkoasu.", title: "Korjaa" },
            { body: "Tallenna valmis versio arkistoon.", title: "Arkistoi" }
          ],
          role: "handoff",
          summary: "Sulje esitys yhdellä seuraavalla toimella.",
          title: "Seuraava askel"
        }, {
          eyebrow: "Lopetus",
          resources: [
            { body: "Tee yksi harjoituskierros ennen julkaisua.", title: "Harjoitus" },
            { body: "Kerää palaute seuraavaa versiota varten.", title: "Palaute" }
          ],
          resourcesTitle: "Seuraavaksi",
          signalsTitle: "Pääkohdat"
        })
      ],
      summary: "Suomenkielinen suunnitelma"
    });
  };

  try {
    const generated = await generateInitialPresentation({
      audience: "suomenkieliset esiintyjät",
      generationMode: "llm",
      includeActiveSources: false,
      objective: "Näytä miten hyvä esitys rakennetaan.",
      targetSlideCount: 3,
      title: "Hyvä esitys"
    });
    const visibleText = generated.slideSpecs.flatMap((slideSpec) => [
      slideSpec.eyebrow,
      slideSpec.note,
      slideSpec.signalsTitle,
      slideSpec.guardrailsTitle,
      slideSpec.resourcesTitle,
      ...(slideSpec.guardrails || []).flatMap((item) => [item.title, item.body]),
      ...(slideSpec.resources || []).flatMap((item) => [item.title, item.body])
    ].filter(Boolean));

    assert.equal(requestCount, 2, "non-English plans should use deck planning and slide drafting without repair");
    assert.ok(visibleText.some((value) => value === "Pääkohdat"), "LLM-supplied labels should reach slides");
    assert.ok(
      !visibleText.some((value) => /Opening|Close|Key points|Useful cues|Drafted|Checks|Reference lead/i.test(String(value))),
      "LLM generation should not inject fixed English visible labels into non-English decks"
    );
  } finally {
    global.fetch = originalFetch;
    llmEnvKeys.forEach((key) => {
      if (originalLlmEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalLlmEnv[key];
      }
    });
  }
});

test("materials accept only bounded image data and keep paths presentation-scoped", () => {
  const presentation = createCoveragePresentation("materials");
  const material = createMaterialFromDataUrl({
    alt: "Coverage material",
    caption: "Source: coverage fixture",
    dataUrl: tinyPngDataUrl,
    fileName: "coverage fixture.png"
  });

  assert.equal(getMaterial(material.id).id, material.id, "created material should be retrievable");
  assert.ok(
    listMaterials().some((entry) => entry.url.includes(`/presentation-materials/${presentation.id}/`)),
    "material URLs should be scoped to the active presentation"
  );
  assert.ok(
    getMaterialFilePath(presentation.id, material.fileName).startsWith(getPresentationPaths(presentation.id).materialsDir),
    "material file path should resolve inside the presentation material directory"
  );

  assert.throws(
    () => createMaterialFromDataUrl({ dataUrl: "data:text/plain;base64,SGVsbG8=" }),
    /PNG, JPEG, GIF, or WebP/,
    "non-image material uploads should be rejected"
  );
  assert.throws(
    () => getMaterialFilePath(presentation.id, "../escape.png"),
    /Invalid material filename/,
    "material file lookup should reject traversal filenames"
  );
});

test("presentation generation can attach semantically matching image materials", async () => {
  createCoveragePresentation("material-generation");
  const material = createMaterialFromDataUrl({
    alt: "HTMX request flow diagram",
    caption: "Request flow diagram",
    dataUrl: tinyPngDataUrl,
    fileName: "htmx-request-flow.png",
    title: "HTMX request flow"
  });

  llmEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  process.env.STUDIO_LLM_PROVIDER = "lmstudio";
  process.env.LMSTUDIO_MODEL = "semantic-coverage-model";
  let materialGenerationRequestCount = 0;
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    const requestBody = JSON.parse(init.body);
    const schemaName = requestBody.response_format.json_schema.name;
    if (schemaName === "initial_presentation_deck_plan") {
      return createLmStudioStreamResponse(createGeneratedDeckPlan("HTMX request flow", 4));
    }

    assert.equal(schemaName, "initial_presentation_plan");
    materialGenerationRequestCount += 1;
    return createLmStudioStreamResponse(createGeneratedPlan("HTMX request flow", 4, {
      mediaMaterialId: materialGenerationRequestCount === 1 ? material.id : "",
      mediaSlideIndex: 1
    }));
  };

  const generated = await generateInitialPresentation({
    includeActiveSources: false,
    objective: "Explain the HTMX request flow.",
    targetSlideCount: 4,
    title: "HTMX request flow"
  });
  const attachedMedia = generated.slideSpecs.map((slideSpec) => slideSpec.media).filter(Boolean);

  assert.ok(attachedMedia.some((media) => media.id === material.id), "generation should attach a semantically matching material");
  assert.ok(attachedMedia.some((media) => /Request flow diagram/.test(media.caption || "")), "attached material should carry a caption/source line");
  assert.equal(generated.retrieval.materials[0].id, material.id, "generation diagnostics should report available material metadata");

  const attributedSlides = materializePlan({
    materialCandidates: [{
      alt: "Coverage beer",
      caption: "Creator: Coverage | License: cc0 | https://example.com/beer",
      creator: "Coverage",
      id: material.id,
      license: "cc0",
      sourceUrl: "https://example.com/beer",
      title: "Coverage beer",
      url: material.url
    }],
    title: "Coverage beer"
  }, {
    outline: "Coverage beer",
    references: [],
    slides: [
      withVisiblePlanFields({
        keyPoints: [
          { body: "Show the beer image with one clean attribution line.", title: "Image" },
          { body: "Keep the source close to the visual.", title: "Source" },
          { body: "Avoid repeating creator and license metadata.", title: "Credit" },
          { body: "Use a readable caption.", title: "Caption" }
        ],
        mediaMaterialId: material.id,
        role: "opening",
        summary: "Show sourced image metadata.",
        title: "Coverage beer"
      }, {
        eyebrow: "Opening",
        note: "Show the image attribution once.",
        resourcesTitle: "Resources",
        signalsTitle: "Image points"
      })
    ],
    summary: "Coverage attribution"
  });
  const caption = attributedSlides[0].media.caption;
  assert.equal((caption.match(/Creator:/g) || []).length, 1, "media captions should not repeat creator attribution");
  assert.equal((caption.match(/License:/g) || []).length, 1, "media captions should not repeat license attribution");
  assert.equal((caption.match(/https:\/\/example.com\/beer/g) || []).length, 1, "media captions should not repeat source URLs");

  const withoutMaterials = await generateInitialPresentation({
    includeActiveMaterials: false,
    includeActiveSources: false,
    objective: "Explain the HTMX request flow.",
    targetSlideCount: 4,
    title: "HTMX request flow"
  });
  assert.equal(withoutMaterials.slideSpecs.some((slideSpec) => slideSpec.media), false, "generation can opt out of active material attachments");

  global.fetch = originalFetch;
  llmEnvKeys.forEach((key) => {
    if (originalLlmEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLlmEnv[key];
    }
  });
});

test("image search imports bounded remote results as presentation materials", async () => {
  createCoveragePresentation("image-search");
  const originalFetchForTest = global.fetch;
  const imageBuffer = Buffer.from(tinyPngDataUrl.split(",")[1], "base64");
  const requestedUrls = [];

  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes("api.openverse.org")) {
      return new Response(JSON.stringify({
        results: [
          {
            creator: "Coverage",
            foreign_landing_url: "https://example.com/flow",
            license: "cc0",
            title: "HTMX request flow",
            url: "https://images.example.com/flow.png"
          }
        ]
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      });
    }

    return new Response(imageBuffer, {
      headers: {
        "Content-Length": String(imageBuffer.length),
        "Content-Type": "image/png"
      },
      status: 200
    });
  };

  try {
    const result = await importImageSearchResults({
      provider: "openverse",
      query: "HTMX request flow",
      restrictions: "license:cc0 source:flickr"
    });

    assert.equal(result.provider, "openverse", "image search should use the requested provider preset");
    assert.equal(result.imported.length, 1, "image search should import fetchable remote images");
    const importedMaterial = listMaterials()[0];
    assert.equal(importedMaterial.id, result.imported[0].id, "imported images should become presentation materials");
    assert.equal(importedMaterial.creator, "Coverage", "imported images should retain creator attribution");
    assert.equal(importedMaterial.license, "cc0", "imported images should retain license attribution");
    assert.equal(importedMaterial.sourceUrl, "https://example.com/flow", "imported images should retain source URL attribution");
    assert.ok(requestedUrls[0].includes("license_type=cc0"), "Openverse restrictions should map to license filters");
    assert.ok(requestedUrls[0].includes("source=flickr"), "Openverse restrictions should map to source filters");
  } finally {
    global.fetch = originalFetchForTest;
  }
});

test("structured variants validate source before capture and apply only known variants", () => {
  createCoveragePresentation("variants");
  const currentSpec = readSlideSpec("slide-01");
  const variantSpec = {
    ...currentSpec,
    title: "Applied coverage variant"
  };

  const variant = captureVariant({
    id: "coverage-variant",
    label: "Coverage variant",
    slideId: "slide-01",
    slideSpec: variantSpec
  });

  assert.equal(variant.source.trim(), `${JSON.stringify(variantSpec, null, 2)}`.trim(), "structured variants should serialize from validated specs");
  assert.equal(listVariantsForSlide("slide-01")[0].id, "coverage-variant", "captured variant should be listed for the slide");

  const updatedVariant = updateVariant(variant.id, {
    notes: "Updated by coverage",
    slideSpec: {
      ...variantSpec,
      title: "Updated coverage variant"
    }
  });
  assert.equal(updatedVariant.notes, "Updated by coverage", "variant updates should persist editable metadata");
  assert.equal(updatedVariant.slideSpec.title, "Updated coverage variant", "variant updates should revalidate structured specs");
  assert.equal(getVariantStorageStatus().legacyUnstructured, 1, "variant storage status should reflect stored variants");

  applyVariant(variant.id);
  assert.equal(readSlideSpec("slide-01").title, "Updated coverage variant", "applying a variant should update the slide spec");

  assert.throws(
    () => captureVariant({ slideId: "slide-01", source: "{not-json" }),
    /invalid JSON/,
    "structured variant capture should reject malformed JSON"
  );
  assert.throws(
    () => applyVariant("missing-variant"),
    /Unknown variant/,
    "applying an unknown variant should fail explicitly"
  );
  assert.throws(
    () => updateVariant("missing-variant", { notes: "nope" }),
    /Unknown variant/,
    "updating an unknown variant should fail explicitly"
  );
});

test("write boundary blocks paths outside presentation, state, slides, and output roots", () => {
  const presentation = createCoveragePresentation("write-boundary");
  const paths = getPresentationPaths(presentation.id);
  const allowedStateFile = path.join(paths.stateDir, "deck-context.json");
  const allowedSourcesFile = path.join(paths.stateDir, "sources.json");

  assert.equal(assertAllowedWriteTarget(allowedStateFile), path.resolve(allowedStateFile));
  writeAllowedJson(allowedStateFile, readSlideSpec("slide-01") ? { deck: { title: presentation.title }, slides: {} } : {});
  assert.equal(assertAllowedWriteTarget(allowedSourcesFile), path.resolve(allowedSourcesFile));

  const allowedMaterialFile = path.join(paths.materialsDir, "coverage-boundary.bin");
  const copiedMaterialFile = path.join(paths.materialsDir, "coverage-boundary-copy.bin");
  writeAllowedBinary(allowedMaterialFile, Buffer.from("coverage"));
  copyAllowedFile(allowedMaterialFile, copiedMaterialFile);
  assert.equal(fs.readFileSync(copiedMaterialFile, "utf8"), "coverage", "copy should work inside allowed material roots");
  removeAllowedPath(copiedMaterialFile, { force: true });
  assert.equal(fs.existsSync(copiedMaterialFile), false, "remove should work inside allowed material roots");

  const slideOutputFile = path.join(process.cwd(), "slides", "output", "coverage-boundary.bin");
  writeAllowedBinary(slideOutputFile, Buffer.from("coverage-output"));
  assert.equal(fs.readFileSync(slideOutputFile, "utf8"), "coverage-output", "writes should work inside configured slide output roots");
  removeAllowedPath(slideOutputFile, { force: true });

  assert.throws(
    () => assertAllowedWriteTarget(path.join(process.cwd(), "package.json")),
    /outside the studio write boundary/,
    "write boundary should reject repo files outside allowed roots"
  );
  assert.throws(
    () => ensureAllowedDir(path.join(process.cwd(), "..", "slideotter-outside")),
    /outside the studio write boundary/,
    "directory creation should be blocked outside allowed roots"
  );
});
