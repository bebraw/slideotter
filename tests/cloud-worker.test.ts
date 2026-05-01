const assert = require("node:assert/strict");
const test = require("node:test");

type Link = {
  href: string;
};

type SqlValue = string | number | null;

type WorkerModule = {
  default: {
    fetch(request: Request, env: {
      ASSETS: {
        fetch(request: Request): Promise<Response>;
      };
      SLIDEOTTER_METADATA_DB?: {
        prepare(query: string): {
          all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
          bind(...values: SqlValue[]): {
            all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
            first<T = Record<string, unknown>>(): Promise<T | null>;
            run(): Promise<unknown>;
          };
          first<T = Record<string, unknown>>(): Promise<T | null>;
          run(): Promise<unknown>;
        };
      };
      SLIDEOTTER_OBJECT_BUCKET?: {
        get(key: string): Promise<{ text(): Promise<string> } | null>;
        put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
      };
      SLIDEOTTER_CLOUD_ADMIN_TOKEN?: string;
      SLIDEOTTER_JOBS_QUEUE?: {
        send(message: unknown): Promise<unknown>;
      };
    }): Promise<Response> | Response;
  };
};

const worker = require("../cloud/worker.ts") as WorkerModule;

class FakePreparedStatement {
  private values: SqlValue[] = [];
  private readonly db: FakeMetadataDb;
  private readonly query: string;

  constructor(db: FakeMetadataDb, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...values: SqlValue[]): FakePreparedStatement {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return {
      results: this.db.all(this.query, this.values) as T[]
    };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.first(this.query, this.values) as T | null;
  }

  async run(): Promise<void> {
    this.db.run(this.query, this.values);
  }
}

class FakeMetadataDb {
  readonly jobs: Record<string, unknown>[];
  readonly materials: Record<string, unknown>[];
  readonly presentations: Record<string, unknown>[];
  readonly slides: Record<string, unknown>[];
  readonly sources: Record<string, unknown>[];
  readonly workspaces: Record<string, unknown>[];

  constructor(
    workspaces: Record<string, unknown>[],
    presentations: Record<string, unknown>[],
    slides: Record<string, unknown>[] = [],
    jobs: Record<string, unknown>[] = [],
    sources: Record<string, unknown>[] = [],
    materials: Record<string, unknown>[] = []
  ) {
    this.jobs = jobs;
    this.materials = materials;
    this.presentations = presentations;
    this.slides = slides;
    this.sources = sources;
    this.workspaces = workspaces;
  }

  prepare(query: string): FakePreparedStatement {
    return new FakePreparedStatement(this, query);
  }

  all(query: string, values: SqlValue[]): Record<string, unknown>[] {
    if (query.includes("FROM workspaces")) {
      return this.workspaces;
    }

    if (query.includes("FROM presentations")) {
      return this.presentations.filter((presentation) => presentation.workspace_id === values[0]);
    }

    if (query.includes("FROM slides")) {
      return this.slides.filter((slide) => slide.workspace_id === values[0] && slide.presentation_id === values[1]);
    }

    if (query.includes("FROM jobs")) {
      return this.jobs.filter((job) => job.workspace_id === values[0] && job.presentation_id === values[1]);
    }

    if (query.includes("FROM sources")) {
      return this.sources.filter((source) => source.workspace_id === values[0] && source.presentation_id === values[1]);
    }

    if (query.includes("FROM materials")) {
      return this.materials.filter((material) => material.workspace_id === values[0] && material.presentation_id === values[1]);
    }

    throw new Error(`Unsupported fake query: ${query}`);
  }

  first(query: string, values: SqlValue[]): Record<string, unknown> | null {
    if (query.includes("FROM slides")) {
      return this.slides.find((slide) => slide.workspace_id === values[0] && slide.presentation_id === values[1] && slide.id === values[2]) || null;
    }

    if (query.includes("FROM sources")) {
      return this.sources.find((source) => source.workspace_id === values[0] && source.presentation_id === values[1] && source.id === values[2]) || null;
    }

    if (query.includes("FROM materials")) {
      return this.materials.find((material) => material.workspace_id === values[0] && material.presentation_id === values[1] && material.id === values[2]) || null;
    }

    throw new Error(`Unsupported fake first query: ${query}`);
  }

