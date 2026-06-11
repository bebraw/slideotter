import * as fs from "fs";
import * as path from "path";
import {
  getActivePresentationPaths,
  getPresentationPaths
} from "./presentations.ts";
import {
  ensureAllowedDir,
  writeAllowedJson
} from "./write-boundary.ts";

const supportedMemoryTypes = ["claim", "evidence", "styleNote"] as const;
const supportedMemoryStatuses = ["draft", "accepted", "stale", "rejected", "retired"] as const;
const supportedMemoryConfidence = ["low", "medium", "high"] as const;
const maxSummaryChars = 600;
const maxDetailChars = 1600;
const maxTagChars = 48;
const maxTags = 12;
const maxLinksPerItem = 24;
const maxSearchResults = 12;
const maxPromptMemoryChars = 3200;
const maxPromptMemorySnippetChars = 520;
const maxPromptMemoryItems = 8;

type MemoryType = typeof supportedMemoryTypes[number];
type MemoryStatus = typeof supportedMemoryStatuses[number];
type MemoryConfidence = typeof supportedMemoryConfidence[number];

type MemoryLink = {
  href: string;
  rel: string;
  title?: string;
};

type MemoryItem = {
  confidence: MemoryConfidence;
  createdAt: string;
  detail: string;
  evidence: MemoryLink[];
  id: string;
  status: MemoryStatus;
  summary: string;
  tags: string[];
  type: MemoryType;
  updatedAt: string;
  usedBy: MemoryLink[];
};

type MemoryStoreLink = MemoryLink & {
  from: string;
  to: string;
};

type DerivedSlidesetRecord = {
  createdAt: string;
  id: string;
  memoryIds: string[];
  purpose: string;
  resultPresentationId: string | null;
  sourcePresentationId: string;
  targetLength: number | null;
};

type MemoryStore = {
  derivedSets: DerivedSlidesetRecord[];
  items: MemoryItem[];
  links: MemoryStoreLink[];
};

type MemoryReadOptions = {
  presentationId?: unknown;
};

type MemoryItemInput = {
  confidence?: unknown;
  detail?: unknown;
  evidence?: unknown;
  id?: unknown;
  status?: unknown;
  summary?: unknown;
  tags?: unknown;
  type?: unknown;
  usedBy?: unknown;
};

type MemoryEvidenceInput = {
  evidence?: unknown;
};

type DerivedSlidesetInput = {
  id?: unknown;
  memoryIds?: unknown;
  purpose?: unknown;
  resultPresentationId?: unknown;
  sourcePresentationId?: unknown;
  targetLength?: unknown;
};

type MemorySearchOptions = MemoryReadOptions & {
  limit?: unknown;
};

type MemorySearchResult = {
  item: MemoryItem;
  score: number;
};

type MemoryPromptBudget = {
  maxPromptChars: number;
  maxSnippetChars: number;
  promptChars: number;
  retrievedCount: number;
  snippetLimit: number;
  usedCount: number;
};

type MemorySnippet = {
  confidence: MemoryConfidence;
  detail: string;
  evidence: MemoryLink[];
  memoryId: string;
  score: number;
  status: MemoryStatus;
  summary: string;
  tags: string[];
  type: MemoryType;
};

type GenerationMemoryContext = {
  budget: MemoryPromptBudget;
  promptText: string;
  snippets: MemorySnippet[];
};

type GenerationMemoryFields = MemoryReadOptions & {
  audience?: unknown;
  constraints?: unknown;
  objective?: unknown;
  outline?: unknown;
  query?: unknown;
  slideIntent?: unknown;
  slideKeyMessage?: unknown;
  slideSourceNotes?: unknown;
  slideTitle?: unknown;
  slideValue?: unknown;
  themeBrief?: unknown;
  title?: unknown;
  workflow?: unknown;
};

const defaultMemoryStore: MemoryStore = {
  derivedSets: [],
  items: [],
  links: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown): void {
  writeAllowedJson(fileName, value);
}

function memoryFileFor(options: MemoryReadOptions = {}): string {
  return options.presentationId
    ? getPresentationPaths(options.presentationId).memoryFile
    : getActivePresentationPaths().memoryFile;
}

function normalizeWhitespace(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value: unknown, maxLength: number): string {
  return normalizeWhitespace(value).slice(0, maxLength);
}

