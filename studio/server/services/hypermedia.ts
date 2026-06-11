import * as fs from "fs";
import * as path from "path";
import {
  getPresentationPaths,
  listPresentations,
  readPresentationDeckContext,
  readPresentationSummary
} from "./presentations.ts";
import {
  getMemoryItem,
  getMemoryStore,
  listMemoryItems,
  searchMemoryItems,
  type DerivedSlidesetRecord,
  type MemoryItem,
  type MemoryLink,
  type MemorySearchResult
} from "./memory.ts";
import { getSlide, getSlides, readSlideSpec } from "./slides.ts";
import { listVariantsForSlide } from "./variants.ts";

const API_VERSION = "v1";
type JsonRecord = Record<string, unknown>;
type PresentationCollectionState = JsonRecord & {
  activePresentationId: string;
  presentations: JsonRecord[];
};
type Link = { href: string };
type InputSchemaId = keyof typeof inputSchemas;
type ActionDescriptor = {
  audience: string[];
  baseVersion?: string;
  effect: string;
  href: string;
  id: string;
  input: InputSchemaId;
  inputFields?: readonly unknown[];
  label: string;
  links?: Record<string, Link>;
  method: string;
  scope: string;
};
type ActionOptions = {
  audience?: string[];
  baseVersion?: string | null;
  effect: string;
  href: string;
  id: string;
  input: InputSchemaId;
  label: string;
  links?: Record<string, Link> | null;
  method: string;
  scope: string;
};
type VersionedError = Error & {
  code?: string;
  statusCode?: number;
};