  run(query: string, values: SqlValue[]): void {
    if (query.includes("INTO workspaces")) {
      this.workspaces.push({
        created_at: values[2],
        id: values[0],
        name: values[1],
        updated_at: values[3]
      });
      return;
    }

    if (query.includes("INTO presentations")) {
      this.presentations.push({
        created_at: values[5],
        id: values[0],
        latest_version: values[3],
        r2_prefix: values[4],
        title: values[2],
        updated_at: values[6],
        workspace_id: values[1]
      });
      return;
    }

    if (query.includes("INTO slides")) {
      const existingIndex = this.slides.findIndex((slide) => slide.workspace_id === values[1] && slide.presentation_id === values[2] && slide.id === values[0]);
      const nextSlide = {
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        order_index: values[3],
        title: values[4],
        version: values[5],
        spec_object_key: values[6]
      };
      if (existingIndex >= 0) {
        this.slides[existingIndex] = nextSlide;
      } else {
        this.slides.push(nextSlide);
      }
      return;
    }

    if (query.includes("INTO jobs")) {
      this.jobs.push({
        created_at: values[5],
        id: values[0],
        kind: values[3],
        presentation_id: values[2],
        status: values[4],
        updated_at: values[6],
        workspace_id: values[1]
      });
      return;
    }

    if (query.includes("INTO sources")) {
      this.sources.push({
        created_at: values[7],
        id: values[0],
        object_key: values[6],
        presentation_id: values[2],
        source_type: values[4],
        title: values[3],
        updated_at: values[8],
        url: values[5],
        workspace_id: values[1]
      });
      return;
    }

    if (query.includes("INTO materials")) {
      this.materials.push({
        created_at: values[7],
        file_name: values[5],
        id: values[0],
        media_type: values[4],
        object_key: values[6],
        presentation_id: values[2],
        title: values[3],
        updated_at: values[8],
        workspace_id: values[1]
      });
      return;
    }

    throw new Error(`Unsupported fake run query: ${query}`);
  }
}

class FakeQueue {
  readonly messages: unknown[] = [];