function createSlug(value: unknown, fallback = "memory"): string {
  const slug = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);

  return slug || fallback;
}

function normalizeMemoryType(value: unknown): MemoryType {
  const raw = String(value || "").trim();
  if (raw === "style-note" || raw === "style_note" || raw === "style") {
    return "styleNote";
  }
  if ((supportedMemoryTypes as readonly string[]).includes(raw)) {
    return raw as MemoryType;
  }
  throw new Error(`Unsupported memory type: ${raw || "missing"}`);
}

function normalizeMemoryStatus(value: unknown, fallback: MemoryStatus = "draft"): MemoryStatus {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }
  if ((supportedMemoryStatuses as readonly string[]).includes(raw)) {
    return raw as MemoryStatus;
  }
  throw new Error(`Unsupported memory status: ${raw}`);
}

function normalizeMemoryConfidence(value: unknown): MemoryConfidence {
  const raw = String(value || "").trim();
  if (!raw) {
    return "medium";
  }
  if ((supportedMemoryConfidence as readonly string[]).includes(raw)) {
    return raw as MemoryConfidence;
  }
  throw new Error(`Unsupported memory confidence: ${raw}`);
}

function normalizeTags(value: unknown): string[] {
  const rawTags = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const tags: string[] = [];

  rawTags.forEach((entry: unknown) => {
    const tag = truncateText(entry, maxTagChars).toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  });

  return tags.slice(0, maxTags);
}

function normalizeLink(value: unknown): MemoryLink | null {
  if (!isRecord(value)) {
    return null;
  }
  const rel = createSlug(value.rel, "related");
  const href = normalizeWhitespace(value.href);
  if (!href || href.length > 500) {
    return null;
  }
  const title = truncateText(value.title, 120);

  return title
    ? { href, rel, title }
    : { href, rel };
}

function normalizeLinks(value: unknown): MemoryLink[] {
  const seen = new Set<string>();
  const links: MemoryLink[] = [];
  const rawLinks = Array.isArray(value) ? value : [];

  rawLinks.forEach((entry: unknown) => {
    const link = normalizeLink(entry);
    if (!link) {
      return;
    }
    const key = `${link.rel}:${link.href}`;
    if (!seen.has(key)) {
      seen.add(key);
      links.push(link);
    }
  });

  return links.slice(0, maxLinksPerItem);
}

function normalizeMemoryItem(value: unknown): MemoryItem | null {
  try {
    if (!isRecord(value)) {
      return null;
    }
    const summary = truncateText(value.summary, maxSummaryChars);
    if (!summary) {
      return null;
    }
    const type = normalizeMemoryType(value.type);
    const createdAt = normalizeWhitespace(value.createdAt) || new Date().toISOString();
    const updatedAt = normalizeWhitespace(value.updatedAt) || createdAt;

    return {
      confidence: normalizeMemoryConfidence(value.confidence),
      createdAt,
      detail: truncateText(value.detail, maxDetailChars),
      evidence: normalizeLinks(value.evidence),
      id: createSlug(value.id || `${type}-${summary}`, `${type}-memory`),
      status: normalizeMemoryStatus(value.status),
      summary,
      tags: normalizeTags(value.tags),
      type,
      updatedAt,
      usedBy: normalizeLinks(value.usedBy)
    };
  } catch (error) {
    return null;
  }
}

function normalizeStoreLink(value: unknown): MemoryStoreLink | null {
  if (!isRecord(value)) {
    return null;
  }
  const link = normalizeLink(value);
  const from = createSlug(value.from, "");
  const to = createSlug(value.to, "");
  if (!link || !from || !to) {
    return null;
  }

  return {
    ...link,
    from,
    to
  };
}

function normalizeDerivedSlideset(value: unknown): DerivedSlidesetRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = createSlug(value.id, "derived-slideset");
  const sourcePresentationId = createSlug(value.sourcePresentationId, "");
  if (!sourcePresentationId) {
    return null;
  }
  const parsedTargetLength = Number.parseInt(String(value.targetLength || ""), 10);

  return {
    createdAt: normalizeWhitespace(value.createdAt) || new Date().toISOString(),
    id,
    memoryIds: Array.isArray(value.memoryIds)
      ? value.memoryIds.map((entry: unknown) => createSlug(entry, "")).filter(Boolean).slice(0, 40)
      : [],
    purpose: truncateText(value.purpose, 240),
    resultPresentationId: createSlug(value.resultPresentationId, "") || null,
    sourcePresentationId,
    targetLength: Number.isFinite(parsedTargetLength) && parsedTargetLength > 0
      ? parsedTargetLength
      : null
  };
}

