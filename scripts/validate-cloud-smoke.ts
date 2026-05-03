import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type SqlValue = string | number | null;

type CloudWorker = {
  default: {
    fetch(request: Request, env: CloudSmokeEnv): Promise<Response> | Response;
    queue(batch: {
      messages: Array<{ body: unknown }>;
    }, env: CloudSmokeEnv): Promise<void>;
  };
};

type CloudSmokeEnv = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  SLIDEOTTER_BROWSER: FakeBrowserLauncher;
  SLIDEOTTER_CLOUD_ADMIN_TOKEN: string;
  SLIDEOTTER_JOBS_QUEUE: FakeQueue;
  SLIDEOTTER_METADATA_DB: FakeMetadataDb;
  SLIDEOTTER_OBJECT_BUCKET: FakeObjectBucket;
  SLIDEOTTER_WORKERS_AI: FakeWorkersAi;
};

class FakePreparedStatement {
  private readonly db: FakeMetadataDb;
  private readonly query: string;
  private values: SqlValue[] = [];

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
  readonly jobs: Record<string, unknown>[] = [];
  readonly materials: Record<string, unknown>[] = [];
  readonly presentations: Record<string, unknown>[] = [];
  readonly providerConfigs: Record<string, unknown>[] = [];
  readonly slides: Record<string, unknown>[] = [];
  readonly sources: Record<string, unknown>[] = [];
  readonly workspaces: Record<string, unknown>[] = [];

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
    throw new Error(`Unsupported fake all query: ${query}`);
  }

  first(query: string, values: SqlValue[]): Record<string, unknown> | null {
    if (query.includes("FROM presentations")) {
      return this.presentations.find((presentation) => presentation.workspace_id === values[0] && presentation.id === values[1]) || null;
    }
    if (query.includes("FROM provider_configs")) {
      return this.providerConfigs.find((providerConfig) => providerConfig.workspace_id === values[0]) || null;
    }
    if (query.includes("FROM jobs")) {
      return this.jobs.find((job) => job.workspace_id === values[0] && job.presentation_id === values[1] && job.id === values[2]) || null;
    }
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
      this.workspaces.push({ id: values[0], name: values[1], created_at: values[2], updated_at: values[3] });
      return;
    }
    if (query.includes("INTO presentations")) {
      this.presentations.push({
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
      this.slides.push({
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
      this.jobs.push({
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        kind: values[3],
        status: values[4],
        provider: values[5],
        model: values[6],
        provider_snapshot_json: values[7],
        base_version: values[8],
        grounding_summary_json: values[9],
        diagnostics_json: values[10],
        result_object_key: values[11],
        failure_detail: values[12],
        created_at: values[13],
        updated_at: values[14]
      });
      return;
    }
    if (query.includes("INTO provider_configs")) {
      const nextProviderConfig = {
        workspace_id: values[0],
        provider: values[1],
        model: values[2],
        credential_ref: values[3],
        allowed_data_classes_json: values[4],
        enabled_workflows_json: values[5],
        created_by: values[6],
        created_at: values[7],
        updated_at: values[8]
      };
      const existingIndex = this.providerConfigs.findIndex((providerConfig) => providerConfig.workspace_id === values[0]);
      if (existingIndex >= 0) {
        this.providerConfigs[existingIndex] = nextProviderConfig;
      } else {
        this.providerConfigs.push(nextProviderConfig);
      }
      return;
    }
    if (query.includes("UPDATE jobs")) {
      const existing = this.jobs.find((job) => job.workspace_id === values[5] && job.presentation_id === values[6] && job.id === values[7]);
      if (existing) {
        existing.status = values[0];
        existing.diagnostics_json = values[1];
        existing.result_object_key = values[2];
        existing.failure_detail = values[3];
        existing.updated_at = values[4];
      }
      return;
    }
    if (query.includes("INTO sources")) {
      this.sources.push({
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        title: values[3],
        source_type: values[4],
        url: values[5],
        object_key: values[6],
        created_at: values[7],
        updated_at: values[8]
      });
      return;
    }
    if (query.includes("INTO materials")) {
      this.materials.push({
        id: values[0],
        workspace_id: values[1],
        presentation_id: values[2],
        title: values[3],
        media_type: values[4],
        file_name: values[5],
        object_key: values[6],
        created_at: values[7],
        updated_at: values[8]
      });
      return;
    }
    throw new Error(`Unsupported fake run query: ${query}`);
  }
}

class FakeObjectBucket {
  readonly objects = new Map<string, string>();

  async get(key: string): Promise<{ text(): Promise<string> } | null> {
    const value = this.objects.get(key);
    return value === undefined ? null : { async text() { return value; } };
  }

  async put(key: string, value: string): Promise<void> {
    this.objects.set(key, value);
  }
}

class FakeQueue {
  readonly messages: unknown[] = [];

  async send(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

class FakeWorkersAi {
  readonly calls: Array<{ input: unknown; model: string }> = [];

  async run(model: string, input: unknown): Promise<unknown> {
    this.calls.push({ input, model });
    return {
      response: JSON.stringify({
        candidate: {
          outline: ["Smoke context", "Smoke proposal"],
          title: "Deck Smoke Candidate"
        }
      })
    };
  }
}

class FakeBrowserPage {
  async close(): Promise<void> {}

  async evaluate<T>(): Promise<T> {
    return {
      hasProofRoot: true,
      slideCount: 1,
      title: "Deck Smoke rendering proof"
    } as T;
  }

  async goto(): Promise<void> {}

  async pdf(): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3, 4]);
  }

  async screenshot(): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3]);
  }
}