  async send(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

class FakeObjectBucket {
  readonly objects = new Map<string, string>();

  async get(key: string): Promise<{ text(): Promise<string> } | null> {
    const value = this.objects.get(key);
    return value === undefined
      ? null
      : {
          async text(): Promise<string> {
            return value;
          }
        };
  }

  async put(key: string, value: string): Promise<void> {
    this.objects.set(key, value);
  }
}

function createEnv() {
  return {
    ASSETS: {
      async fetch(request: Request): Promise<Response> {
        return new Response(`asset:${new URL(request.url).pathname}`);
      }
    }
  };
}

function createBoundEnv() {
  const objectBucket = new FakeObjectBucket();
  objectBucket.objects.set("workspaces/team-alpha/presentations/quarterly-review/slides/slide-01.json", `${JSON.stringify({
    title: "Intro",
    type: "cover"
  }, null, 2)}\n`);
  objectBucket.objects.set("workspaces/team-alpha/presentations/quarterly-review/sources/source-01.json", `${JSON.stringify({
    id: "source-01",
    presentationId: "quarterly-review",
    text: "Revenue grew 20%.",
    title: "Revenue note",
    type: "note",
    url: null,
    workspaceId: "team-alpha"
  }, null, 2)}\n`);
  objectBucket.objects.set("workspaces/team-alpha/presentations/quarterly-review/materials/material-01.json", `${JSON.stringify({
    alt: "Revenue chart",
    dataBase64: "aGVsbG8=",
    fileName: "revenue.png",
    id: "material-01",
    mediaType: "image/png",
    presentationId: "quarterly-review",
    title: "Revenue chart",
    workspaceId: "team-alpha"
  }, null, 2)}\n`);
  return createBoundEnvWithStorage(new FakeMetadataDb([
    {
      created_at: "2026-05-01T00:00:00.000Z",
      id: "team-alpha",
      name: "Team Alpha",
      updated_at: "2026-05-01T00:00:00.000Z"
    }
  ], [
    {
      created_at: "2026-05-01T00:00:00.000Z",
      id: "quarterly-review",
      latest_version: 3,
      r2_prefix: "workspaces/team-alpha/presentations/quarterly-review",
      title: "Quarterly Review",
      updated_at: "2026-05-01T00:00:00.000Z",
      workspace_id: "team-alpha"
    }
  ], [
    {
      id: "slide-01",
      order_index: 0,
      presentation_id: "quarterly-review",
      spec_object_key: "workspaces/team-alpha/presentations/quarterly-review/slides/slide-01.json",
      title: "Intro",
      version: 2,
      workspace_id: "team-alpha"
    }
  ], [], [
    {
      created_at: "2026-05-01T00:00:00.000Z",
      id: "source-01",
      object_key: "workspaces/team-alpha/presentations/quarterly-review/sources/source-01.json",
      presentation_id: "quarterly-review",
      source_type: "note",
      title: "Revenue note",
      updated_at: "2026-05-01T00:00:00.000Z",
      url: null,
      workspace_id: "team-alpha"
    }
  ], [
    {
      created_at: "2026-05-01T00:00:00.000Z",
      file_name: "revenue.png",
      id: "material-01",
      media_type: "image/png",
      object_key: "workspaces/team-alpha/presentations/quarterly-review/materials/material-01.json",
      presentation_id: "quarterly-review",
      title: "Revenue chart",
      updated_at: "2026-05-01T00:00:00.000Z",
      workspace_id: "team-alpha"
    }
  ]), objectBucket);
}

function createBoundEnvWithStorage(metadataDb: FakeMetadataDb, objectBucket: FakeObjectBucket) {
  return createBoundEnvWithStorageAndQueue(metadataDb, objectBucket, undefined);
}

function createBoundEnvWithStorageAndQueue(metadataDb: FakeMetadataDb, objectBucket: FakeObjectBucket, jobsQueue: FakeQueue | undefined) {
  return {
    ...createEnv(),
    SLIDEOTTER_CLOUD_ADMIN_TOKEN: "secret-token",
    ...(jobsQueue ? { SLIDEOTTER_JOBS_QUEUE: jobsQueue } : {}),
    SLIDEOTTER_METADATA_DB: metadataDb,
    SLIDEOTTER_OBJECT_BUCKET: objectBucket
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

function requireLink(links: Record<string, Link>, rel: string): Link {
  const link = links[rel];
  if (!link) {
    throw new Error(`Expected cloud API link: ${rel}`);
  }
  return link;
}

function requireFirst<T>(values: T[], label: string): T {
  const value = values[0];
  if (!value) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}

test("cloud worker exposes hosting health without invoking assets", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/health"), createEnv());
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.equal(payload.deployment, "cloudflare-workers");
});

test("cloud worker exposes a hosted API root with resource links", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1"), createEnv());
  const payload = await readJson(response);
  const links = payload.links as Record<string, Link>;

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "cloudHosting");
  assert.equal(payload.version, "v1");
  assert.equal(requireLink(links, "self").href, "/api/cloud/v1");
  assert.equal(requireLink(links, "health").href, "/api/cloud/health");
  assert.equal(requireLink(links, "workspaces").href, "/api/cloud/v1/workspaces");
  assert.equal(requireLink(links, "jobs").href, "/api/cloud/v1/jobs");
});

test("cloud worker reports missing D1 and R2 bindings for hosted resources", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces"), createEnv());
  const payload = await readJson(response);

  assert.equal(response.status, 503);
  assert.equal(payload.code, "cloud-bindings-missing");
});

test("cloud worker lists workspace resources from D1 bindings", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces"), createBoundEnv());
  const payload = await readJson(response);
  const workspaces = payload.workspaces as Array<{ id: string; links: Record<string, Link>; name: string }>;
  const workspace = requireFirst(workspaces, "workspace");

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "workspaceCollection");
  assert.equal(workspace?.id, "team-alpha");
  assert.equal(workspace?.name, "Team Alpha");
  assert.equal(requireLink(workspace.links, "self").href, "/api/cloud/v1/workspaces/team-alpha");
  assert.equal(requireLink(workspace.links, "presentations").href, "/api/cloud/v1/workspaces/team-alpha/presentations");
});

