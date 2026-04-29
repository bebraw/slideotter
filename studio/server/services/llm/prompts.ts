function safeJson(value) {
  return JSON.stringify(value);
}

function compactText(value, limit = 280) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}...` : normalized;
}

function projectDeckContext(context) {
  const deck = context && context.deck ? context.deck : {};
  return {
    audience: compactText(deck.audience, 180),
    constraints: compactText(deck.constraints, 260),
    objective: compactText(deck.objective, 220),
    tone: compactText(deck.tone, 120),
    title: compactText(deck.title, 160)
  };
}

function projectSlideContext(context, slideId) {
  const slideContext = context && context.slides && context.slides[slideId] ? context.slides[slideId] : {};
  return {
    intent: compactText(slideContext.intent, 220),
    layoutHint: compactText(slideContext.layoutHint, 180),
    mustInclude: compactText(slideContext.mustInclude, 260),
    notes: compactText(slideContext.notes, 220),
    title: compactText(slideContext.title, 160)
  };
}

function buildSlideTypeGuidance(slideType) {
  switch (slideType) {
    case "divider":
      return [
        "The slide family is divider.",
        "Return the requested number of variants and keep the divider structure intact.",
        "Each slideSpec must include: title."
      ].join("\n");
    case "quote":
      return [
        "The slide family is quote.",
        "Return the requested number of variants and keep one dominant quote as the visible content.",
        "Each slideSpec must include: title and quote. Attribution, source, and context are optional, but sourced quotes should keep attribution/source compact."
      ].join("\n");
    case "photo":
      return [
        "The slide family is photo.",
        "Return the requested number of variants and keep one dominant image as the visible content.",
        "Each slideSpec must include: title. Preserve the existing media object unless the current slide spec already includes a safe replacement media object. Caption is optional and should stay compact."
      ].join("\n");
    case "photoGrid":
      return [
        "The slide family is photoGrid.",
        "Return the requested number of variants and keep two to four images as the visible content.",
        "Each slideSpec must include: title and mediaItems. Preserve existing mediaItems unless the current slide spec already includes safe replacement mediaItems. Caption or summary is optional and should stay compact."
      ].join("\n");
    case "cover":
      return [
        "The slide family is cover.",
        "Return the requested number of variants and keep the cover structure intact.",
        "Each slideSpec must include: title, eyebrow, summary, note, and exactly three cards."
      ].join("\n");
    case "toc":
      return [
        "The slide family is toc.",
        "Return the requested number of variants and preserve the outline-slide structure.",
        "Each slideSpec must include: title, eyebrow, summary, note, and exactly three cards."
      ].join("\n");
    case "content":
      return [
        "The slide family is content.",
        "Return the requested number of variants and preserve the two-column evidence structure.",
        "Each slideSpec must include: title, eyebrow, summary, signalsTitle, guardrailsTitle, exactly four signals with title/body, and exactly three guardrails with title/body."
      ].join("\n");
    case "summary":
      return [
        "The slide family is summary.",
        "Return the requested number of variants and preserve the checklist-plus-resources structure.",
        "Each slideSpec must include: title, eyebrow, summary, resourcesTitle, exactly three bullets, and exactly two resources."
      ].join("\n");
    default:
      return `The slide family is ${slideType}. Preserve the current slide family structure.`;
  }
}

function buildIdeateSlidePrompts(options) {
  const developerPrompt = [
    "You are generating presentation slide variants for a local studio workflow.",
    "Return structured data only and stay within the provided schema.",
    "Do not emit JavaScript, markdown fences, or explanatory prose outside the schema.",
    "Keep the slide concise, presentation-scaled, and compatible with the existing slide family.",
    "Favor materially different framings rather than cosmetic rewrites.",
    "Keep labels and review notes short; local code will synthesize comparison detail from the returned slide spec.",
    buildSlideTypeGuidance(options.slideType)
  ].join("\n\n");

  const userPrompt = [
    `Generate ${options.candidateCount} slide variants from the current presentation context.`,
    "",
    `Slide id: ${options.slide.id}`,
    `Slide title: ${options.slide.title}`,
    `Slide type: ${options.slideType}`,
    "",
    "Deck context:",
    safeJson(projectDeckContext(options.context)),
    "",
    "Selected slide context:",
    safeJson(projectSlideContext(options.context, options.slide.id)),
    "",
    "Current slide spec:",
    options.source,
    "",
    `Produce ${options.candidateCount} variants that keep the slide family structure intact, differ meaningfully in framing, and stay readable at presentation scale.`
  ].join("\n");

  return {
    developerPrompt,
    userPrompt
  };
}

function buildRedoLayoutPrompts(options) {
  const familyGuidance = options.slideType === "photoGrid"
    ? "Current slide is photoGrid: set targetFamily to photoGrid for every candidate. Propose arrangement intents such as lead image, comparison grid, or evidence grid."
    : options.slideType === "photo" || options.slideType === "content"
      ? "When the slide has mediaItems or media, consider photo or photoGrid if the visual evidence should lead."
      : "Prefer family changes only when they make the slide clearer than a same-family layout change.";
  const familyChangeGuidance = options.slideType === "photoGrid"
    ? "Do not convert photoGrid slides to photo, content, summary, divider, quote, cover, or toc during Redo Layout; keep the slide family and vary the arrangement intent."
    : "Prefer a family-changing candidate when it improves the slide: text-heavy claims can become quote slides, image-backed slides can become photo or photoGrid slides, and section markers can become divider slides.";
  const developerPrompt = [
    "You are selecting presentation slide layout transformation intent for a local studio workflow.",
    "Return structured data only and stay within the provided schema.",
    "Do not emit JavaScript, markdown fences, or explanatory prose outside the schema.",
    "Do not write slideSpec JSON. Local code will build and validate the actual slide candidate.",
    "Prefer a family change when the target family better fits the available content or media.",
    "Keep labels, emphasis, and rationale short; local code will synthesize the review summary.",
    "Keep intent concise, presentation-scaled, and compatible with the allowed structured slide families."
  ].join("\n\n");

  const userPrompt = [
    `Choose ${options.candidateCount} redo-layout transformation intents from the current presentation context.`,
    "",
    `Slide id: ${options.slide.id}`,
    `Slide title: ${options.slide.title}`,
    `Current slide type: ${options.slideType}`,
    "",
    "Deck context:",
    safeJson(projectDeckContext(options.context)),
    "",
    "Selected slide context:",
    safeJson(projectSlideContext(options.context, options.slide.id)),
    "",
    "Current slide spec:",
    options.source,
    "",
    "Allowed slide families: divider, quote, photo, photoGrid, cover, toc, content, summary.",
    familyChangeGuidance,
    familyGuidance,
    "For each candidate, state targetFamily, droppedFields, preservedFields, emphasis, and rationale. Do not return a slideSpec."
  ].join("\n");

  return {
    developerPrompt,
    userPrompt
  };
}

function buildDrillWordingPrompts(options) {
  const selectionLines = options.selectionScope
    ? [
        "",
        "Selection scope:",
        safeJson(options.selectionScope),
        "",
        "Selection-scoped rule: rewrite only the selected owning field or fields. Preserve every non-selected slide field exactly."
      ]
    : [];
  const developerPrompt = [
    "You are tightening presentation slide wording for a local studio workflow.",
    "Return structured data only and stay within the provided schema.",
    "Do not emit JavaScript, markdown fences, or explanatory prose outside the schema.",
    "Keep the current slide family and field structure intact.",
    "Rewrite visible text only where it improves clarity, concision, or presentation-scale reading.",
    options.selectionScope ? "When selection scope is provided, treat it as the only editable scope and keep all other fields byte-for-byte equivalent in meaning and structure." : "",
    "Do not add unsupported claims, new facts, or fixed English labels.",
    "Keep labels and review notes short; local code will synthesize comparison detail from the returned slide spec.",
    "Preserve the requested deck language and the user's terminology.",
    buildSlideTypeGuidance(options.slideType)
  ].filter(Boolean).join("\n\n");

  const userPrompt = [
    `Generate ${options.candidateCount} wording variants from the current presentation context.`,
    "",
    `Slide id: ${options.slide.id}`,
    `Slide title: ${options.slide.title}`,
    `Slide type: ${options.slideType}`,
    "",
    "Deck context:",
    safeJson(projectDeckContext(options.context)),
    "",
    "Selected slide context:",
    safeJson(projectSlideContext(options.context, options.slide.id)),
    "",
    "Current slide spec:",
    options.source,
    ...selectionLines,
    "",
    "Produce wording-only variants. Keep IDs, media attachments, slide family, and structural array sizes intact. Make the copy shorter, clearer, and more defensible at slide scale."
  ].join("\n");

  return {
    developerPrompt,
    userPrompt
  };
}

module.exports = {
  buildDrillWordingPrompts,
  buildIdeateSlidePrompts,
  buildRedoLayoutPrompts
};
