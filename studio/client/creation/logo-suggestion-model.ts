import type { DeckPlan, DeckPlanSlide } from "./editable-outline-model.ts";

export type LogoSearchSuggestion = {
  query: string;
  reason: string;
  slideIndex: number;
  slideTitle: string;
};

const connectorPattern = /\b(?:logo|brand mark|wordmark)\b/i;
const negativeLogoPattern = /\b(?:no|without|avoid)\s+(?:logo|brand mark|wordmark)s?\b/i;
const commandPrefixPattern = /^(?:add|find|include|show|use)\s+(?:the\s+)?/i;
const companyPattern = /\b((?:[A-Z][A-Za-z0-9.+-]{1,})(?:\s+[A-Z][A-Za-z0-9.+-]{1,}){0,2})\s+(?:logo|brand mark|wordmark)\b/g;
const quotedPattern = /["“”']([^"“”']{2,48})["“”']\s+(?:logo|brand mark|wordmark)\b/gi;
const logoOfPattern = /\b(?:logo|brand mark|wordmark)\s+(?:for|of)\s+(?:the\s+)?([A-Z][A-Za-z0-9.+-]{1,}(?:\s+[A-Z][A-Za-z0-9.+-]{1,}){0,2})\b/g;

function normalizeText(value: unknown, fallback = ""): string {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function normalizeQuery(value: unknown): string {
  return normalizeText(value)
    .replace(commandPrefixPattern, "")
    .replace(/\b(?:logo|brand mark|wordmark)\b/gi, "")
    .replace(/[^a-zA-Z0-9.+ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function collectMatches(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of [quotedPattern, logoOfPattern, companyPattern]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match) {
      const query = normalizeQuery(match[1]);
      if (query) {
        matches.push(query);
      }
      match = pattern.exec(text);
    }
  }
  return matches;
}

function firstTitleFallback(slide: DeckPlanSlide): string {
  const title = normalizeQuery(slide.title);
  return title && title.length <= 48 && !/^slide\s+\d+$/i.test(title) ? title : "";
}

export function deriveLogoSearchSuggestions(deckPlan: DeckPlan | null, limit = 6): LogoSearchSuggestion[] {
  const seen = new Set<string>();
  const suggestions: LogoSearchSuggestion[] = [];
  const slides = deckPlan?.slides || [];

  slides.forEach((slide: DeckPlanSlide, index: number) => {
    const fields = [
      slide.visualNeed,
      slide.title,
      slide.intent,
      slide.keyMessage
    ].map((field) => normalizeText(field)).filter(Boolean);
    const combined = fields.join(" ");
    if (!connectorPattern.test(combined) || negativeLogoPattern.test(combined)) {
      return;
    }

    const matches = collectMatches(combined);
    if (!matches.length) {
      const fallback = firstTitleFallback(slide);
      if (fallback) {
        matches.push(fallback);
      }
    }

    matches.forEach((query) => {
      const key = query.toLowerCase();
      if (seen.has(key) || suggestions.length >= limit) {
        return;
      }
      seen.add(key);
      suggestions.push({
        query,
        reason: normalizeText(slide.visualNeed || slide.keyMessage || slide.intent),
        slideIndex: index,
        slideTitle: normalizeText(slide.title, `Slide ${index + 1}`)
      });
    });
  });

  return suggestions;
}
