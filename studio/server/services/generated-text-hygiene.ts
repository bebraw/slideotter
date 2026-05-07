const danglingTailWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "through",
  "to",
  "when",
  "where",
  "while",
  "with",
  "within",
  "without"
]);
const danglingFinnishTailWords = new Set([
  "ja",
  "sekä",
  "tai"
]);
const danglingConjunctionTailWords = new Set([
  "open"
]);

function normalizedTailWord(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
}

function hasDanglingConjunctionTail(words: string[]): boolean {
  if (words.length < 2) {
    return false;
  }

  const tail = normalizedTailWord(words[words.length - 1]);
  const previous = normalizedTailWord(words[words.length - 2]);
  return danglingConjunctionTailWords.has(tail) && (previous === "and" || previous === "or");
}

export function normalizeVisibleText(value: unknown): string {
  return String(value || "")
    .replace(/…/g, "")
    .replace(/\.{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleContentWords(value: unknown): string[] {
  return normalizeVisibleText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function areNearDuplicateVisibleText(left: unknown, right: unknown): boolean {
  const leftWords = Array.from(new Set(visibleContentWords(left)));
  const rightWords = Array.from(new Set(visibleContentWords(right)));
  if (leftWords.length < 5 || rightWords.length < 5) {
    return normalizeVisibleText(left).toLowerCase() === normalizeVisibleText(right).toLowerCase();
  }

  const rightWordSet = new Set(rightWords);
  const shared = leftWords.filter((word) => rightWordSet.has(word)).length;
  const overlap = shared / Math.min(leftWords.length, rightWords.length);

  return shared >= 5 && overlap >= 0.75;
}

export function trimWords(value: unknown, limit = 12): string {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  const trimmed = words.slice(0, limit);
  while (trimmed.length > 4) {
    const tail = normalizedTailWord(trimmed[trimmed.length - 1]);
    if (!danglingTailWords.has(tail) && !hasDanglingConjunctionTail(trimmed)) {
      break;
    }

    trimmed.pop();
  }

  return trimmed.join(" ").replace(/[,:;]$/g, "");
}

export function sentence(value: unknown, fallback: unknown, limit = 14): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return trimWords(normalized || fallback, limit);
}

export function isWeakLabel(value: unknown): boolean {
  return /^(summary|title:?|key point|point|item|slide|section|role|body|slide value|n\/a|none)$/i.test(String(value || "").trim());
}

export function isScaffoldLeak(value: unknown): boolean {
  const text = String(value || "").trim();
  return /^(guardrails|key points|sources to verify)$/i.test(text)
    || /^keep the slide focused on one useful idea\.?$/i.test(text)
    || /^make the claim concrete enough to discuss\.?$/i.test(text)
    || /^avoid adding unsupported details\.?$/i.test(text)
    || /\baudience (?:understands?|learns?|knows?|can|will)\b/i.test(text)
    || /\bknows what to expect\b/i.test(text)
    || /\bthis (?:session|presentation|slide|deck) (?:introduces|explains|shows|covers)\b/i.test(text)
    || /\buse a\b.*\b(?:background|branding|design|layout|visual|image)\b/i.test(text)
    || /\b(?:clean|simple|high-contrast)\b.*\b(?:background|branding|design|layout)\b/i.test(text)
    || /\b(?:learn|expect) (?:core strengths|clear explanations)\b/i.test(text)
    || /\bcontact page\b.*\b(?:direct inquiries|support requests)\b/i.test(text)
    || /\bdirect inquiries and support requests\b/i.test(text)
    || /^(?:opening|cover|title|closing|summary|content|divider|reference|photo|image)(?:\s+\w+){0,3}\s+slide with\b/i.test(text)
    || /\bcover design\b.*\bbranding\b/i.test(text)
    || /\bdesign\b.*\bwithout clutter\b/i.test(text)
    || /\byou now understand the purpose of this presentation\b/i.test(text)
    || /\bthis slide serves as\b.*\b(?:opening frame|closing handoff|section divider|reference slide)\b/i.test(text)
    || /^opening frame for (?:the|this) presentation\.?$/i.test(text)
    || /\bofficial website for further information\b/i.test(text)
    || /\bofficial\b.*\b(?:page|website)\b.*\b(?:details|information|further information)\b/i.test(text)
    || /\byou know exactly how to\b/i.test(text)
    || /refine constraints before expanding the deck/i.test(text)
    || /\buse this slide as (?:the )?(?:opening frame|closing handoff|section divider|reference slide)\b/i.test(text)
    || /\bfor the presentation sequence\b/i.test(text)
    || /\bkeeps grounded in\b/i.test(text);
}

export function isAuthoringMetaText(value: unknown): boolean {
  const text = normalizeVisibleText(value).toLowerCase();
  if (!text) {
    return false;
  }

  const exactMetaLabels = new Set([
    "accessibility check",
    "accessible language",
    "accurate faculty representation",
    "accuracy check",
    "content guardrails",
    "campus description",
    "clarity check",
    "date accuracy",
    "evidence grounding",
    "facility accuracy",
    "faculty focus",
    "focus on core identity",
    "group schools by discipline",
    "highlight inclusivity",
    "historical accuracy",
    "historical context",
    "imagery choice",
    "quote integration",
    "scope clarity",
    "scope control",
    "slide signals",
    "source verification",
    "specificity requirement",
    "tone consistency",
    "visual accessibility",
    "visual focus",
    "visual clarity"
  ]);

  if (exactMetaLabels.has(text)) {
    return true;
  }

  return [
    /\bensure all\b.*\bsupported by\b/,
    /\bensure all claims\b.*\b(?:accurate|grounded)\b/,
    /\bensure\b.*\bmatches?\b.*\bofficial\b/,
    /\buse general knowledge\b/,
    /\breference\b.*\b(?:source\s+)?snippet\s+\[\d+\]/,
    /\breferencing (?:its|the|their)\b.*\b(?:source|focus|page|website)\b/,
    /\b(?:source\s+)?snippet\s+\[\d+\]/,
    /\bfrom source \[\d+\]\b/,
    /\bdo not list\b/,
    /\bensure visual treatment\b/,
    /\bensure\b.*\bvisual layout\b/,
    /\bensure\b.*\bpresented as\b/,
    /\buse clear visual treatment\b/,
    /\buse\b.*\bvisual treatment\b.*\b(?:maintain|readability|clarity)\b/,
    /\bkeep text concise\b.*\breadability\b/,
    /\bavoid\b.*\boverly technical\b.*\b(?:terms|language|jargon)\b/,
    /\bavoid\b.*\btechnical jargon\b/,
    /\bavoid implying\b/,
    /\bavoid listing\b.*\bunless requested\b/,
    /\bavoid listing specific\b.*\bnames\b/,
    /\bavoid generic descriptions\b/,
    /\bclaims?\b.*\b(?:must|should)\b.*\balign with\b.*\bofficial\b/,
    /\bkeep\b.*\bclaims?\b.*\btied to\b.*\bofficial\b/,
    /\bdo not invent\b/,
    /\bdo not imply\b.*\bnew startup\b/,
    /\bdo not mention specific\b.*\bdates?\b/,
    /\bkeep descriptions\b.*\bavoid dating\b/,
    /\bkeep descriptions\b.*\bavoid listing\b/,
    /\bdo not use\b.*\bjargon\b/,
    /\bensure\b.*\bhistorical\b.*\baccurate\b/,
    /\bkeep visual descriptions\b.*\bfocused\b/,
    /\bconsider pairing\b.*\bquote\b/,
    /\bselect imagery\b.*\b(?:showing|that shows|with)\b/,
    /\bensure the tone remains\b/,
    /\bkeep language accessible\b/,
    /\bmaintain\b.*\btone\b.*\baudience\b/,
    /\bmaintain\b.*\bcontrast\b.*\b(?:icons|graphics|visuals)\b/
  ].some((pattern) => pattern.test(text));
}

export function isUnsupportedBibliographicClaim(value: unknown): boolean {
  return /\b(et al\.|journal|proceedings|doi:|isbn)\b/i.test(String(value || "")) && !/https?:\/\//.test(String(value || ""));
}

export function isKnownBadTranslation(value: unknown): boolean {
  return /\buloste(?:en|tta|et|iden|ista|isiin|e)?\b/i.test(String(value || ""));
}

export function repairKnownBadTranslations(value: unknown): string {
  return String(value || "")
    .replace(/\bulosteen\b/gi, "tuotoksen")
    .replace(/\bulostetta\b/gi, "tuotosta")
    .replace(/\bulosteet\b/gi, "tuotokset")
    .replace(/\bulosteiden\b/gi, "tuotosten")
    .replace(/\bulosteista\b/gi, "tuotoksista")
    .replace(/\bulosteisiin\b/gi, "tuotoksiin")
    .replace(/\buloste\b/gi, "tuotos");
}

export function hasDanglingEnding(value: unknown): boolean {
  const words = normalizeVisibleText(value).split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    return false;
  }

  const tail = String(words[words.length - 1] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
  const previous = String(words[words.length - 2] || "").toLowerCase().replace(/[^a-z0-9-]+$/g, "");
  return danglingTailWords.has(tail)
    || danglingFinnishTailWords.has(tail)
    || hasDanglingConjunctionTail(words)
    || /(?:'s|s')$/i.test(tail)
    || (tail === "lähteen" && danglingFinnishTailWords.has(previous));
}

export function cleanText(value: unknown): string {
  const normalized = normalizeVisibleText(value)
    .replace(/\b(title|summary|body):\s*$/i, "")
    .trim();

  return isUnsupportedBibliographicClaim(normalized) ? "" : normalized;
}

export function requireVisibleText(value: unknown, fieldName: string): string {
  const text = cleanText(value);
  if (text && !isWeakLabel(text)) {
    return text;
  }

  throw new Error(`Generated presentation plan is missing usable ${fieldName}.`);
}
