function safeJson(value) {
  return JSON.stringify(value, null, 2);
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
    safeJson(options.context.deck || {}),
    "",
    "Selected slide context:",
    safeJson((options.context.slides && options.context.slides[options.slide.id]) || {}),
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

module.exports = {
  buildIdeateSlidePrompts
};