test("cloud worker lists presentation resources from D1 bindings", async () => {
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations"),
    createBoundEnv()
  );
  const payload = await readJson(response);
  const presentations = payload.presentations as Array<{ id: string; latestVersion: number; links: Record<string, Link>; title: string }>;
  const presentation = requireFirst(presentations, "presentation");

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "presentationCollection");
  assert.equal(payload.workspaceId, "team-alpha");
  assert.equal(presentation?.id, "quarterly-review");
  assert.equal(presentation?.latestVersion, 3);
  assert.equal(presentation?.title, "Quarterly Review");
  assert.equal(requireLink(presentation.links, "self").href, "/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review");
  assert.equal(requireLink(presentation.links, "slides").href, "/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/slides");
});

test("cloud worker requires bearer auth for workspace writes", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces", {
    body: JSON.stringify({ id: "team-beta", name: "Team Beta" }),
    method: "POST"
  }), createBoundEnv());
  const payload = await readJson(response);

  assert.equal(response.status, 401);
  assert.equal(payload.code, "unauthorized");
});

test("cloud worker creates workspace metadata with bearer auth", async () => {
  const metadataDb = new FakeMetadataDb([], []);
  const objectBucket = new FakeObjectBucket();
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces", {
    body: JSON.stringify({ id: "team-beta", name: "Team Beta" }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnvWithStorage(metadataDb, objectBucket));
  const payload = await readJson(response);
  const workspace = payload.workspace as { id: string; links: Record<string, Link>; name: string };

  assert.equal(response.status, 201);
  assert.equal(workspace.id, "team-beta");
  assert.equal(workspace.name, "Team Beta");
  assert.equal(requireLink(workspace.links, "presentations").href, "/api/cloud/v1/workspaces/team-beta/presentations");
  assert.equal(metadataDb.workspaces.length, 1);
});

test("cloud worker creates presentation metadata and initial R2 documents with bearer auth", async () => {
  const metadataDb = new FakeMetadataDb([], []);
  const objectBucket = new FakeObjectBucket();
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-beta/presentations", {
    body: JSON.stringify({ id: "launch-plan", title: "Launch Plan" }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnvWithStorage(metadataDb, objectBucket));
  const payload = await readJson(response);
  const presentation = payload.presentation as { id: string; latestVersion: number; links: Record<string, Link>; title: string };

  assert.equal(response.status, 201);
  assert.equal(presentation.id, "launch-plan");
  assert.equal(presentation.latestVersion, 1);
  assert.equal(presentation.title, "Launch Plan");
  assert.equal(requireLink(presentation.links, "slides").href, "/api/cloud/v1/workspaces/team-beta/presentations/launch-plan/slides");
  assert.equal(metadataDb.presentations.length, 1);
  assert.ok(objectBucket.objects.has("workspaces/team-beta/presentations/launch-plan/presentation.json"));
  assert.ok(objectBucket.objects.has("workspaces/team-beta/presentations/launch-plan/state/deck-context.json"));
  assert.ok(objectBucket.objects.has("workspaces/team-beta/presentations/launch-plan/state/sources.json"));
});

test("cloud worker lists slide metadata from D1 bindings", async () => {
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/slides"),
    createBoundEnv()
  );
  const payload = await readJson(response);
  const slides = payload.slides as Array<{ id: string; links: Record<string, Link>; title: string; version: number }>;
  const slide = requireFirst(slides, "slide");

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "slideCollection");
  assert.equal(slide.id, "slide-01");
  assert.equal(slide.title, "Intro");
  assert.equal(slide.version, 2);
  assert.equal(requireLink(slide.links, "self").href, "/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/slides/slide-01");
});

test("cloud worker reads slide specs from R2 by slide metadata", async () => {
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/slides/slide-01"),
    createBoundEnv()
  );
  const payload = await readJson(response);
  const slide = payload.slide as { id: string; version: number };
  const slideSpec = payload.slideSpec as { title: string; type: string };

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "slide");
  assert.equal(slide.id, "slide-01");
  assert.equal(slide.version, 2);
  assert.equal(slideSpec.type, "cover");
  assert.equal(slideSpec.title, "Intro");
});

test("cloud worker creates slide specs with bearer auth and base version zero", async () => {
  const metadataDb = new FakeMetadataDb([], []);
  const objectBucket = new FakeObjectBucket();
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-beta/presentations/launch-plan/slides/slide-01", {
    body: JSON.stringify({
      baseVersion: 0,
      orderIndex: 0,
      slideSpec: {
        title: "Launch Plan",
        type: "cover"
      }
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "PUT"
  }), createBoundEnvWithStorage(metadataDb, objectBucket));
  const payload = await readJson(response);
  const slide = payload.slide as { id: string; title: string; version: number };

  assert.equal(response.status, 201);
  assert.equal(slide.id, "slide-01");
  assert.equal(slide.title, "Launch Plan");
  assert.equal(slide.version, 1);
  assert.ok(objectBucket.objects.has("workspaces/team-beta/presentations/launch-plan/slides/slide-01.json"));
});

