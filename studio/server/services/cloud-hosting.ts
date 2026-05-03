type CloudRecord = Record<string, unknown>;

type CloudArtifactKind = "archive" | "bundle" | "export" | "material" | "preview" | "slide-spec" | "source";
type CloudJobKind = "export" | "generation" | "import" | "validation";
type CloudJobStatus = "queued" | "running" | "completed" | "failed";
type CloudSqlValue = string | number | null;

type CloudWorkspaceRecord = {
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
};

type CloudPresentationRecord = {
  createdAt: string;
  id: string;
  latestVersion: number;
  r2Prefix: string;
  title: string;
  updatedAt: string;
  workspaceId: string;
};

type CloudSlideRecord = {
  id: string;
  orderIndex: number;
  presentationId: string;
  specObjectKey: string;
  title: string;
  version: number;
  workspaceId: string;
};

type CloudArtifactRef = {
  contentType: string;
  kind: CloudArtifactKind;
  objectKey: string;
  presentationId: string;
  workspaceId: string;
};

type CloudJobRecord = {
  createdAt: string;
  id: string;
  kind: CloudJobKind;
  presentationId: string;
  status: CloudJobStatus;
  updatedAt: string;
  workspaceId: string;
};

type CloudPresentationStoragePlan = {
  artifactsPrefix: string;
  deckContextKey: string;
  manifestKey: string;
  presentation: CloudPresentationRecord;
  slidesPrefix: string;
  sourcesKey: string;
};

type CreateCloudPresentationStoragePlanOptions = {
  createdAt?: string;
  presentationId: string;
  title: string;
  workspaceId: string;
};

type CreateCloudSlideRecordOptions = {
  orderIndex: number;
  presentationId: string;
  slideId: string;
  title: string;
  version?: number;
  workspaceId: string;
};

type CreateCloudArtifactRefOptions = {
  contentType: string;
  fileName: string;
  kind: CloudArtifactKind;
  presentationId: string;
  workspaceId: string;
};

type CreateCloudJobRecordOptions = {
  createdAt?: string;
  jobId: string;
  kind: CloudJobKind;
  presentationId: string;
  status?: CloudJobStatus;
  workspaceId: string;
};

type SaveCloudSlideSpecOptions = CreateCloudSlideRecordOptions & {
  spec: unknown;
};

type CloudD1ResultSet<T> = {
  results: T[];
};

