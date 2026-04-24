const fs = require("fs");
const {
  getActivePresentationPaths
} = require("./presentations.ts");
const {
  ensureAllowedDir,
  writeAllowedJson
} = require("./write-boundary.ts");

const maxSourceChars = 60000;
const maxChunkChars = 900;
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

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName, value) {
  writeAllowedJson(fileName, value);
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSourceText(value) {
  return normalizeWhitespace(value).slice(0, maxSourceChars);
}

function normalizeUrl(value) {
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

function stripHtml(value) {
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

function extractHtmlTitle(value) {
  const match = String(value || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(stripHtml(match[1])) : "";
}

function normalizeSourcesStore(value) {
  const source = value && typeof value === "object" ? value : {};
  const sources = Array.isArray(source.sources)
    ? source.sources
      .filter((item) => item && typeof item.id === "string")
      .map((item) => ({
        createdAt: item.createdAt || "",
        id: item.id,
        text: normalizeSourceText(item.text),
        title: normalizeWhitespace(item.title) || "Untitled source",
        url: item.url || "",
        wordCount: Number.isFinite(Number(item.wordCount)) ? Number(item.wordCount) : countWords(item.text)
      }))
    : [];

  return { sources };
}

function getSourcesStore() {
  const paths = getActivePresentationPaths();
  ensureAllowedDir(paths.stateDir);

  if (!fs.existsSync(paths.sourcesFile)) {
    writeJson(paths.sourcesFile, { sources: [] });
  }

  return normalizeSourcesStore(readJson(paths.sourcesFile, { sources: [] }));
}

function saveSourcesStore(store) {
  const paths = getActivePresentationPaths();
  const normalized = normalizeSourcesStore(store);
  writeJson(paths.sourcesFile, normalized);
  return normalized;
}

function countWords(value) {
  return String(value || "").split(/\s+/).filter(Boolean).length;
}

function chunkText(text) {
  const paragraphs = String(text || "")
    .split(/\n{2,}|(?<=\.)\s+/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);
  const chunks = [];
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

function sourceSummary(source) {
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

function listSources(options: any = {}) {
  const sources = getSourcesStore().sources;
  return options.includeText === true
    ? sources.map((source) => ({
      ...source,
      chunkCount: chunkText(source.text).length,
      wordCount: countWords(source.text)
    }))
    : sources.map(sourceSummary);
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9-]{2,}/g)
    ?.filter((token) => !stopWords.has(token))
    .slice(0, 80) || [];
}

function countTokenMatches(text, tokens) {
  const haystack = ` ${String(text || "").toLowerCase()} `;
  return tokens.reduce((score, token) => {
    const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    return score + (haystack.match(pattern) || []).length;
  }, 0);
}

function retrieveSourceSnippets(query, options: any = {}) {
  const tokens = Array.from(new Set(tokenize(query)));
  if (!tokens.length) {
    return [];
  }

  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 5;
  const scored = [];

  getSourcesStore().sources.forEach((source) => {
    chunkText(source.text).forEach((chunk, index) => {
      const score = countTokenMatches(chunk, tokens)
        + (countTokenMatches(source.title, tokens) * 2)
        + countTokenMatches(source.url, tokens);

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

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function buildRetrievalQuery(fields: any = {}) {
  return [
    fields.title,
    fields.audience,
    fields.objective,
    fields.constraints,
    fields.themeBrief,
    fields.outline
  ].filter(Boolean).join(" ");
}

function getGenerationSourceContext(fields: any = {}) {
  const snippets = retrieveSourceSnippets(buildRetrievalQuery(fields), { limit: 6 });
  return {
    promptText: snippets.map((snippet, index) => [
      `[${index + 1}] ${snippet.title}${snippet.url ? ` (${snippet.url})` : ""}`,
      snippet.text
    ].join("\n")).join("\n\n"),
    snippets
  };
}

async function fetchTextFromUrl(url) {
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

  const raw = await response.text();
  const contentType = response.headers.get("content-type") || "";
  return {
    text: normalizeSourceText(/html/i.test(contentType) ? stripHtml(raw) : raw),
    title: /html/i.test(contentType) ? extractHtmlTitle(raw) : ""
  };
}

async function createSource(input: any = {}) {
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

function deleteSource(sourceId) {
  const store = getSourcesStore();
  const nextSources = store.sources.filter((source) => source.id !== sourceId);
  if (nextSources.length === store.sources.length) {
    throw new Error(`Unknown source: ${sourceId}`);
  }

  saveSourcesStore({ sources: nextSources });
  return listSources();
}

module.exports = {
  createSource,
  deleteSource,
  getGenerationSourceContext,
  listSources,
  retrieveSourceSnippets
};
