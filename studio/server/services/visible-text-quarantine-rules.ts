import {
  hasDanglingEnding,
  isAuthoringMetaText,
  isScaffoldLeak,
  isWeakLabel,
  normalizeVisibleText
} from "./generated-text-hygiene.ts";

const semanticLengthLeakPatterns = [
  /\bcurrent deck\b/,
  /\btarget count\b/,
  /\bactive deck length\b/,
  /\bsemantic depth\b/,
  /\bsemantic length planning\b/,
  /\bdeck had room to expand\b/,
  /\binstead of stretching\b/,
  /\bwithout changing the deck\b/,
  /\bnot filler\b/,
  /\bexpansion rules\b/,
  /\bsection gets\b/,
  /\bgets one concrete example\b/,
  /\bdetail names what changes\b/,
  /\bpoint connects\b/,
  /\bconnects to the next slide\b/,
  /\bmoving forward\b/,
  /\bbefore the story moves on\b/
];

const promptLeakPatterns = [
  /\b(?:system|developer|user|assistant)\s+(?:prompt|message|instruction|instructions)\b/,
  /\b(?:developerprompt|systemprompt|userprompt|promptcontext|schemaname|response_format|json schema)\b/,
  /\b(?:as an ai|you are chatgpt|you are an ai|large language model)\b/,
  /\b(?:return|respond|output)\s+(?:only\s+)?(?:valid\s+)?json\b/,
  /\b(?:use|follow|obey)\s+(?:the\s+)?(?:schema|developer instructions|system instructions)\b/,
  /\b(?:do not|don't)\s+(?:mention|reveal|include|expose|show)\s+(?:the\s+)?(?:prompt|instructions|system message|developer message)\b/,
  /\b(?:internal|hidden)\s+(?:prompt|instruction|instructions|context|message|messages)\b/,
  /\b(?:järjestelmä|kehittäjä|käyttäjä|avustaja|assistentti)\s*(?:kehote|viesti|ohje|ohjeet|instruktio|instruktiot)\b/,
  /\b(?:sisäinen|piilotettu)\s*(?:kehote|ohje|ohjeet|konteksti|viesti|viestit)\b/,
  /\b(?:skeema|json-skeema|json schema)\b/,
  /\b(?:palauta|vastaa|tulosta)\s+(?:vain\s+)?(?:kelvollinen\s+)?json\b/,
  /\b(?:system|utvecklar|användar|assistent)\s*(?:prompt|meddelande|instruktion|instruktioner)\b/,
  /\b(?:promptmeddelande|systemmeddelande|utvecklarmeddelande|instruktionsmeddelande)\b/,
  /\b(?:internt|dolt)\s*(?:prompt|instruktion|instruktioner|kontext|meddelande|meddelanden)\b/,
  /\b(?:returnera|svara|mata ut)\s+(?:endast\s+)?(?:giltig\s+)?json\b/
];

const copiedInstructionPatterns = [
  /<\s*script\b/,
  /```/,
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/,
  /\boverride\s+(?:the\s+)?(?:system|developer|schema)\b/,
  /\bdo\s+not\s+follow\s+(?:the\s+)?(?:system|developer|schema)\b/,
  /\b(?:follow|execute|run)\s+(?:these|the following)\s+instructions\b/,
  /\bohita\s+(?:kaikki\s+)?(?:aiemmat|edelliset|yllä\s+olevat)\s+ohjeet\b/,
  /\bälä\s+noudata\s+(?:järjestelmän|kehittäjän|skeeman)\b/,
  /\bignorera\s+(?:alla\s+)?(?:tidigare|ovanstående)\s+instruktioner\b/,
  /\bfölj\s+inte\s+(?:systemet|utvecklaren|schemat)\b/
];

function comparableText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSemanticLengthLeak(value: unknown): boolean {
  const text = normalizeVisibleText(value);
  const normalized = comparableText(text);
  if (!text || isWeakLabel(text) || isScaffoldLeak(text) || isAuthoringMetaText(text) || hasDanglingEnding(text)) {
    return true;
  }

  return semanticLengthLeakPatterns.some((pattern) => pattern.test(normalized));
}

export function isPromptLeakText(value: unknown): boolean {
  const text = normalizeVisibleText(value);
  if (!text) {
    return false;
  }

  return promptLeakPatterns.some((pattern) => pattern.test(text.toLowerCase()));
}

export function isCopiedInstructionLikeText(value: unknown): boolean {
  const text = normalizeVisibleText(value);
  if (!text) {
    return false;
  }

  return copiedInstructionPatterns.some((pattern) => pattern.test(text.toLowerCase()));
}

export function isSemanticLengthPlanningText(value: unknown): boolean {
  return semanticLengthLeakPatterns.some((pattern) => pattern.test(comparableText(value)));
}
