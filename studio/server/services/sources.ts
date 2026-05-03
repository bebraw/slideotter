import * as fs from "fs";
import {
  getActivePresentationPaths
} from "./presentations.ts";
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";

const maxSourceChars = 60000;
const maxFetchBytes = 256000;
const maxChunkChars = 900;
const maxPromptSourceChars = 3200;
const maxPromptSnippetChars = 550;
const maxPromptSnippets = 6;
const workflowSourceBudgets = {
  deckPlanning: {
    maxPromptChars: 3200,
    maxSnippetChars: 550,
    snippetLimit: 6
  },
  slideDrafting: {
    maxPromptChars: 1800,
    maxSnippetChars: 420,
    snippetLimit: 4
  },
  variant: {
    maxPromptChars: 900,
    maxSnippetChars: 320,
    snippetLimit: 2
  }
};
const acceptedFetchContentTypes = [
  "application/json",
  "application/xhtml+xml",
  "application/xml",
  "text/"
];
const stopWords = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "but",
  "can",
  "for",
  "from",
  "has",
  "have",
  "how",
  "into",
  "not",
  "that",
  "the",
  "their",
  "this",
  "what",
  "when",
  "where",
  "with",
  "your"
]);

type SourceRecord = {
  createdAt: string;
  id: string;
  text: string;
  title: string;
  url: string;
  wordCount: number;
};

type SourcesStore = {
  sources: SourceRecord[];
};

type SourceSummary = Omit<SourceRecord, "text"> & {
  chunkCount: number;
  preview: string;
};

type InlineSource = {
  id: string;
  text: string;
  title: string;
  url: string;
};

type QueryField = {
  value?: unknown;
  weight?: unknown;
};

type SourceSnippet = {
  chunkIndex: number;
  score: number;
  sourceId: string;
  text: string;
  title: string;
  url: string;
};

type SourceBudgetOptions = {
  maxPromptChars?: unknown;
  maxSnippetChars?: unknown;
  snippetLimit?: unknown;
  workflow?: unknown;
};

type SourceBudget = {
  maxPromptChars: number;
  maxSnippetChars: number;
  snippetLimit: number;
};

type SourceContextFields = SourceBudgetOptions & {
  audience?: unknown;
  constraints?: unknown;
  includeActiveSources?: unknown;
  objective?: unknown;
  outline?: unknown;
  presentationSources?: unknown;
  presentationSourceText?: unknown;
  query?: unknown;
  slideIntent?: unknown;
  slideKeyMessage?: unknown;
  slideSourceNotes?: unknown;
  slideTitle?: unknown;
  themeBrief?: unknown;
  title?: unknown;
};

type CreateSourceInput = {
  text?: unknown;
  title?: unknown;
  url?: unknown;
};

type WorkflowSourceBudgetKey = keyof typeof workflowSourceBudgets;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown) {
  writeAllowedJson(fileName, value);
}

function normalizeWhitespace(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSourceText(value: unknown): string {
  return normalizeWhitespace(value).slice(0, maxSourceChars);
}

function normalizeUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Source URL must use http or https");
    }

    return url.toString();
  } catch (error) {
    throw new Error(`Invalid source URL: ${raw}`);
  }
}

function assertFetchableUrl(urlString: string): string {
  const url = new URL(urlString);
  const hostname = url.hostname.toLowerCase();
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);

  if (
    hostname === "localhost"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
  ) {
    throw new Error("Source URL cannot point to a local host.");
  }

  if (ipv4) {
    const first = Number(ipv4[1]);
    const second = Number(ipv4[2]);
    if (
      first === 10
      || first === 127
      || first === 169 && second === 254
      || first === 172 && second >= 16 && second <= 31
      || first === 192 && second === 168
    ) {
      throw new Error("Source URL cannot point to a private network address.");
    }
  }

  return url.toString();
}

function stripHtml(value: unknown): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"");
}