test("cloud worker rejects stale slide writes", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/slides/slide-01", {
    body: JSON.stringify({
      baseVersion: 1,
      slideSpec: {
        title: "Changed",
        type: "cover"
      }
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "PUT"
  }), createBoundEnv());
  const payload = await readJson(response);

  assert.equal(response.status, 409);
  assert.equal(payload.code, "version-conflict");
  assert.equal(payload.currentVersion, 2);
});

test("cloud worker lists persisted presentation jobs", async () => {
  const metadataDb = new FakeMetadataDb([], [], [], [
    {
      created_at: "2026-05-01T00:00:00.000Z",
      id: "validation-01",
      kind: "validation",
      presentation_id: "quarterly-review",
      status: "queued",
      updated_at: "2026-05-01T00:00:00.000Z",
      workspace_id: "team-alpha"
    }
  ]);
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/jobs"),
    createBoundEnvWithStorage(metadataDb, new FakeObjectBucket())
  );
  const payload = await readJson(response);
  const jobs = payload.jobs as Array<{ id: string; kind: string; links: Record<string, Link>; status: string }>;
  const job = requireFirst(jobs, "job");

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "jobCollection");
  assert.equal(job.id, "validation-01");
  assert.equal(job.kind, "validation");
  assert.equal(job.status, "queued");
  assert.equal(requireLink(job.links, "presentation").href, "/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review");
});

test("cloud worker creates queued jobs and sends optional queue messages", async () => {
  const metadataDb = new FakeMetadataDb([], []);
  const queue = new FakeQueue();
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/jobs", {
    body: JSON.stringify({
      id: "export-01",
      kind: "export"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnvWithStorageAndQueue(metadataDb, new FakeObjectBucket(), queue));
  const payload = await readJson(response);
  const job = payload.job as { id: string; kind: string; status: string };

  assert.equal(response.status, 202);
  assert.equal(payload.queued, true);
  assert.equal(job.id, "export-01");
  assert.equal(job.kind, "export");
  assert.equal(job.status, "queued");
  assert.equal(metadataDb.jobs.length, 1);
  assert.deepEqual(queue.messages, [{
    id: "export-01",
    kind: "export",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  }]);
});

test("cloud worker rejects unknown job kinds", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/jobs", {
    body: JSON.stringify({
      id: "bad-01",
      kind: "unknown"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnv());
  const payload = await readJson(response);

  assert.equal(response.status, 400);
  assert.equal(payload.code, "bad-request");
});

test("cloud worker lists source metadata from D1 bindings", async () => {
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/sources"),
    createBoundEnv()
  );
  const payload = await readJson(response);
  const sources = payload.sources as Array<{ id: string; links: Record<string, Link>; sourceType: string; title: string }>;
  const source = requireFirst(sources, "source");

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "sourceCollection");
  assert.equal(source.id, "source-01");
  assert.equal(source.sourceType, "note");
  assert.equal(source.title, "Revenue note");
  assert.equal(requireLink(source.links, "self").href, "/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/sources/source-01");
});

test("cloud worker reads source documents from R2 by source metadata", async () => {
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/sources/source-01"),
    createBoundEnv()
  );
  const payload = await readJson(response);
  const source = payload.source as { id: string; title: string };
  const sourceDocument = payload.sourceDocument as { text: string; title: string };

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "source");
  assert.equal(source.id, "source-01");
  assert.equal(source.title, "Revenue note");
  assert.equal(sourceDocument.title, "Revenue note");
  assert.equal(sourceDocument.text, "Revenue grew 20%.");
});