function uniqueItems(items: MemoryItem[]): MemoryItem[] {
  const seen = new Set<string>();
  const normalized: MemoryItem[] = [];

  items.forEach((item: MemoryItem) => {
    let id = item.id;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${item.id}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    normalized.push({
      ...item,
      id
    });
  });

  return normalized;
}

function normalizeMemoryStore(value: unknown): MemoryStore {
  const source = isRecord(value) ? value : {};
  const items = uniqueItems(
    (Array.isArray(source.items) ? source.items : [])
      .map(normalizeMemoryItem)
      .filter((item: MemoryItem | null): item is MemoryItem => Boolean(item))
  );

  return {
    derivedSets: (Array.isArray(source.derivedSets) ? source.derivedSets : [])
      .map(normalizeDerivedSlideset)
      .filter((entry: DerivedSlidesetRecord | null): entry is DerivedSlidesetRecord => Boolean(entry)),
    items,
    links: (Array.isArray(source.links) ? source.links : [])
      .map(normalizeStoreLink)
      .filter((entry: MemoryStoreLink | null): entry is MemoryStoreLink => Boolean(entry))
  };
}

function ensureMemoryStore(options: MemoryReadOptions = {}): void {
  const fileName = memoryFileFor(options);
  ensureAllowedDir(path.dirname(fileName));
  if (!fs.existsSync(fileName)) {
    writeJson(fileName, defaultMemoryStore);
  }
}

function getMemoryStore(options: MemoryReadOptions = {}): MemoryStore {
  ensureMemoryStore(options);
  return normalizeMemoryStore(readJson(memoryFileFor(options), defaultMemoryStore));
}

function saveMemoryStore(store: MemoryStore, options: MemoryReadOptions = {}): MemoryStore {
  ensureMemoryStore(options);
  const normalized = normalizeMemoryStore(store);
  writeJson(memoryFileFor(options), normalized);
  return normalized;
}

function listMemoryItems(options: MemoryReadOptions = {}): MemoryItem[] {
  return getMemoryStore(options).items;
}

function getMemoryItem(memoryId: unknown, options: MemoryReadOptions = {}): MemoryItem {
  const id = createSlug(memoryId, "");
  const item = listMemoryItems(options).find((entry: MemoryItem) => entry.id === id);
  if (!item) {
    throw new Error(`Unknown memory item: ${memoryId}`);
  }

  return item;
}

