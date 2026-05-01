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
            run(): Promise<unknown>;
          };
          run(): Promise<unknown>;
        };
      };
      SLIDEOTTER_OBJECT_BUCKET?: {
        get(key: string): Promise<unknown>;
        put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
      };
      SLIDEOTTER_CLOUD_ADMIN_TOKEN?: string;
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

  async run(): Promise<void> {
    this.db.run(this.query, this.values);
  }
}

class FakeMetadataDb {
  readonly presentations: Record<string, unknown>[];
  readonly workspaces: Record<string, unknown>[];

  constructor(
    workspaces: Record<string, unknown>[],
    presentations: Record<string, unknown>[]
  ) {
    this.presentations = presentations;
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

    throw new Error(`Unsupported fake query: ${query}`);
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

    throw new Error(`Unsupported fake run query: ${query}`);
  }
}

class FakeObjectBucket {
  readonly objects = new Map<string, string>();

  async get(): Promise<null> {
    return null;
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
  ]), new FakeObjectBucket());
}

function createBoundEnvWithStorage(metadataDb: FakeMetadataDb, objectBucket: FakeObjectBucket) {
  return {
    ...createEnv(),
    SLIDEOTTER_CLOUD_ADMIN_TOKEN: "secret-token",
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

test("cloud worker routes non-api paths to Workers Static Assets", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/studio"), createEnv());

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:/studio");
});