const inputSchemas = {
  createPresentationRequest: {
    fields: [
      { id: "title", label: "Title", required: true, type: "string" },
      { id: "audience", label: "Audience", required: false, type: "string" },
      { id: "objective", label: "Objective", required: false, type: "string" },
      { id: "tone", label: "Tone", required: false, type: "string" },
      { id: "targetSlideCount", label: "Target slide count", required: false, type: "integer" }
    ]
  },
  createSystemSlideRequest: {
    fields: [
      { id: "slideType", label: "Slide type", options: ["content", "divider", "quote", "photo", "photoGrid"], required: false, type: "enum" },
      { id: "title", label: "Title", required: true, type: "string" },
      { id: "summary", label: "Summary", required: false, type: "string" },
      { id: "afterSlideId", label: "After slide", required: false, type: "string" }
    ]
  },
  deckContextUpdateRequest: {
    fields: [
      { id: "deck", label: "Deck patch", required: true, type: "object" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  deckStructureWorkflowRequest: {
    fields: [
      { id: "dryRun", label: "Preview only", required: false, type: "boolean" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  emptyRequest: {
    fields: []
  },
  memoryEvidenceLinkRequest: {
    fields: [
      { id: "evidence", label: "Evidence links", required: true, type: "array" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  memoryItemRequest: {
    fields: [
      { id: "type", label: "Type", options: ["claim", "evidence", "concept", "audienceAssumption", "styleNote", "decision", "reviewNote"], required: true, type: "enum" },
      { id: "summary", label: "Summary", required: true, type: "string" },
      { id: "detail", label: "Detail", required: false, type: "string" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  memorySearchRequest: {
    fields: [
      { id: "query", label: "Query", required: true, type: "string" },
      { id: "limit", label: "Limit", required: false, type: "integer" }
    ]
  },
  memoryStatusUpdateRequest: {
    fields: [
      { id: "status", label: "Status", options: ["draft", "accepted", "stale", "rejected", "retired"], required: false, type: "enum" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  presentationIdRequest: {
    fields: [
      { id: "presentationId", label: "Presentation", required: true, type: "string" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  slideIdRequest: {
    fields: [
      { id: "slideId", label: "Slide", required: true, type: "string" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  slideSpecUpdateRequest: {
    fields: [
      { id: "slideSpec", label: "Slide spec", required: true, type: "object" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" },
      { id: "rebuild", label: "Rebuild preview", required: false, type: "boolean" }
    ]
  },
  slideWorkflowRequest: {
    fields: [
      { id: "slideId", label: "Slide", required: true, type: "string" },
      { id: "candidateCount", label: "Candidate count", max: 8, min: 1, required: false, type: "integer" },
      { id: "dryRun", label: "Preview only", required: false, type: "boolean" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  },
  validateDeckRequest: {
    fields: [
      { id: "includeRender", label: "Include render checks", required: false, type: "boolean" }
    ]
  },
  variantApplyRequest: {
    fields: [
      { id: "variantId", label: "Candidate", required: true, type: "string" },
      { id: "baseVersion", label: "Base version", required: false, type: "string" }
    ]
  }
} as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function versionFromFiles(files: string[]): string {
  const parts = files.map((fileName) => {
    try {
      const stat = fs.statSync(fileName);
      return `${path.basename(fileName)}:${Math.trunc(stat.mtimeMs)}:${stat.size}`;
    } catch (error) {
      return `${path.basename(fileName)}:missing`;
    }
  });

  return parts.join("|");
}

function getPresentationVersion(presentationId: string): string {
  const paths = getPresentationPaths(presentationId);
  const slideFiles = fs.existsSync(paths.slidesDir)
    ? (fs.readdirSync(paths.slidesDir) as string[])
      .filter((fileName) => /^slide-\d+\.json$/.test(fileName))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .map((fileName) => path.join(paths.slidesDir, fileName))
    : [];

  return versionFromFiles([
    paths.metaFile,
    paths.deckContextFile,
    paths.sourcesFile,
    paths.memoryFile,
    paths.materialsFile,
    paths.layoutsFile,
    paths.variantsFile,
    ...slideFiles
  ]);
}

function getMemoryVersion(presentationId: string): string {
  const paths = getPresentationPaths(presentationId);
  return versionFromFiles([paths.memoryFile]);
}

function getSlideVersion(presentationId: string, slideId: string): string {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  return versionFromFiles([slide.path]);
}

function createStaleResourceError(resourceLabel: string): VersionedError {
  const error: VersionedError = new Error(`${resourceLabel} changed after this action was advertised. Refresh the resource and try again.`);
  error.code = "STALE_RESOURCE_VERSION";
  error.statusCode = 409;
  return error;
}

function assertBaseVersion(currentVersion: string, advertisedVersion: unknown, resourceLabel: string) {
  if (advertisedVersion == null || advertisedVersion === "") {
    return;
  }

  if (advertisedVersion !== currentVersion) {
    throw createStaleResourceError(resourceLabel);
  }
}

function link(href: string): Link {
  return { href };
}

function action({
  audience = ["local", "headless"],
  baseVersion = null,
  effect,
  href,
  id,
  input,
  label,
  links = null,
  method,
  scope
}: ActionOptions): ActionDescriptor {
  const descriptor: ActionDescriptor = {
    id,
    label,
    method,
    href,
    effect,
    input,
    scope,
    audience
  };
  const schema = inputSchemas[input];

  if (schema && schema.fields.length <= 5) {
    descriptor.inputFields = schema.fields;
  }

  if (baseVersion) {
    descriptor.baseVersion = baseVersion;
  }

  if (links) {
    descriptor.links = links;
  }

  return descriptor;
}

function createApiRootResource() {
  const presentations = listPresentations() as PresentationCollectionState;
  const activePresentationId = presentations.activePresentationId;

  return {
    resource: "studio",
    version: API_VERSION,
    state: {
      activePresentationId,
      presentationCount: presentations.presentations.length
    },
    links: {
      self: link("/api/v1"),
      presentations: link("/api/v1/presentations"),
      activePresentation: link(`/api/v1/presentations/${activePresentationId}`),
      jobs: link("/api/v1/jobs/current"),
      schemas: link("/api/v1/schemas")
    },
    actions: [
      action({
        effect: "write",
        href: "/api/v1/presentations",
        id: "create-presentation",
        input: "createPresentationRequest",
        label: "Create presentation",
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createPresentationCollectionResource() {
  const presentations = listPresentations() as PresentationCollectionState;

  return {
    resource: "presentationCollection",
    version: API_VERSION,
    state: {
      activePresentationId: presentations.activePresentationId,
      count: presentations.presentations.length
    },
    links: {
      self: link("/api/v1/presentations"),
      root: link("/api/v1"),
      activePresentation: link(`/api/v1/presentations/${presentations.activePresentationId}`)
    },
    presentations: (presentations.presentations as JsonRecord[]).map((presentation) => ({
      ...presentation,
      links: {
        self: link(`/api/v1/presentations/${presentation.id}`)
      }
    })),
    actions: [
      action({
        effect: "write",
        href: "/api/v1/presentations",
        id: "create-presentation",
        input: "createPresentationRequest",
        label: "Create presentation",
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createPresentationResource(presentationId: string) {
  const presentations = listPresentations() as PresentationCollectionState;
  const summary = readPresentationSummary(presentationId);
  const deckContext = readPresentationDeckContext(presentationId);
  const slides = getSlides({ presentationId }) as JsonRecord[];
  const presentationVersion = getPresentationVersion(presentationId);
  const isActive = presentations.activePresentationId === presentationId;
  const canDelete = presentations.presentations.length > 1;
  const actions = [
    action({
      baseVersion: presentationVersion,
      effect: "candidate",
      href: "/api/v1/operations/ideate-deck-structure",
      id: "generate-deck-structure-candidates",
      input: "deckStructureWorkflowRequest",
      label: "Generate deck structure candidates",
      links: {
        diagnostics: link("/api/v1/runtime"),
        result: link(`/api/v1/presentations/${presentationId}`)
      },
      method: "POST",
      scope: "deck"
    }),
    action({
      baseVersion: presentationVersion,
      effect: "write",
      href: "/api/v1/operations/refine-deck-narration",
      id: "refine-deck-narration",
      input: "presentationIdRequest",
      label: "Refine deck narration",
      links: {
        diagnostics: link("/api/v1/runtime"),
        result: link(`/api/v1/presentations/${presentationId}`)
      },
      method: "POST",
      scope: "deck"
    }),
    action({
      baseVersion: presentationVersion,
      effect: "write",
      href: "/api/v1/context",
      id: "save-deck-context",
      input: "deckContextUpdateRequest",
      label: "Save deck context",
      method: "POST",
      scope: "deck"
    }),
    action({
      effect: "read",
      href: "/api/v1/validate",
      id: "run-validation",
      input: "validateDeckRequest",
      label: "Run validation",
      links: {
        diagnostics: link("/api/v1/runtime")
      },
      method: "POST",
      scope: "deck"
    }),
    action({
      effect: "export",
      href: "/api/v1/build",
      id: "export-pdf",
      input: "emptyRequest",
      label: "Export PDF",
      links: {
        diagnostics: link("/api/v1/runtime"),
        result: link("/api/v1/preview/deck")
      },
      method: "POST",
      scope: "deck"
    }),
    action({
      baseVersion: presentationVersion,
      effect: "write",
      href: "/api/v1/presentations/duplicate",
      id: "duplicate-presentation",
      input: "presentationIdRequest",
      label: "Duplicate presentation",
      method: "POST",
      scope: "deck"
    })
  ];

  if (!isActive) {
    actions.unshift(action({
      effect: "write",
      href: "/api/v1/presentations/select",
      id: "select-presentation",
      input: "presentationIdRequest",
      label: "Select presentation",
      method: "POST",
      scope: "deck"
    }));
  }

  if (canDelete) {
    actions.push(action({
      baseVersion: presentationVersion,
      effect: "destructive",
      href: "/api/v1/presentations/delete",
      id: "delete-presentation",
      input: "presentationIdRequest",
      label: "Delete presentation",
      method: "POST",
      scope: "deck"
    }));
  }

  return {
    resource: "presentation",
    version: API_VERSION,
    id: presentationId,
    state: {
      active: isActive,
      baseVersion: presentationVersion,
      slideCount: slides.length,
      title: summary.title,
      updatedAt: summary.updatedAt
    },
    presentation: summary,
    deckContext,
    slides: slides.map((slide) => ({
      id: slide.id,
      index: slide.index,
      skipped: slide.skipped,
      title: slide.title,
      links: {
        self: link(`/api/v1/presentations/${presentationId}/slides/${slide.id}`),
        preview: link(`/api/v1/preview/slide/${slide.index}`),
        spec: link(`/api/v1/slides/${slide.id}`)
      }
    })),
    links: {
      self: link(`/api/v1/presentations/${presentationId}`),
      root: link("/api/v1"),
      presentations: link("/api/v1/presentations"),
      slides: link(`/api/v1/presentations/${presentationId}/slides`),
      selectedSlide: slides[0] ? link(`/api/v1/presentations/${presentationId}/slides/${slides[0].id}`) : null,
      deckContext: link("/api/v1/context"),
      memory: link(`/api/v1/presentations/${presentationId}/memory`),
      claims: link(`/api/v1/presentations/${presentationId}/memory?type=claim`),
      concepts: link(`/api/v1/presentations/${presentationId}/memory?type=concept`),
      styleNotes: link(`/api/v1/presentations/${presentationId}/memory?type=styleNote`),
      derivedSlidesets: link(`/api/v1/presentations/${presentationId}/memory/derived-slidesets`),
      sources: link("/api/v1/sources"),
      materials: link("/api/v1/materials"),
      checks: link(`/api/v1/presentations/${presentationId}/checks`),
      exports: link(`/api/v1/presentations/${presentationId}/exports`),
      present: link(`/present/${presentationId}`)
    },
    actions
  };
}

function memoryItemLinks(presentationId: string, item: MemoryItem) {
  return {
    self: link(`/api/v1/presentations/${presentationId}/memory/${item.id}`),
    presentation: link(`/api/v1/presentations/${presentationId}`),
    memory: link(`/api/v1/presentations/${presentationId}/memory`),
    evidence: link(`/api/v1/presentations/${presentationId}/memory/${item.id}/evidence`),
    dependentSlides: link(`/api/v1/presentations/${presentationId}/memory/${item.id}/dependent-slides`),
    derivedSlidesets: link(`/api/v1/presentations/${presentationId}/memory/derived-slidesets`),
    related: link(`/api/v1/presentations/${presentationId}/memory?relatedTo=${item.id}`)
  };
}

function summarizeMemoryItem(presentationId: string, item: MemoryItem) {
  return {
    confidence: item.confidence,
    evidenceCount: item.evidence.length,
    id: item.id,
    status: item.status,
    summary: item.summary,
    tags: item.tags,
    type: item.type,
    updatedAt: item.updatedAt,
    usedByCount: item.usedBy.length,
    links: memoryItemLinks(presentationId, item)
  };
}

function createMemoryCollectionResource(presentationId: string, filters: { query?: unknown; relatedTo?: unknown; type?: unknown } = {}) {
  const memoryVersion = getMemoryVersion(presentationId);
  const typeFilter = String(filters.type || "").trim();
  const relatedTo = String(filters.relatedTo || "").trim();
  const query = String(filters.query || "").trim();
  const store = getMemoryStore({ presentationId });
  const searchResults = query
    ? searchMemoryItems(query, { presentationId })
    : [];
  const items = (query
    ? searchResults.map((result: MemorySearchResult) => result.item)
    : listMemoryItems({ presentationId }))
    .filter((item: MemoryItem) => !typeFilter || item.type === typeFilter)
    .filter((item: MemoryItem) => !relatedTo
      || item.evidence.some((entry: MemoryLink) => entry.href.includes(relatedTo))
      || item.usedBy.some((entry: MemoryLink) => entry.href.includes(relatedTo)));

  return {
    resource: "memoryCollection",
    version: API_VERSION,
    state: {
      baseVersion: memoryVersion,
      count: items.length,
      presentationId,
      query,
      relatedTo,
      type: typeFilter
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/memory`),
      presentation: link(`/api/v1/presentations/${presentationId}`),
      items: link(`/api/v1/presentations/${presentationId}/memory`),
      search: link(`/api/v1/presentations/${presentationId}/memory/search`),
      claims: link(`/api/v1/presentations/${presentationId}/memory?type=claim`),
      concepts: link(`/api/v1/presentations/${presentationId}/memory?type=concept`),
      styleNotes: link(`/api/v1/presentations/${presentationId}/memory?type=styleNote`),
      derivedSlidesets: link(`/api/v1/presentations/${presentationId}/memory/derived-slidesets`)
    },
    memoryItems: items.map((item: MemoryItem) => summarizeMemoryItem(presentationId, item)),
    searchResults: searchResults.map((result: MemorySearchResult) => ({
      item: summarizeMemoryItem(presentationId, result.item),
      score: result.score
    })),
    derivedSets: store.derivedSets,
    actions: [
      action({
        baseVersion: memoryVersion,
        effect: "write",
        href: `/api/v1/presentations/${presentationId}/memory`,
        id: "create-memory-item",
        input: "memoryItemRequest",
        label: "Create memory item",
        method: "POST",
        scope: "memory"
      }),
      action({
        effect: "read",
        href: `/api/v1/presentations/${presentationId}/memory/search`,
        id: "search-memory",
        input: "memorySearchRequest",
        label: "Search memory",
        method: "POST",
        scope: "memory"
      })
    ]
  };
}

function createDerivedSlidesetCollectionResource(presentationId: string) {
  const store = getMemoryStore({ presentationId });

  return {
    resource: "derivedSlidesetCollection",
    version: API_VERSION,
    state: {
      count: store.derivedSets.length,
      presentationId
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/memory/derived-slidesets`),
      memory: link(`/api/v1/presentations/${presentationId}/memory`),
      presentation: link(`/api/v1/presentations/${presentationId}`)
    },
    derivedSlidesets: store.derivedSets.map((record: DerivedSlidesetRecord) => ({
      ...record,
      links: {
        resultPresentation: record.resultPresentationId
          ? link(`/api/v1/presentations/${record.resultPresentationId}`)
          : null,
        sourceMemory: link(`/api/v1/presentations/${presentationId}/memory`),
        sourcePresentation: link(`/api/v1/presentations/${record.sourcePresentationId}`)
      }
    })),
    actions: [
      action({
        effect: "candidate",
        href: `/api/v1/presentations/${presentationId}/memory`,
        id: "create-derived-slideset",
        input: "memorySearchRequest",
        label: "Create derived slideset",
        links: {
          memory: link(`/api/v1/presentations/${presentationId}/memory`)
        },
        method: "POST",
        scope: "memory"
      })
    ]
  };
}

function createMemoryItemResource(presentationId: string, memoryId: string) {
  const item = getMemoryItem(memoryId, { presentationId });
  const memoryVersion = getMemoryVersion(presentationId);
  const actions = [
    action({
      baseVersion: memoryVersion,
      effect: "write",
      href: `/api/v1/presentations/${presentationId}/memory/${item.id}`,
      id: "update-memory-item",
      input: "memoryItemRequest",
      label: "Update memory item",
      method: "POST",
      scope: "memory"
    }),
    action({
      baseVersion: memoryVersion,
      effect: "write",
      href: `/api/v1/presentations/${presentationId}/memory/${item.id}/evidence`,
      id: "link-memory-evidence",
      input: "memoryEvidenceLinkRequest",
      label: "Link memory evidence",
      method: "POST",
      scope: "memory"
    })
  ];

  if (item.status !== "retired") {
    actions.push(action({
      baseVersion: memoryVersion,
      effect: "write",
      href: `/api/v1/presentations/${presentationId}/memory/${item.id}/retire`,
      id: "retire-memory-item",
      input: "memoryStatusUpdateRequest",
      label: "Retire memory item",
      method: "POST",
      scope: "memory"
    }));
    actions.push(action({
      baseVersion: memoryVersion,
      effect: "candidate",
      href: `/api/v1/presentations/${presentationId}/memory/${item.id}/derive-slide`,
      id: "derive-slide-from-memory",
      input: "emptyRequest",
      label: "Derive slide from memory",
      links: {
        result: link(`/api/v1/presentations/${presentationId}/memory/${item.id}`)
      },
      method: "POST",
      scope: "memory"
    }));
  }

  return {
    resource: "memoryItem",
    version: API_VERSION,
    id: item.id,
    state: {
      baseVersion: memoryVersion,
      confidence: item.confidence,
      presentationId,
      status: item.status,
      type: item.type
    },
    memoryItem: item,
    links: memoryItemLinks(presentationId, item),
    actions
  };
}

function createMemoryEvidenceResource(presentationId: string, memoryId: string) {
  const item = getMemoryItem(memoryId, { presentationId });

  return {
    resource: "memoryEvidenceCollection",
    version: API_VERSION,
    id: `${item.id}-evidence`,
    state: {
      count: item.evidence.length,
      presentationId,
      memoryId: item.id
    },
    evidence: item.evidence,
    links: {
      self: link(`/api/v1/presentations/${presentationId}/memory/${item.id}/evidence`),
      memoryItem: link(`/api/v1/presentations/${presentationId}/memory/${item.id}`),
      presentation: link(`/api/v1/presentations/${presentationId}`)
    },
    actions: [
      action({
        baseVersion: getMemoryVersion(presentationId),
        effect: "write",
        href: `/api/v1/presentations/${presentationId}/memory/${item.id}/evidence`,
        id: "link-memory-evidence",
        input: "memoryEvidenceLinkRequest",
        label: "Link memory evidence",
        method: "POST",
        scope: "memory"
      })
    ]
  };
}

function createMemoryDependentSlidesResource(presentationId: string, memoryId: string) {
  const item = getMemoryItem(memoryId, { presentationId });
  const dependentSlides = item.usedBy.filter((entry: MemoryLink) => entry.rel === "slide");

  return {
    resource: "memoryDependentSlides",
    version: API_VERSION,
    id: `${item.id}-dependent-slides`,
    state: {
      count: dependentSlides.length,
      presentationId,
      memoryId: item.id
    },
    dependentSlides,
    links: {
      self: link(`/api/v1/presentations/${presentationId}/memory/${item.id}/dependent-slides`),
      memoryItem: link(`/api/v1/presentations/${presentationId}/memory/${item.id}`),
      presentation: link(`/api/v1/presentations/${presentationId}`)
    },
    actions: []
  };
}

function createCheckReportResource(presentationId: string) {
  const summary = readPresentationSummary(presentationId);
  const presentationVersion = getPresentationVersion(presentationId);

  return {
    resource: "checkReport",
    version: API_VERSION,
    id: `${presentationId}-checks`,
    state: {
      presentationId,
      baseVersion: presentationVersion,
      status: "not-run",
      title: summary.title
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/checks`),
      presentation: link(`/api/v1/presentations/${presentationId}`),
      findings: link("/api/v1/runtime"),
      remediationOptions: link(`/api/v1/presentations/${presentationId}/checks/remediation-options`),
      rerun: link("/api/v1/validate")
    },
    actions: [
      action({
        effect: "read",
        href: "/api/v1/validate",
        id: "run-validation",
        input: "validateDeckRequest",
        label: "Run validation",
        links: {
          diagnostics: link("/api/v1/runtime"),
          result: link(`/api/v1/presentations/${presentationId}/checks`)
        },
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createExportCollectionResource(presentationId: string) {
  const summary = readPresentationSummary(presentationId);
  const presentationVersion = getPresentationVersion(presentationId);

  return {
    resource: "exportCollection",
    version: API_VERSION,
    state: {
      presentationId,
      baseVersion: presentationVersion,
      title: summary.title
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/exports`),
      presentation: link(`/api/v1/presentations/${presentationId}`),
      pdfPreview: link("/api/v1/preview/deck"),
      present: link(`/present/${presentationId}`)
    },
    exports: [
      {
        id: "pdf",
        format: "pdf",
        links: {
          build: link("/api/v1/build"),
          preview: link("/api/v1/preview/deck")
        }
      }
    ],
    actions: [
      action({
        effect: "export",
        href: "/api/v1/build",
        id: "export-pdf",
        input: "emptyRequest",
        label: "Export PDF",
        links: {
          diagnostics: link("/api/v1/runtime"),
          result: link("/api/v1/preview/deck")
        },
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createCurrentJobResource(runtime: unknown = {}) {
  const runtimeRecord = asRecord(runtime);
  const workflow = runtimeRecord.workflow && typeof runtimeRecord.workflow === "object"
    ? asRecord(runtimeRecord.workflow)
    : null;
  const presentations = listPresentations();
  const activePresentationId = presentations.activePresentationId;
  const slideId = workflow && typeof workflow.slideId === "string" && workflow.slideId
    ? workflow.slideId
    : null;

  return {
    resource: "job",
    version: API_VERSION,
    id: "current",
    state: {
      active: Boolean(workflow && workflow.status && workflow.status !== "completed" && workflow.status !== "failed"),
      operation: workflow ? workflow.operation || "" : "",
      presentationId: activePresentationId,
      slideId,
      stage: workflow ? workflow.stage || "" : "",
      status: workflow ? workflow.status || "idle" : "idle",
      updatedAt: workflow ? workflow.updatedAt || "" : ""
    },
    progress: workflow || null,
    links: {
      self: link("/api/v1/jobs/current"),
      status: link("/api/v1/runtime"),
      logs: link("/api/v1/runtime"),
      diagnostics: link("/api/v1/runtime"),
      result: slideId
        ? link(`/api/v1/presentations/${activePresentationId}/slides/${slideId}`)
        : link(`/api/v1/presentations/${activePresentationId}`)
    },
    actions: []
  };
}

function createSlideCollectionResource(presentationId: string) {
  const presentation = createPresentationResource(presentationId);

  return {
    resource: "slideCollection",
    version: API_VERSION,
    state: {
      presentationId,
      count: presentation.slides.length,
      baseVersion: presentation.state.baseVersion
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides`),
      presentation: link(`/api/v1/presentations/${presentationId}`)
    },
    slides: presentation.slides,
    actions: [
      action({
        baseVersion: presentation.state.baseVersion,
        effect: "write",
        href: "/api/v1/slides/system",
        id: "create-system-slide",
        input: "createSystemSlideRequest",
        label: "Create slide",
        method: "POST",
        scope: "deck"
      })
    ]
  };
}

function createSlideResource(presentationId: string, slideId: string) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  const slideSpec = readSlideSpec(slideId, { presentationId });
  const variants = listVariantsForSlide(slideId) as JsonRecord[];
  const slideVersion = getSlideVersion(presentationId, slideId);
  const activeSlides = getSlides({ presentationId }) as JsonRecord[];
  const actions = [
    action({
      baseVersion: slideVersion,
      effect: "candidate",
      href: "/api/v1/operations/ideate-slide",
      id: "generate-wording-candidates",
      input: "slideWorkflowRequest",
      label: "Generate wording candidates",
      links: {
        diagnostics: link("/api/v1/runtime"),
        result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      },
      method: "POST",
      scope: "slide"
    }),
    action({
      baseVersion: slideVersion,
      effect: "candidate",
      href: "/api/v1/operations/ideate-structure",
      id: "generate-structure-candidates",
      input: "slideWorkflowRequest",
      label: "Generate structure candidates",
      links: {
        diagnostics: link("/api/v1/runtime"),
        result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      },
      method: "POST",
      scope: "slide"
    }),
    action({
      baseVersion: slideVersion,
      effect: "candidate",
      href: "/api/v1/operations/redo-layout",
      id: "generate-layout-candidates",
      input: "slideWorkflowRequest",
      label: "Generate layout candidates",
      links: {
        diagnostics: link("/api/v1/runtime"),
        result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      },
      method: "POST",
      scope: "slide"
    }),
    action({
      baseVersion: slideVersion,
      effect: "write",
      href: "/api/v1/operations/refine-narration",
      id: "refine-narration",
      input: "slideIdRequest",
      label: "Refine narration",
      links: {
        diagnostics: link("/api/v1/runtime"),
        result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      },
      method: "POST",
      scope: "slide"
    }),
    action({
      baseVersion: slideVersion,
      effect: "write",
      href: `/api/v1/slides/${slideId}/slide-spec`,
      id: "save-slide-spec",
      input: "slideSpecUpdateRequest",
      label: "Save slide spec",
      method: "POST",
      scope: "slide"
    }),
    action({
      effect: "read",
      href: "/api/v1/validate",
      id: "run-validation",
      input: "validateDeckRequest",
      label: "Run validation",
      links: {
        diagnostics: link("/api/v1/runtime")
      },
      method: "POST",
      scope: "slide"
    })
  ];

  if (variants.length) {
    actions.push(action({
      baseVersion: slideVersion,
      effect: "write",
      href: "/api/v1/variants/apply",
      id: "apply-candidate",
      input: "variantApplyRequest",
      label: "Apply candidate",
      links: {
        compare: link(`/api/v1/slides/${slideId}`),
        preview: link(`/api/v1/preview/slide/${slide.index}`)
      },
      method: "POST",
      scope: "candidate"
    }));
  }

  if (!slide.archived && activeSlides.length > 1) {
    actions.push(action({
      baseVersion: slideVersion,
      effect: "destructive",
      href: "/api/v1/slides/delete",
      id: "delete-slide",
      input: "slideIdRequest",
      label: "Delete slide",
      method: "POST",
      scope: "slide"
    }));
  }

  return {
    resource: "slide",
    version: API_VERSION,
    id: slideId,
    state: {
      archived: slide.archived,
      baseVersion: slideVersion,
      family: slideSpec.type || "unknown",
      index: slide.index,
      skipped: slide.skipped,
      validation: "unknown"
    },
    slide: {
      id: slide.id,
      index: slide.index,
      title: slide.title
    },
    slideSpec,
    variants,
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`),
      presentation: link(`/api/v1/presentations/${presentationId}`),
      preview: link(`/api/v1/preview/slide/${slide.index}`),
      spec: link(`/api/v1/slides/${slideId}`),
      checks: link("/api/v1/validate"),
      candidates: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates`),
      workflows: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/workflows`)
    },
    actions
  };
}

function createCandidateCollectionResource(presentationId: string, slideId: string) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  const slideVersion = getSlideVersion(presentationId, slideId);
  const variants = listVariantsForSlide(slideId) as JsonRecord[];

  return {
    resource: "candidateCollection",
    version: API_VERSION,
    state: {
      presentationId,
      slideId,
      count: variants.length,
      baseVersion: slideVersion
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates`),
      slide: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`),
      compare: link(`/api/v1/slides/${slideId}`),
      preview: link(`/api/v1/preview/slide/${slide.index}`)
    },
    candidates: variants.map((variant) => ({
      id: variant.id,
      operation: variant.operation || "",
      summary: variant.summary || "",
      title: variant.title || "",
      links: {
        self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates/${variant.id}`),
        compare: link(`/api/v1/slides/${slideId}`),
        preview: link(`/api/v1/preview/slide/${slide.index}`),
        applyTarget: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
      }
    })),
    actions: []
  };
}

function createCandidateResource(presentationId: string, slideId: string, candidateId: string) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId
  });
  const variant = (listVariantsForSlide(slideId) as JsonRecord[]).find((entry) => entry.id === candidateId);
  if (!variant) {
    throw new Error(`Unknown candidate: ${candidateId}`);
  }

  const slideVersion = getSlideVersion(presentationId, slideId);

  return {
    resource: "candidate",
    version: API_VERSION,
    id: candidateId,
    state: {
      presentationId,
      slideId,
      baseVersion: slideVersion
    },
    candidate: variant,
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates/${candidateId}`),
      candidates: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/candidates`),
      slide: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`),
      preview: link(`/api/v1/preview/slide/${slide.index}`),
      compare: link(`/api/v1/slides/${slideId}`),
      diagnostics: link("/api/v1/runtime"),
      applyTarget: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
    },
    actions: [
      action({
        baseVersion: slideVersion,
        effect: "write",
        href: "/api/v1/variants/apply",
        id: "apply-candidate",
        input: "variantApplyRequest",
        label: "Apply candidate",
        links: {
          compare: link(`/api/v1/slides/${slideId}`),
          preview: link(`/api/v1/preview/slide/${slide.index}`),
          result: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
        },
        method: "POST",
        scope: "candidate"
      })
    ]
  };
}

function createSlideWorkflowResource(presentationId: string, slideId: string) {
  const slide = createSlideResource(presentationId, slideId);

  return {
    resource: "slideWorkflowCollection",
    version: API_VERSION,
    state: {
      presentationId,
      slideId,
      baseVersion: slide.state.baseVersion
    },
    links: {
      self: link(`/api/v1/presentations/${presentationId}/slides/${slideId}/workflows`),
      slide: link(`/api/v1/presentations/${presentationId}/slides/${slideId}`)
    },
    actions: slide.actions.filter((entry) => entry.effect === "candidate")
  };
}

function createSchemaResource() {
  return {
    resource: "schemaCollection",
    version: API_VERSION,
    links: {
      self: link("/api/v1/schemas"),
      root: link("/api/v1")
    },
    schemas: (Object.keys(inputSchemas) as InputSchemaId[]).sort().map((id) => ({
      id,
      fields: inputSchemas[id].fields
    }))
  };
}

export {
  assertBaseVersion,
  createApiRootResource,
  createCandidateCollectionResource,
  createCandidateResource,
  createCheckReportResource,
  createCurrentJobResource,
  createExportCollectionResource,
  createDerivedSlidesetCollectionResource,
  createMemoryCollectionResource,
  createMemoryDependentSlidesResource,
  createMemoryEvidenceResource,
  createMemoryItemResource,
  createPresentationCollectionResource,
  createPresentationResource,
  createSchemaResource,
  createSlideCollectionResource,
  createSlideResource,
  createSlideWorkflowResource,
  getPresentationVersion,
  getMemoryVersion,
  getSlideVersion
};