class FakeBrowser {
  async close(): Promise<void> {}

  async newPage(): Promise<FakeBrowserPage> {
    return new FakeBrowserPage();
  }
}

class FakeBrowserLauncher {
  async launch(): Promise<FakeBrowser> {
    return new FakeBrowser();
  }
}

function createEnv(): CloudSmokeEnv {
  return {
    ASSETS: {
      async fetch(request: Request): Promise<Response> {
        return new Response(`asset:${new URL(request.url).pathname}`);
      }
    },
    SLIDEOTTER_BROWSER: new FakeBrowserLauncher(),
    SLIDEOTTER_CLOUD_ADMIN_TOKEN: "secret-token",
    SLIDEOTTER_JOBS_QUEUE: new FakeQueue(),
    SLIDEOTTER_METADATA_DB: new FakeMetadataDb(),
    SLIDEOTTER_OBJECT_BUCKET: new FakeObjectBucket(),
    SLIDEOTTER_WORKERS_AI: new FakeWorkersAi()
  };
}

async function request(worker: CloudWorker, env: CloudSmokeEnv, path: string, init: RequestInit = {}) {
  const response = await worker.default.fetch(new Request(`https://slideotter.test${path}`, init), env);
  return {
    body: await response.json() as Record<string, unknown>,
    status: response.status
  };
}

async function requestText(worker: CloudWorker, env: CloudSmokeEnv, path: string) {
  const response = await worker.default.fetch(new Request(`https://slideotter.test${path}`), env);
  return {
    body: await response.text(),
    status: response.status
  };
}

async function authedPost(worker: CloudWorker, env: CloudSmokeEnv, path: string, body: unknown) {
  return request(worker, env, path, {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer secret-token",
      "content-type": "application/json"
    },
    method: "POST"
  });
}

async function authedPut(worker: CloudWorker, env: CloudSmokeEnv, path: string, body: unknown) {
  return request(worker, env, path, {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer secret-token",
      "content-type": "application/json"
    },
    method: "PUT"
  });
}