test("cloud worker creates managed source documents with bearer auth", async () => {
  const metadataDb = new FakeMetadataDb([], []);
  const objectBucket = new FakeObjectBucket();
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/sources", {
    body: JSON.stringify({
      id: "source-02",
      text: "Pipeline coverage is 3.2x.",
      title: "Pipeline note",
      url: "https://example.com/pipeline"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnvWithStorage(metadataDb, objectBucket));
  const payload = await readJson(response);
  const source = payload.source as { id: string; sourceType: string; title: string; url: string };
  const objectKey = "workspaces/team-alpha/presentations/quarterly-review/sources/source-02.json";

  assert.equal(response.status, 201);
  assert.equal(source.id, "source-02");
  assert.equal(source.sourceType, "url");
  assert.equal(source.title, "Pipeline note");
  assert.equal(source.url, "https://example.com/pipeline");
  assert.equal(metadataDb.sources.length, 1);
  assert.ok(objectBucket.objects.has(objectKey));
  assert.match(objectBucket.objects.get(objectKey) || "", /Pipeline coverage is 3\.2x/);
});

test("cloud worker rejects empty source text", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/sources", {
    body: JSON.stringify({
      id: "source-03",
      text: " "
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnv());
  const payload = await readJson(response);

  assert.equal(response.status, 400);
  assert.equal(payload.code, "bad-request");
});

test("cloud worker lists material metadata from D1 bindings", async () => {
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/materials"),
    createBoundEnv()
  );
  const payload = await readJson(response);
  const materials = payload.materials as Array<{ fileName: string; id: string; links: Record<string, Link>; mediaType: string; title: string }>;
  const material = requireFirst(materials, "material");

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "materialCollection");
  assert.equal(material.id, "material-01");
  assert.equal(material.fileName, "revenue.png");
  assert.equal(material.mediaType, "image/png");
  assert.equal(material.title, "Revenue chart");
  assert.equal(requireLink(material.links, "self").href, "/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/materials/material-01");
});

test("cloud worker reads material documents from R2 by material metadata", async () => {
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/materials/material-01"),
    createBoundEnv()
  );
  const payload = await readJson(response);
  const material = payload.material as { id: string; title: string };
  const materialDocument = payload.materialDocument as { alt: string; dataBase64: string; mediaType: string };

  assert.equal(response.status, 200);
  assert.equal(payload.resource, "material");
  assert.equal(material.id, "material-01");
  assert.equal(material.title, "Revenue chart");
  assert.equal(materialDocument.alt, "Revenue chart");
  assert.equal(materialDocument.dataBase64, "aGVsbG8=");
  assert.equal(materialDocument.mediaType, "image/png");
});

test("cloud worker creates managed material documents with bearer auth", async () => {
  const metadataDb = new FakeMetadataDb([], []);
  const objectBucket = new FakeObjectBucket();
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/materials", {
    body: JSON.stringify({
      alt: "Pipeline screenshot",
      dataBase64: "aGVsbG8=",
      fileName: "pipeline.png",
      id: "material-02",
      mediaType: "image/png",
      title: "Pipeline screenshot"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnvWithStorage(metadataDb, objectBucket));
  const payload = await readJson(response);
  const material = payload.material as { fileName: string; id: string; mediaType: string; title: string };
  const objectKey = "workspaces/team-alpha/presentations/quarterly-review/materials/material-02.json";

  assert.equal(response.status, 201);
  assert.equal(material.id, "material-02");
  assert.equal(material.fileName, "pipeline.png");
  assert.equal(material.mediaType, "image/png");
  assert.equal(material.title, "Pipeline screenshot");
  assert.equal(metadataDb.materials.length, 1);
  assert.ok(objectBucket.objects.has(objectKey));
  assert.match(objectBucket.objects.get(objectKey) || "", /Pipeline screenshot/);
});

test("cloud worker rejects unsafe material file names and media types", async () => {
  const badNameResponse = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/materials", {
    body: JSON.stringify({
      dataBase64: "aGVsbG8=",
      fileName: "../secret.png",
      id: "material-03",
      mediaType: "image/png"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnv());
  const badTypeResponse = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/presentations/quarterly-review/materials", {
    body: JSON.stringify({
      dataBase64: "aGVsbG8=",
      fileName: "notes.txt",
      id: "material-04",
      mediaType: "text/plain"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "POST"
  }), createBoundEnv());

  assert.equal(badNameResponse.status, 400);
  assert.equal(badTypeResponse.status, 400);
});

test("cloud worker routes non-api paths to Workers Static Assets", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/studio"), createEnv());

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:/studio");
});