function extractHtmlTitle(value: unknown): string {
  const match = String(value || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(stripHtml(match[1])) : "";
}

function normalizeSourcesStore(value: unknown): SourcesStore {
  const source = asRecord(value);
  const sources = Array.isArray(source.sources)
    ? source.sources
      .map(asRecord)
      .filter((item) => typeof item.id === "string")
      .map((item): SourceRecord => ({
        createdAt: normalizeWhitespace(item.createdAt),
        id: String(item.id),
        text: normalizeSourceText(item.text),
        title: normalizeWhitespace(item.title) || "Untitled source",
        url: normalizeWhitespace(item.url),
        wordCount: Number.isFinite(Number(item.wordCount)) ? Number(item.wordCount) : countWords(item.text)
      }))
    : [];

  return { sources };
}

function getSourcesStore(): SourcesStore {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.stateDir);

  if (!fs.existsSync(paths.sourcesFile)) {
    writeJson(paths.sourcesFile, { sources: [] });
  }

  return normalizeSourcesStore(readJson(paths.sourcesFile, { sources: [] }));
}

function saveSourcesStore(store: unknown): SourcesStore {
  const paths = getActivePresentationPaths();
  const normalized = normalizeSourcesStore(store);
  writeJson(paths.sourcesFile, normalized);
  return normalized;
}

function countWords(value: unknown): number {
  return String(value || "").split(/\s+/).filter(Boolean).length;
}

function chunkText(text: unknown): string[] {
  const paragraphs = String(text || "")
    .split(/\n{2,}|(?<=\.)\s+/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    if (!current) {
      current = paragraph;
      return;
    }

    if (`${current} ${paragraph}`.length <= maxChunkChars) {
      current = `${current} ${paragraph}`;
      return;
    }

    chunks.push(current);
    current = paragraph;
  });

  if (current) {
    chunks.push(current);
  }

  return chunks.length ? chunks : [normalizeWhitespace(text)].filter(Boolean);
}

function sourceSummary(source: SourceRecord): SourceSummary {
  const chunks = chunkText(source.text);
  return {
    chunkCount: chunks.length,
    createdAt: source.createdAt,
    id: source.id,
    preview: source.text.slice(0, 220),
    title: source.title,
    url: source.url,
    wordCount: countWords(source.text)
  };
}

function normalizeInlineSources(value: unknown): InlineSource[] {
  if (typeof value === "string") {
    return normalizeSourceText(value)
      ? [{
          id: "starter-source-1",
          text: normalizeSourceText(value),
          title: "Starter source",
          url: ""
        }]
      : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((source, index) => {
      const sourceRecord = asRecord(source);
      return {
        id: sourceRecord.id ? String(sourceRecord.id) : `starter-source-${index + 1}`,
        text: normalizeSourceText(sourceRecord.text),
        title: normalizeWhitespace(sourceRecord.title) || `Starter source ${index + 1}`,
        url: sourceRecord.url ? normalizeUrl(sourceRecord.url) : ""
      };
    })
    .filter((source): source is InlineSource => Boolean(source.text));
}

function listSources(options: { includeText?: unknown } = {}) {
  const sources = getSourcesStore().sources;
  return options.includeText === true
    ? sources.map((source) => ({
      ...source,
      chunkCount: chunkText(source.text).length,
      wordCount: countWords(source.text)
    }))
    : sources.map(sourceSummary);
}

function tokenize(value: unknown): string[] {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g)
    ?.filter((token) => !stopWords.has(token))
    .slice(0, 80) || [];
}

function buildTokenWeights(query: unknown, queryFields: QueryField[] = []): Map<string, number> {
  const weights = new Map<string, number>();
  const addTokens = (value: unknown, weight: number) => {
    tokenize(value).forEach((token) => {
      weights.set(token, (weights.get(token) || 0) + weight);
    });
  };

  addTokens(query, 1);
  queryFields.forEach((field) => {
    if (!field || !field.value) {
      return;
    }

    const weight = Number.isFinite(Number(field.weight)) ? Number(field.weight) : 1;
    addTokens(field.value, Math.max(0.25, weight));
  });

  return weights;
}

function countTokenMatches(text: unknown, tokenWeights: Map<string, number>): number {
  const haystack = ` ${String(text || "").toLowerCase()} `;
  return Array.from(tokenWeights.entries()).reduce((score, entry) => {
    const [token, weight] = entry;
    const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    return score + ((haystack.match(pattern) || []).length * weight);
  }, 0);
}

function dedupeKey(value: unknown): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .slice(0, 220);
}