async function main(): Promise<void> {
  const worker = require("../cloud/worker.ts");
  const env = createEnv();

  assert.equal((await request(worker, env, "/api/cloud/health")).status, 200);
  assert.equal((await authedPost(worker, env, "/api/cloud/v1/workspaces", {
    id: "team-smoke",
    name: "Team Smoke"
  })).status, 201);
  assert.equal((await authedPost(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations", {
    id: "deck-smoke",
    title: "Deck Smoke"
  })).status, 201);
  assert.equal((await authedPut(worker, env, "/api/cloud/v1/workspaces/team-smoke/provider-config", {
    model: "@cf/meta/llama-3.1-8b-instruct",
    provider: "workers-ai"
  })).status, 201);
  assert.equal((await authedPut(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/slides/slide-01", {
    baseVersion: 0,
    orderIndex: 0,
    slideSpec: {
      title: "Deck Smoke",
      type: "cover"
    }
  })).status, 201);
  assert.equal((await authedPost(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/sources", {
    id: "source-01",
    text: "Smoke source text.",
    title: "Smoke source"
  })).status, 201);
  assert.equal((await authedPost(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/materials", {
    alt: "Smoke material",
    dataBase64: "aGVsbG8=",
    fileName: "smoke.png",
    id: "material-01",
    mediaType: "image/png",
    title: "Smoke material"
  })).status, 201);
  assert.equal((await authedPost(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/jobs", {
    id: "validation-01",
    kind: "validation"
  })).status, 202);
  assert.equal((await authedPost(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/jobs", {
    id: "generation-01",
    kind: "generation",
    selectedSourceIds: ["source-01"],
    workflow: "deck-outline"
  })).status, 202);

  const slides = await request(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/slides");
  const sources = await request(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/sources");
  const materials = await request(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/materials");
  const jobs = await request(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/jobs");
  const bundle = await request(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/bundle");

  assert.equal((slides.body.slides as unknown[]).length, 1);
  assert.equal((sources.body.sources as unknown[]).length, 1);
  assert.equal((materials.body.materials as unknown[]).length, 1);
  assert.equal((jobs.body.jobs as unknown[]).length, 2);
  assert.equal(bundle.body.resource, "presentationBundle");
  assert.equal(bundle.body.bundleVersion, 1);
  assert.equal((bundle.body.slides as unknown[]).length, 1);
  assert.equal((bundle.body.sources as unknown[]).length, 1);
  assert.equal((bundle.body.materials as unknown[]).length, 1);

  const renderingDocument = await requestText(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/rendering-proof/document");
  assert.equal(renderingDocument.status, 200);
  assert.match(renderingDocument.body, /data-slideotter-render-proof="true"/);
  const renderingProof = await request(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentations/deck-smoke/rendering-proof", {
    headers: {
      authorization: "Bearer secret-token"
    },
    method: "POST"
  });
  assert.equal(renderingProof.status, 200);
  assert.equal(renderingProof.body.resource, "hostedRenderingProof");
  assert.equal((renderingProof.body.report as { pdfByteLength: number }).pdfByteLength, 4);

  const imported = await authedPost(worker, env, "/api/cloud/v1/workspaces/team-smoke/presentation-bundles", {
    bundle: bundle.body,
    presentationId: "deck-smoke-imported"
  });
  assert.equal(imported.status, 201);
  assert.equal(imported.body.resource, "presentationBundleImport");
  assert.equal((imported.body.imported as { materials: number; slides: number; sources: number }).slides, 1);
  assert.equal(env.SLIDEOTTER_OBJECT_BUCKET.objects.has("workspaces/team-smoke/presentations/deck-smoke-imported/slides/slide-01.json"), true);
  assert.equal(env.SLIDEOTTER_JOBS_QUEUE.messages.length, 2);
  await worker.default.queue({
    messages: env.SLIDEOTTER_JOBS_QUEUE.messages.map((body) => ({ body }))
  }, env);
  assert.equal(env.SLIDEOTTER_METADATA_DB.jobs[0]?.status, "completed");
  assert.equal(env.SLIDEOTTER_METADATA_DB.jobs[1]?.status, "completed");
  assert.equal(env.SLIDEOTTER_METADATA_DB.jobs[1]?.result_object_key, "workspaces/team-smoke/presentations/deck-smoke/candidates/generation-01.json");
  assert.equal(env.SLIDEOTTER_OBJECT_BUCKET.objects.has("workspaces/team-smoke/presentations/deck-smoke/candidates/generation-01.json"), true);
  assert.equal(env.SLIDEOTTER_WORKERS_AI.calls.length, 1);

  process.stdout.write("Cloud smoke validation passed.\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
