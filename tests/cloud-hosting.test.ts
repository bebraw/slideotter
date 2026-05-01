const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertCloudId,
  createCloudArtifactRef,
  createCloudJobRecord,
  createCloudObjectKey,
  createCloudPresentationStoragePlan,
  createCloudSlideRecord,
  createCloudStorageAdapter,
  createCloudWorkspaceRecord,
  presentationPrefix
} = require("../studio/server/services/cloud-hosting.ts");

type SqlValue = string | number | null;

type StoredObject = {
  contentType: string | null;
  value: string;
};

class FakeR2Object {
  private readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  async text(): Promise<string> {
    return this.value;
  }
}

class FakeR2Bucket {
  readonly objects = new Map<string, StoredObject>();

  async get(key: string): Promise<FakeR2Object | null> {
    const object = this.objects.get(key);
    return object ? new FakeR2Object(object.value) : null;
  }

  async put(key: string, value: string, options: { httpMetadata?: { contentType?: string } } = {}): Promise<void> {
    this.objects.set(key, {
      contentType: options.httpMetadata?.contentType || null,
      value
    });
  }
}

class FakeD1PreparedStatement {
  private values: SqlValue[] = [];
  private readonly db: FakeD1Database;
  private readonly query: string;

  constructor(
    db: FakeD1Database,
    query: string
  ) {
    this.db = db;
    this.query = query;
  }

  bind(...values: SqlValue[]): FakeD1PreparedStatement {
    this.values = values;
    return this;
  }

  async run(): Promise<void> {
    this.db.run(this.query, this.values);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.first(this.query, this.values) as T | null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return {
      results: this.db.all(this.query, this.values) as T[]
    };
  }
}

class FakeD1Database {
  readonly jobs = new Map<string, Record<string, unknown>>();
  readonly presentations = new Map<string, Record<string, unknown>>();
  readonly slides = new Map<string, Record<string, unknown>>();
  readonly workspaces = new Map<string, Record<string, unknown>>();

  prepare(query: string): FakeD1PreparedStatement {
    return new FakeD1PreparedStatement(this, query);
  }

  run(query: string, values: SqlValue[]): void {
    if (query.includes("INTO workspaces")) {
      this.workspaces.set(String(values[0]), {
        id: values[0],
        name: values[1],
        created_at: values[2],
        updated_at: values[3]
      });
      return;
    }

    if (query.includes("INTO presentations")) {
      this.presentations.set(`${values[1]}:${values[0]}`, {
        id: values[0],
        workspace_id: values[1],
        title: values[2],
        latest_version: values[3],
        r2_prefix: values[4],
        created_at: values[5],
        updated_at: values[6]
      });
      return;
    }

    if (query.includes("INTO slides")) {
      this.slides.set(`${values[1]}:${values[2]}:${values[0]}`, {
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        order_index: values[3],
        title: values[4],
        version: values[5],
        spec_object_key: values[6]
      });
      return;
    }

    if (query.includes("INTO jobs")) {
      this.jobs.set(`${values[1]}:${values[2]}:${values[0]}`, {
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        kind: values[3],
        status: values[4],
        created_at: values[5],
        updated_at: values[6]
      });
      return;
    }

    throw new Error(`Unsupported fake D1 run query: ${query}`);
  }

  first(query: string, values: SqlValue[]): Record<string, unknown> | null {
    if (query.includes("FROM workspaces")) {
      return this.workspaces.get(String(values[0])) || null;
    }

    if (query.includes("FROM presentations")) {
      return this.presentations.get(`${values[0]}:${values[1]}`) || null;
    }

    if (query.includes("FROM slides")) {
      return this.slides.get(`${values[0]}:${values[1]}:${values[2]}`) || null;
    }

    throw new Error(`Unsupported fake D1 first query: ${query}`);
  }

  all(query: string, values: SqlValue[]): Record<string, unknown>[] {
    if (query.includes("FROM jobs")) {
      const prefix = `${values[0]}:${values[1]}:`;
      return Array.from(this.jobs.entries())
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]) => value);
    }

    throw new Error(`Unsupported fake D1 all query: ${query}`);
  }
}

test("cloud hosting ids and R2 prefixes are stable and workspace-scoped", () => {
  const workspace = createCloudWorkspaceRecord("team-alpha", "Team Alpha", "2026-05-01T00:00:00.000Z");
  assert.deepEqual(workspace, {
    createdAt: "2026-05-01T00:00:00.000Z",
    id: "team-alpha",
    name: "Team Alpha",
    updatedAt: "2026-05-01T00:00:00.000Z"
  });

  assert.equal(
    presentationPrefix("team-alpha", "quarterly-review"),
    "workspaces/team-alpha/presentations/quarterly-review"
  );

  const plan = createCloudPresentationStoragePlan({
    createdAt: "2026-05-01T00:00:00.000Z",
    presentationId: "quarterly-review",
    title: "Quarterly Review",
    workspaceId: "team-alpha"
  });

  assert.equal(plan.presentation.workspaceId, "team-alpha");
  assert.equal(plan.presentation.r2Prefix, "workspaces/team-alpha/presentations/quarterly-review");
  assert.equal(plan.manifestKey, "workspaces/team-alpha/presentations/quarterly-review/presentation.json");
  assert.equal(plan.deckContextKey, "workspaces/team-alpha/presentations/quarterly-review/state/deck-context.json");
  assert.equal(plan.sourcesKey, "workspaces/team-alpha/presentations/quarterly-review/state/sources.json");
  assert.equal(plan.slidesPrefix, "workspaces/team-alpha/presentations/quarterly-review/slides");
  assert.equal(plan.artifactsPrefix, "workspaces/team-alpha/presentations/quarterly-review/artifacts");
});

