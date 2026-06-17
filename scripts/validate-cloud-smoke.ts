import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  FakeMetadataDb,
  FakeObjectBucket,
  FakeQueue,
  FakeWorkersAi
} from "../tests/helpers/cloud-worker-fakes.ts";

const require = createRequire(import.meta.url);

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
    SLIDEOTTER_WORKERS_AI: new FakeWorkersAi("Deck Smoke Candidate", ["Smoke context", "Smoke proposal"])
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
