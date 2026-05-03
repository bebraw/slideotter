import type { JsonObject } from "./generated-slide-types.ts";

export type RetrievalSnippet = JsonObject & {
  chunkIndex?: unknown;
  sourceId?: unknown;
  text?: unknown;
  title?: unknown;
  url?: unknown;
};

export type SourceBudget = JsonObject & {
  maxPromptChars?: unknown;
  maxSnippetChars?: unknown;
  omittedSnippetCount?: unknown;
  promptCharCount?: unknown;
  retrievedSnippetCount?: unknown;
  snippetLimit?: unknown;
  truncatedSnippetCount?: unknown;
  usedSnippetCount?: unknown;
};

export type SourceContextWithBudget = {
  budget?: SourceBudget;
  snippets?: RetrievalSnippet[];
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isRetrievalSnippet(value: unknown): value is RetrievalSnippet {
  return isJsonObject(value);
}

export function serializeRetrievalSnippet(snippet: RetrievalSnippet): RetrievalSnippet {
  return {
    chunkIndex: snippet.chunkIndex,
    sourceId: snippet.sourceId,
    text: snippet.text,
    title: snippet.title,
    url: snippet.url
  };
}

export function dedupeRetrievalSnippets(snippets: unknown): RetrievalSnippet[] {
  const seen = new Set<string>();
  const results: RetrievalSnippet[] = [];
  (Array.isArray(snippets) ? snippets.filter(isRetrievalSnippet) : []).forEach((snippet: RetrievalSnippet) => {
    const key = [snippet.sourceId || snippet.title || "", snippet.chunkIndex, snippet.text].join(":");
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    results.push(snippet);
  });
  return results;
}

export function summarizeCombinedSourceBudget(contexts: SourceContextWithBudget[]): JsonObject | null {
  const budgets = contexts.map((context: SourceContextWithBudget) => context && context.budget).filter(isJsonObject);
  if (!budgets.length) {
    return null;
  }

  return {
    maxPromptChars: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.maxPromptChars || 0), 0),
    maxSnippetChars: Math.max(...budgets.map((budget: JsonObject) => Number(budget.maxSnippetChars || 0))),
    omittedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.omittedSnippetCount || 0), 0),
    promptCharCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.promptCharCount || 0), 0),
    retrievedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.retrievedSnippetCount || 0), 0),
    snippetLimit: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.snippetLimit || 0), 0),
    sourceCount: new Set(contexts.flatMap((context: SourceContextWithBudget) => (context.snippets || []).map((snippet: RetrievalSnippet) => snippet.sourceId || snippet.title || snippet.url || "").filter(Boolean))).size,
    truncatedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.truncatedSnippetCount || 0), 0),
    usedSnippetCount: budgets.reduce((total: number, budget: JsonObject) => total + Number(budget.usedSnippetCount || 0), 0)
  };
}