function nextMemoryId(type: MemoryType, summary: string, items: MemoryItem[], requestedId?: unknown): string {
  const base = createSlug(requestedId || `${type}-${summary}`, `${type}-memory`);
  const existing = new Set(items.map((item: MemoryItem) => item.id));
  let id = base;
  let suffix = 2;
  while (existing.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function createMemoryItem(input: MemoryItemInput, options: MemoryReadOptions = {}): MemoryItem {
  const type = normalizeMemoryType(input.type);
  const summary = truncateText(input.summary, maxSummaryChars);
  if (!summary) {
    throw new Error("Memory item summary is required.");
  }
  const store = getMemoryStore(options);
  const now = new Date().toISOString();
  const item: MemoryItem = {
    confidence: normalizeMemoryConfidence(input.confidence),
    createdAt: now,
    detail: truncateText(input.detail, maxDetailChars),
    evidence: normalizeLinks(input.evidence),
    id: nextMemoryId(type, summary, store.items, input.id),
    status: normalizeMemoryStatus(input.status),
    summary,
    tags: normalizeTags(input.tags),
    type,
    updatedAt: now,
    usedBy: normalizeLinks(input.usedBy)
  };

  saveMemoryStore({
    ...store,
    items: [
      item,
      ...store.items
    ]
  }, options);

  return item;
}

function updateMemoryItem(memoryId: unknown, input: MemoryItemInput, options: MemoryReadOptions = {}): MemoryItem {
  const id = createSlug(memoryId, "");
  const store = getMemoryStore(options);
  const current = store.items.find((item: MemoryItem) => item.id === id);
  if (!current) {
    throw new Error(`Unknown memory item: ${memoryId}`);
  }
  const next: MemoryItem = {
    ...current,
    confidence: input.confidence == null ? current.confidence : normalizeMemoryConfidence(input.confidence),
    detail: input.detail == null ? current.detail : truncateText(input.detail, maxDetailChars),
    evidence: input.evidence == null ? current.evidence : normalizeLinks(input.evidence),
    status: input.status == null ? current.status : normalizeMemoryStatus(input.status, current.status),
    summary: input.summary == null ? current.summary : truncateText(input.summary, maxSummaryChars),
    tags: input.tags == null ? current.tags : normalizeTags(input.tags),
    type: input.type == null ? current.type : normalizeMemoryType(input.type),
    updatedAt: new Date().toISOString(),
    usedBy: input.usedBy == null ? current.usedBy : normalizeLinks(input.usedBy)
  };
  if (!next.summary) {
    throw new Error("Memory item summary is required.");
  }

  saveMemoryStore({
    ...store,
    items: store.items.map((item: MemoryItem) => item.id === id ? next : item)
  }, options);

  return next;
}

function retireMemoryItem(memoryId: unknown, options: MemoryReadOptions = {}): MemoryItem {
  return updateMemoryItem(memoryId, { status: "retired" }, options);
}

function linkMemoryEvidence(memoryId: unknown, input: MemoryEvidenceInput, options: MemoryReadOptions = {}): MemoryItem {
  const current = getMemoryItem(memoryId, options);
  const nextEvidence = [
    ...current.evidence,
    ...normalizeLinks(input.evidence)
  ];

  return updateMemoryItem(memoryId, {
    evidence: nextEvidence
  }, options);
}

function nextDerivedSlidesetId(store: MemoryStore, input: DerivedSlidesetInput): string {
  const base = createSlug(input.id || input.purpose || "derived-slideset", "derived-slideset");
  const existing = new Set(store.derivedSets.map((entry: DerivedSlidesetRecord) => entry.id));
  let id = base;
  let suffix = 2;
  while (existing.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function recordDerivedSlideset(input: DerivedSlidesetInput, options: MemoryReadOptions = {}): DerivedSlidesetRecord {
  const store = getMemoryStore(options);
  const sourcePresentationId = createSlug(input.sourcePresentationId || options.presentationId, "");
  if (!sourcePresentationId) {
    throw new Error("Derived slideset source presentation is required.");
  }
  const parsedTargetLength = Number.parseInt(String(input.targetLength || ""), 10);
  const record: DerivedSlidesetRecord = {
    createdAt: new Date().toISOString(),
    id: nextDerivedSlidesetId(store, input),
    memoryIds: Array.isArray(input.memoryIds)
      ? input.memoryIds.map((entry: unknown) => createSlug(entry, "")).filter(Boolean).slice(0, 40)
      : [],
    purpose: truncateText(input.purpose, 240) || "Derived slideset",
    resultPresentationId: createSlug(input.resultPresentationId, "") || null,
    sourcePresentationId,
    targetLength: Number.isFinite(parsedTargetLength) && parsedTargetLength > 0
      ? parsedTargetLength
      : null
  };

  saveMemoryStore({
    ...store,
    derivedSets: [
      record,
      ...store.derivedSets
    ]
  }, options);

  return record;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token: string) => token.length > 2);
}

function scoreMemoryItem(item: MemoryItem, queryTokens: string[]): number {
  if (!queryTokens.length) {
    return 0;
  }
  const haystack = [
    item.type,
    item.status,
    item.summary,
    item.detail,
    ...item.tags,
    ...item.evidence.map((link: MemoryLink) => `${link.rel} ${link.title || ""} ${link.href}`)
  ].join(" ").toLowerCase();

  return queryTokens.reduce((score: number, token: string) => {
    if (!haystack.includes(token)) {
      return score;
    }
    const summaryBoost = item.summary.toLowerCase().includes(token) ? 3 : 0;
    const tagBoost = item.tags.some((tag: string) => tag.includes(token)) ? 2 : 0;
    return score + 1 + summaryBoost + tagBoost;
  }, 0);
}

function searchMemoryItems(query: unknown, options: MemorySearchOptions = {}): MemorySearchResult[] {
  const queryTokens = tokenize(normalizeWhitespace(query));
  const limit = Math.min(
    maxSearchResults,
    Math.max(1, Number.parseInt(String(options.limit || maxSearchResults), 10) || maxSearchResults)
  );

  return listMemoryItems(options)
    .map((item: MemoryItem) => ({
      item,
      score: scoreMemoryItem(item, queryTokens)
    }))
    .filter((result: MemorySearchResult) => result.score > 0 && result.item.status !== "retired")
    .sort((left: MemorySearchResult, right: MemorySearchResult) => right.score - left.score)
    .slice(0, limit);
}

function createMemoryQuery(fields: GenerationMemoryFields = {}): string {
  return [
    fields.query,
    fields.title,
    fields.audience,
    fields.objective,
    fields.constraints,
    fields.themeBrief,
    fields.outline,
    fields.slideTitle,
    fields.slideIntent,
    fields.slideKeyMessage,
    fields.slideValue,
    fields.slideSourceNotes,
    fields.workflow
  ].map(normalizeWhitespace).filter(Boolean).join(" ");
}

function createMemorySnippet(result: MemorySearchResult): MemorySnippet {
  const { item, score } = result;

  return {
    confidence: item.confidence,
    detail: truncateText(item.detail, maxPromptMemorySnippetChars),
    evidence: item.evidence,
    memoryId: item.id,
    score,
    status: item.status,
    summary: truncateText(item.summary, maxPromptMemorySnippetChars),
    tags: item.tags,
    type: item.type
  };
}

function formatMemorySnippet(snippet: MemorySnippet): string {
  const metadata = [
    snippet.type,
    snippet.status,
    `${snippet.confidence} confidence`,
    `score ${snippet.score}`
  ].join(", ");
  const lines = [
    `- ${snippet.summary} (${metadata}; id ${snippet.memoryId})`
  ];
  if (snippet.detail) {
    lines.push(`  Detail: ${snippet.detail}`);
  }
  if (snippet.tags.length) {
    lines.push(`  Tags: ${snippet.tags.join(", ")}`);
  }
  if (snippet.evidence.length) {
    lines.push(`  Evidence: ${snippet.evidence.map((link: MemoryLink) => link.title || link.href).join("; ")}`);
  }

  return lines.join("\n");
}

function buildMemoryPrompt(snippets: MemorySnippet[]): string {
  const lines: string[] = [];
  for (const snippet of snippets) {
    const formatted = formatMemorySnippet(snippet);
    const next = [...lines, formatted].join("\n");
    if (next.length > maxPromptMemoryChars) {
      break;
    }
    lines.push(formatted);
  }

  return lines.join("\n");
}

function getGenerationMemoryContext(fields: GenerationMemoryFields = {}): GenerationMemoryContext {
  const query = createMemoryQuery(fields);
  const results = query
    ? searchMemoryItems(query, {
        limit: maxPromptMemoryItems,
        presentationId: fields.presentationId
      })
    : [];
  const snippets = results.map(createMemorySnippet);
  const promptText = buildMemoryPrompt(snippets);

  return {
    budget: {
      maxPromptChars: maxPromptMemoryChars,
      maxSnippetChars: maxPromptMemorySnippetChars,
      promptChars: promptText.length,
      retrievedCount: results.length,
      snippetLimit: maxPromptMemoryItems,
      usedCount: snippets.length
    },
    promptText,
    snippets
  };
}

export {
  createMemoryItem,
  defaultMemoryStore,
  getGenerationMemoryContext,
  getMemoryItem,
  getMemoryStore,
  linkMemoryEvidence,
  listMemoryItems,
  normalizeMemoryStore,
  recordDerivedSlideset,
  retireMemoryItem,
  saveMemoryStore,
  searchMemoryItems,
  updateMemoryItem,
  type DerivedSlidesetRecord,
  type DerivedSlidesetInput,
  type GenerationMemoryContext,
  type MemoryConfidence,
  type MemoryItem,
  type MemoryLink,
  type MemoryPromptBudget,
  type MemorySearchResult,
  type MemorySnippet,
  type MemoryStatus,
  type MemoryStore,
  type MemoryStoreLink,
  type MemoryType
};