function retrieveSourceSnippets(query: unknown, options: {
  includeActiveSources?: unknown;
  limit?: unknown;
  queryFields?: QueryField[];
  sources?: unknown;
} = {}): SourceSnippet[] {
  const tokenWeights = buildTokenWeights(query, options.queryFields || []);
  if (!tokenWeights.size) {
    return [];
  }

  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 5;
  const scored: SourceSnippet[] = [];
  const sources = [
    ...(options.includeActiveSources === false ? [] : getSourcesStore().sources),
    ...normalizeInlineSources(options.sources)
  ];

  sources.forEach((source) => {
    chunkText(source.text).forEach((chunk, index) => {
      const score = countTokenMatches(chunk, tokenWeights)
        + (countTokenMatches(source.title, tokenWeights) * 3)
        + (countTokenMatches(source.url, tokenWeights) * 1.5);

      if (score <= 0) {
        return;
      }

      scored.push({
        chunkIndex: index,
        score,
        sourceId: source.id,
        text: chunk.slice(0, 700),
        title: source.title,
        url: source.url
      });
    });
  });

  const seen = new Set<string>();
  const results: SourceSnippet[] = [];
  scored
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return `${left.title}:${left.chunkIndex}`.localeCompare(`${right.title}:${right.chunkIndex}`);
    })
    .forEach((snippet) => {
      const key = dedupeKey(snippet.text);
      if (!key || seen.has(key) || results.length >= limit) {
        return;
      }

      seen.add(key);
      results.push(snippet);
    });

  return results;
}

function isWorkflowSourceBudgetKey(value: unknown): value is WorkflowSourceBudgetKey {
  return typeof value === "string" && Object.hasOwn(workflowSourceBudgets, value);
}

function getSourceBudget(options: SourceBudgetOptions = {}): SourceBudget {
  const preset: Partial<SourceBudget> = isWorkflowSourceBudgetKey(options.workflow) ? workflowSourceBudgets[options.workflow] : {};
  return {
    maxPromptChars: Number.isFinite(Number(options.maxPromptChars)) ? Number(options.maxPromptChars) : preset.maxPromptChars || maxPromptSourceChars,
    maxSnippetChars: Number.isFinite(Number(options.maxSnippetChars)) ? Number(options.maxSnippetChars) : preset.maxSnippetChars || maxPromptSnippetChars,
    snippetLimit: Number.isFinite(Number(options.snippetLimit)) ? Number(options.snippetLimit) : preset.snippetLimit || maxPromptSnippets
  };
}

function applySourcePromptBudget(snippets: SourceSnippet[], options: SourceBudgetOptions = {}) {
  const sourceBudget = getSourceBudget(options);
  const budgeted: SourceSnippet[] = [];
  let remainingChars = sourceBudget.maxPromptChars;
  let truncatedSnippetCount = 0;

  snippets.slice(0, sourceBudget.snippetLimit).forEach((snippet) => {
    if (remainingChars <= 0) {
      return;
    }

    const normalized = normalizeWhitespace(snippet.text);
    const maxChars = Math.min(sourceBudget.maxSnippetChars, Math.max(0, remainingChars));
    const limited = normalized.length <= maxChars
      ? { text: normalized, truncated: false }
      : { text: normalized.slice(0, maxChars).trimEnd(), truncated: true };
    if (!limited.text) {
      return;
    }

    if (limited.truncated) {
      truncatedSnippetCount += 1;
    }

    remainingChars -= limited.text.length;
    budgeted.push({
      ...snippet,
      text: limited.text
    });
  });

  return {
    budget: {
      maxPromptChars: sourceBudget.maxPromptChars,
      maxSnippetChars: sourceBudget.maxSnippetChars,
      omittedSnippetCount: Math.max(0, snippets.length - budgeted.length),
      promptCharCount: budgeted.reduce((total, snippet) => total + snippet.text.length, 0),
      retrievedSnippetCount: snippets.length,
      snippetLimit: sourceBudget.snippetLimit,
      sourceCount: new Set(budgeted.map((snippet) => snippet.sourceId || snippet.title || snippet.url || "").filter(Boolean)).size,
      truncatedSnippetCount,
      usedSnippetCount: budgeted.length
    },
    snippets: budgeted
  };
}

