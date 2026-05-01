type CloudRecord = Record<string, unknown>;

type CloudResourceId = {
  value: string;
};

type CloudArtifactKind = "archive" | "bundle" | "export" | "material" | "preview" | "slide-spec" | "source";
type CloudJobKind = "export" | "generation" | "import" | "validation";
type CloudJobStatus = "queued" | "running" | "completed" | "failed";

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

module.exports = {
  assertCloudId,
  cloudRecordFromJson,
  createCloudArtifactRef,
  createCloudJobRecord,
  createCloudObjectKey,
  createCloudPresentationStoragePlan,
  createCloudSlideRecord,
  createCloudWorkspaceRecord,
  presentationPrefix
};
