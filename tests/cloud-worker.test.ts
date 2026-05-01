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
          };
        };
      };
      SLIDEOTTER_OBJECT_BUCKET?: {
        get(key: string): Promise<unknown>;
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
}

class FakeMetadataDb {
  private readonly presentations: Record<string, unknown>[];
  private readonly workspaces: Record<string, unknown>[];

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
}

class FakeObjectBucket {
  async get(): Promise<null> {
    return null;
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
  return {
    ...createEnv(),
    SLIDEOTTER_METADATA_DB: new FakeMetadataDb([
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
    ]),
    SLIDEOTTER_OBJECT_BUCKET: new FakeObjectBucket()
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

test("cloud worker routes non-api paths to Workers Static Assets", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/studio"), createEnv());

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:/studio");
});