test("cloud slide and artifact records separate D1 metadata from R2 objects", () => {
  const slide = createCloudSlideRecord({
    orderIndex: 2,
    presentationId: "quarterly-review",
    slideId: "slide-03",
    title: "Pipeline",
    version: 4,
    workspaceId: "team-alpha"
  });

  assert.deepEqual(slide, {
    id: "slide-03",
    orderIndex: 2,
    presentationId: "quarterly-review",
    specObjectKey: "workspaces/team-alpha/presentations/quarterly-review/slides/slide-03.json",
    title: "Pipeline",
    version: 4,
    workspaceId: "team-alpha"
  });

  const artifact = createCloudArtifactRef({
    contentType: "application/pdf",
    fileName: "quarterly-review.pdf",
    kind: "export",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  });

  assert.equal(artifact.objectKey, "workspaces/team-alpha/presentations/quarterly-review/artifacts/export/quarterly-review.pdf");
  assert.equal(artifact.contentType, "application/pdf");
});

test("cloud jobs carry workspace, presentation, kind, and status metadata", () => {
  const job = createCloudJobRecord({
    createdAt: "2026-05-01T00:00:00.000Z",
    jobId: "export-01",
    kind: "export",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  });

  assert.deepEqual(job, {
    createdAt: "2026-05-01T00:00:00.000Z",
    id: "export-01",
    kind: "export",
    presentationId: "quarterly-review",
    status: "queued",
    updatedAt: "2026-05-01T00:00:00.000Z",
    workspaceId: "team-alpha"
  });
});

test("cloud hosting rejects unsafe ids and object key parts", () => {
  assert.throws(() => assertCloudId("../escape", "workspace id"), /Invalid workspace id/);
  assert.throws(() => createCloudObjectKey(["workspaces", "../escape"]), /Invalid cloud object key part/);
  assert.throws(() => createCloudArtifactRef({
    contentType: "image/png",
    fileName: "../secret.png",
    kind: "material",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  }), /Invalid cloud artifact file name/);
});

test("cloud storage adapter persists workspace and presentation metadata through D1", async () => {
  const metadataDb = new FakeD1Database();
  const objectBucket = new FakeR2Bucket();
  const storage = createCloudStorageAdapter({ metadataDb, objectBucket });
  const workspace = createCloudWorkspaceRecord("team-alpha", "Team Alpha", "2026-05-01T00:00:00.000Z");
  const plan = createCloudPresentationStoragePlan({
    createdAt: "2026-05-01T00:00:00.000Z",
    presentationId: "quarterly-review",
    title: "Quarterly Review",
    workspaceId: "team-alpha"
  });

  await storage.saveWorkspace(workspace);
  await storage.savePresentationPlan(plan);

  assert.deepEqual(await storage.getWorkspace("team-alpha"), workspace);
  assert.deepEqual(await storage.getPresentation("team-alpha", "quarterly-review"), plan.presentation);
  assert.equal(objectBucket.objects.get(plan.manifestKey)?.contentType, "application/json");
  assert.equal(objectBucket.objects.get(plan.deckContextKey)?.contentType, "application/json");
  assert.equal(objectBucket.objects.get(plan.sourcesKey)?.contentType, "application/json");
});

test("cloud storage adapter stores slide specs in R2 and slide indexes in D1", async () => {
  const metadataDb = new FakeD1Database();
  const objectBucket = new FakeR2Bucket();
  const storage = createCloudStorageAdapter({ metadataDb, objectBucket });
  const spec = {
    title: "Pipeline",
    type: "content"
  };

  const slide = await storage.saveSlideSpec({
    orderIndex: 2,
    presentationId: "quarterly-review",
    slideId: "slide-03",
    spec,
    title: "Pipeline",
    workspaceId: "team-alpha"
  });

  assert.equal(slide.specObjectKey, "workspaces/team-alpha/presentations/quarterly-review/slides/slide-03.json");
  assert.deepEqual(await storage.readSlideSpec("team-alpha", "quarterly-review", "slide-03"), spec);
  assert.equal(await storage.readSlideSpec("team-alpha", "quarterly-review", "slide-04"), null);
});

test("cloud storage adapter stores queued job metadata in D1", async () => {
  const metadataDb = new FakeD1Database();
  const objectBucket = new FakeR2Bucket();
  const storage = createCloudStorageAdapter({ metadataDb, objectBucket });
  const job = createCloudJobRecord({
    createdAt: "2026-05-01T00:00:00.000Z",
    jobId: "validation-01",
    kind: "validation",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  });

  await storage.createJob(job);

  assert.deepEqual(await storage.listJobs("team-alpha", "quarterly-review"), [job]);
});