function buildRetrievalQuery(fields: SourceContextFields = {}): string {
  return [
    fields.query,
    fields.title,
    fields.audience,
    fields.objective,
    fields.constraints,
    fields.themeBrief,
    fields.outline
  ].filter(Boolean).join(" ");
}

function buildRetrievalQueryFields(fields: SourceContextFields = {}): QueryField[] {
  return [
    { value: fields.query, weight: 4 },
    { value: fields.slideTitle, weight: 4 },
    { value: fields.slideIntent, weight: 3 },
    { value: fields.slideKeyMessage, weight: 3 },
    { value: fields.slideSourceNotes, weight: 4 },
    { value: fields.title, weight: 3 },
    { value: fields.objective, weight: 3 },
    { value: fields.audience, weight: 1.5 },
    { value: fields.constraints, weight: 1.25 },
    { value: fields.themeBrief, weight: 0.5 },
    { value: fields.outline, weight: 1.5 }
  ];
}

function getGenerationSourceContext(fields: SourceContextFields = {}) {
  const inlineSources = [
    ...normalizeInlineSources(fields.presentationSourceText),
    ...normalizeInlineSources(fields.presentationSources)
  ];
  const retrievedSnippets = retrieveSourceSnippets(buildRetrievalQuery(fields), {
    includeActiveSources: fields.includeActiveSources !== false,
    limit: getSourceBudget(fields).snippetLimit * 2,
    queryFields: buildRetrievalQueryFields(fields),
    sources: inlineSources
  });
  const promptPack = applySourcePromptBudget(retrievedSnippets, fields);
  return {
    budget: promptPack.budget,
    promptText: promptPack.snippets.map((snippet, index) => [
      `[${index + 1}] ${snippet.title}${snippet.url ? ` (${snippet.url})` : ""}`,
      snippet.text
    ].join("\n")).join("\n\n"),
    snippets: promptPack.snippets
  };
}

async function fetchTextFromUrl(url: string): Promise<{ text: string; title: string }> {
  assertFetchableUrl(url);
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,text/plain,application/json;q=0.8,*/*;q=0.2",
      "User-Agent": "slideotter-source-fetch/1.0"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Source URL request failed with status ${response.status}`);
  }

  assertFetchableUrl(response.url);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxFetchBytes) {
    throw new Error(`Source URL response is too large. Limit is ${maxFetchBytes} bytes.`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !acceptedFetchContentTypes.some((accepted) => contentType.toLowerCase().startsWith(accepted))) {
    throw new Error(`Source URL content type is not supported: ${contentType}`);
  }

  const raw = await response.text();
  if (raw.length > maxFetchBytes) {
    throw new Error(`Source URL response is too large. Limit is ${maxFetchBytes} characters.`);
  }

  return {
    text: normalizeSourceText(/html/i.test(contentType) ? stripHtml(raw) : raw),
    title: /html/i.test(contentType) ? extractHtmlTitle(raw) : ""
  };
}

async function createSource(input: CreateSourceInput = {}) {
  const url = normalizeUrl(input.url);
  let text = normalizeSourceText(input.text);
  let fetchedTitle = "";

  if (!text && url) {
    const fetched = await fetchTextFromUrl(url);
    text = fetched.text;
    fetchedTitle = fetched.title;
  }

  if (!text) {
    throw new Error("Source needs text content or a fetchable URL.");
  }

  const timestamp = new Date().toISOString();
  const title = normalizeWhitespace(input.title) || fetchedTitle || (url ? new URL(url).hostname : "Source");
  const source = {
    createdAt: timestamp,
    id: `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    title,
    url,
    wordCount: countWords(text)
  };
  const store = getSourcesStore();

  saveSourcesStore({
    sources: [
      source,
      ...store.sources
    ]
  });

  return sourceSummary(source);
}

function deleteSource(sourceId: string) {
  const store = getSourcesStore();
  const nextSources = store.sources.filter((source) => source.id !== sourceId);
  if (nextSources.length === store.sources.length) {
    throw new Error(`Unknown source: ${sourceId}`);
  }

  saveSourcesStore({ sources: nextSources });
  return listSources();
}

export {
  createSource,
  deleteSource,
  getGenerationSourceContext,
  listSources,
  retrieveSourceSnippets
};