type CloudD1PreparedStatement = {
  all<T = CloudRecord>(): Promise<CloudD1ResultSet<T>>;
  bind(...values: CloudSqlValue[]): CloudD1PreparedStatement;
  first<T = CloudRecord>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type CloudD1Database = {
  prepare(query: string): CloudD1PreparedStatement;
};

type CloudR2PutOptions = {
  httpMetadata?: {
    contentType?: string;
  };
};

type CloudR2ObjectBody = {
  text(): Promise<string>;
};

type CloudR2Bucket = {
  get(key: string): Promise<CloudR2ObjectBody | null>;
  put(key: string, value: string, options?: CloudR2PutOptions): Promise<unknown>;
};

type CloudStorageBindings = {
  metadataDb: CloudD1Database;
  objectBucket: CloudR2Bucket;
};

const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const safeFilePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function assertCloudId(value: unknown, label: string): string {
  const id = String(value || "").trim();
  if (!idPattern.test(id)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return id;
}

function assertSafeFileName(value: unknown): string {
  const fileName = String(value || "").trim();
  if (!safeFilePattern.test(fileName)) {
    throw new Error(`Invalid cloud artifact file name: ${value}`);
  }

  return fileName;
}

function assertPositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return Number(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function presentationPrefix(workspaceIdInput: unknown, presentationIdInput: unknown): string {
  const workspaceId = assertCloudId(workspaceIdInput, "workspace id");
  const presentationId = assertCloudId(presentationIdInput, "presentation id");
  return `workspaces/${workspaceId}/presentations/${presentationId}`;
}

function createCloudObjectKey(parts: string[]): string {
  if (!parts.length) {
    throw new Error("Cloud object key needs at least one part");
  }

  return parts
    .map((part: string) => {
      const trimmed = part.trim();
      if (!trimmed || trimmed.includes("..") || trimmed.includes("//") || trimmed.startsWith("/") || trimmed.endsWith("/")) {
        throw new Error(`Invalid cloud object key part: ${part}`);
      }
      return trimmed;
    })
    .join("/");
}

function createCloudWorkspaceRecord(workspaceIdInput: unknown, nameInput: unknown, createdAtInput?: string): CloudWorkspaceRecord {
  const createdAt = createdAtInput || nowIso();
  return {
    createdAt,
    id: assertCloudId(workspaceIdInput, "workspace id"),
    name: String(nameInput || "").trim() || "Untitled workspace",
    updatedAt: createdAt
  };
}

function createCloudPresentationStoragePlan(options: CreateCloudPresentationStoragePlanOptions): CloudPresentationStoragePlan {
  const workspaceId = assertCloudId(options.workspaceId, "workspace id");
  const presentationId = assertCloudId(options.presentationId, "presentation id");
  const createdAt = options.createdAt || nowIso();
  const rootPrefix = presentationPrefix(workspaceId, presentationId);

  return {
    artifactsPrefix: createCloudObjectKey([rootPrefix, "artifacts"]),
    deckContextKey: createCloudObjectKey([rootPrefix, "state", "deck-context.json"]),
    manifestKey: createCloudObjectKey([rootPrefix, "presentation.json"]),
    presentation: {
      createdAt,
      id: presentationId,
      latestVersion: 1,
      r2Prefix: rootPrefix,
      title: String(options.title || "").trim() || "Untitled presentation",
      updatedAt: createdAt,
      workspaceId
    },
    slidesPrefix: createCloudObjectKey([rootPrefix, "slides"]),
    sourcesKey: createCloudObjectKey([rootPrefix, "state", "sources.json"])
  };
}

function createCloudSlideRecord(options: CreateCloudSlideRecordOptions): CloudSlideRecord {
  const workspaceId = assertCloudId(options.workspaceId, "workspace id");
  const presentationId = assertCloudId(options.presentationId, "presentation id");
  const slideId = assertCloudId(options.slideId, "slide id");
  const version = assertPositiveInteger(options.version ?? 1, "slide version");

  return {
    id: slideId,
    orderIndex: assertPositiveInteger(options.orderIndex, "slide order index"),
    presentationId,
    specObjectKey: createCloudObjectKey([
      presentationPrefix(workspaceId, presentationId),
      "slides",
      `${slideId}.json`
    ]),
    title: String(options.title || "").trim() || slideId,
    version,
    workspaceId
  };
}

function createCloudArtifactRef(options: CreateCloudArtifactRefOptions): CloudArtifactRef {
  const workspaceId = assertCloudId(options.workspaceId, "workspace id");
  const presentationId = assertCloudId(options.presentationId, "presentation id");
  const fileName = assertSafeFileName(options.fileName);

  return {
    contentType: String(options.contentType || "").trim() || "application/octet-stream",
    kind: options.kind,
    objectKey: createCloudObjectKey([
      presentationPrefix(workspaceId, presentationId),
      "artifacts",
      options.kind,
      fileName
    ]),
    presentationId,
    workspaceId
  };
}

function createCloudJobRecord(options: CreateCloudJobRecordOptions): CloudJobRecord {
  const createdAt = options.createdAt || nowIso();
  return {
    createdAt,
    id: assertCloudId(options.jobId, "job id"),
    kind: options.kind,
    presentationId: assertCloudId(options.presentationId, "presentation id"),
    status: options.status || "queued",
    updatedAt: createdAt,
    workspaceId: assertCloudId(options.workspaceId, "workspace id")
  };
}

function cloudRecordFromJson(value: unknown): CloudRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as CloudRecord : {};
}

function readStringField(row: CloudRecord, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function readNumberField(row: CloudRecord, key: string): number {
  const value = row[key];
  return typeof value === "number" ? value : Number(value || 0);
}

function normalizeWorkspaceRow(row: CloudRecord): CloudWorkspaceRecord {
  return {
    createdAt: readStringField(row, "created_at"),
    id: readStringField(row, "id"),
    name: readStringField(row, "name"),
    updatedAt: readStringField(row, "updated_at")
  };
}

function normalizePresentationRow(row: CloudRecord): CloudPresentationRecord {
  return {
    createdAt: readStringField(row, "created_at"),
    id: readStringField(row, "id"),
    latestVersion: readNumberField(row, "latest_version"),
    r2Prefix: readStringField(row, "r2_prefix"),
    title: readStringField(row, "title"),
    updatedAt: readStringField(row, "updated_at"),
    workspaceId: readStringField(row, "workspace_id")
  };
}

function normalizeJobRow(row: CloudRecord): CloudJobRecord {
  return {
    createdAt: readStringField(row, "created_at"),
    id: readStringField(row, "id"),
    kind: readStringField(row, "kind") as CloudJobKind,
    presentationId: readStringField(row, "presentation_id"),
    status: readStringField(row, "status") as CloudJobStatus,
    updatedAt: readStringField(row, "updated_at"),
    workspaceId: readStringField(row, "workspace_id")
  };
}

function formatJsonObject(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseJsonObject(text: string): unknown {
  return JSON.parse(text);
}

function createCloudStorageAdapter(bindings: CloudStorageBindings) {
  const { metadataDb, objectBucket } = bindings;

  async function saveWorkspace(record: CloudWorkspaceRecord): Promise<CloudWorkspaceRecord> {
    await metadataDb.prepare(`
      INSERT OR REPLACE INTO workspaces (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).bind(record.id, record.name, record.createdAt, record.updatedAt).run();

    return record;
  }

  async function getWorkspace(workspaceIdInput: unknown): Promise<CloudWorkspaceRecord | null> {
    const workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    const row = await metadataDb.prepare(`
      SELECT id, name, created_at, updated_at
      FROM workspaces
      WHERE id = ?
    `).bind(workspaceId).first<CloudRecord>();

    return row ? normalizeWorkspaceRow(row) : null;
  }

  async function savePresentationPlan(plan: CloudPresentationStoragePlan): Promise<CloudPresentationRecord> {
    const { presentation } = plan;
    await objectBucket.put(plan.manifestKey, formatJsonObject({
      id: presentation.id,
      title: presentation.title,
      workspaceId: presentation.workspaceId
    }), {
      httpMetadata: { contentType: "application/json" }
    });
    await objectBucket.put(plan.deckContextKey, formatJsonObject({
      deck: {
        title: presentation.title
      },
      slides: {}
    }), {
      httpMetadata: { contentType: "application/json" }
    });
    await objectBucket.put(plan.sourcesKey, formatJsonObject({
      sources: []
    }), {
      httpMetadata: { contentType: "application/json" }
    });

    await metadataDb.prepare(`
      INSERT OR REPLACE INTO presentations (
        id, workspace_id, title, latest_version, r2_prefix, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      presentation.id,
      presentation.workspaceId,
      presentation.title,
      presentation.latestVersion,
      presentation.r2Prefix,
      presentation.createdAt,
      presentation.updatedAt
    ).run();

    return presentation;
  }

  async function getPresentation(workspaceIdInput: unknown, presentationIdInput: unknown): Promise<CloudPresentationRecord | null> {
    const workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    const presentationId = assertCloudId(presentationIdInput, "presentation id");
    const row = await metadataDb.prepare(`
      SELECT id, workspace_id, title, latest_version, r2_prefix, created_at, updated_at
      FROM presentations
      WHERE workspace_id = ? AND id = ?
    `).bind(workspaceId, presentationId).first<CloudRecord>();

    return row ? normalizePresentationRow(row) : null;
  }

  async function saveSlideSpec(options: SaveCloudSlideSpecOptions): Promise<CloudSlideRecord> {
    const slide = createCloudSlideRecord(options);
    await objectBucket.put(slide.specObjectKey, formatJsonObject(options.spec), {
      httpMetadata: { contentType: "application/json" }
    });
    await metadataDb.prepare(`
      INSERT OR REPLACE INTO slides (
        id, workspace_id, presentation_id, order_index, title, version, spec_object_key
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      slide.id,
      slide.workspaceId,
      slide.presentationId,
      slide.orderIndex,
      slide.title,
      slide.version,
      slide.specObjectKey
    ).run();

    return slide;
  }

  async function readSlideSpec(workspaceIdInput: unknown, presentationIdInput: unknown, slideIdInput: unknown): Promise<unknown | null> {
    const workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    const presentationId = assertCloudId(presentationIdInput, "presentation id");
    const slideId = assertCloudId(slideIdInput, "slide id");
    const row = await metadataDb.prepare(`
      SELECT spec_object_key
      FROM slides
      WHERE workspace_id = ? AND presentation_id = ? AND id = ?
    `).bind(workspaceId, presentationId, slideId).first<CloudRecord>();

    if (!row) {
      return null;
    }

    const objectKey = readStringField(row, "spec_object_key");
    const object = await objectBucket.get(objectKey);
    return object ? parseJsonObject(await object.text()) : null;
  }

  async function createJob(record: CloudJobRecord): Promise<CloudJobRecord> {
    await metadataDb.prepare(`
      INSERT OR REPLACE INTO jobs (
        id, workspace_id, presentation_id, kind, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.id,
      record.workspaceId,
      record.presentationId,
      record.kind,
      record.status,
      record.createdAt,
      record.updatedAt
    ).run();

    return record;
  }

  async function listJobs(workspaceIdInput: unknown, presentationIdInput: unknown): Promise<CloudJobRecord[]> {
    const workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    const presentationId = assertCloudId(presentationIdInput, "presentation id");
    const rows = await metadataDb.prepare(`
      SELECT id, workspace_id, presentation_id, kind, status, created_at, updated_at
      FROM jobs
      WHERE workspace_id = ? AND presentation_id = ?
      ORDER BY created_at DESC
    `).bind(workspaceId, presentationId).all<CloudRecord>();

    return rows.results.map(normalizeJobRow);
  }

  return {
    createJob,
    getPresentation,
    getWorkspace,
    listJobs,
    readSlideSpec,
    savePresentationPlan,
    saveSlideSpec,
    saveWorkspace
  };
}

export {
  assertCloudId,
  cloudRecordFromJson,
  createCloudStorageAdapter,
  createCloudArtifactRef,
  createCloudJobRecord,
  createCloudObjectKey,
  createCloudPresentationStoragePlan,
  createCloudSlideRecord,
  createCloudWorkspaceRecord,
  presentationPrefix
};