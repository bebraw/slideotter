import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

type SqlValue = string | number | null;

type WorkerModule = {
  default: {
    fetch(request: Request, env: {
      ASSETS: {
        fetch(request: Request): Promise<Response>;
      };
      SLIDEOTTER_CLOUD_ADMIN_TOKEN?: string;
      SLIDEOTTER_METADATA_DB?: {
        prepare(query: string): {
          bind(...values: SqlValue[]): {
            first<T = Record<string, unknown>>(): Promise<T | null>;
            run(): Promise<unknown>;
          };
          first<T = Record<string, unknown>>(): Promise<T | null>;
        };
      };
      SLIDEOTTER_OBJECT_BUCKET?: {
        get(key: string): Promise<{ text(): Promise<string> } | null>;
        put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
      };
    }): Promise<Response> | Response;
  };
};

const worker = require("../cloud/worker.ts") as WorkerModule;

class ProviderConfigPreparedStatement {
  private readonly db: ProviderConfigMetadataDb;
  private readonly query: string;
  private values: SqlValue[] = [];

  constructor(db: ProviderConfigMetadataDb, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...values: SqlValue[]): ProviderConfigPreparedStatement {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.first(this.query, this.values) as T | null;
  }

  async run(): Promise<void> {
    this.db.run(this.query, this.values);
  }
}

class ProviderConfigMetadataDb {
  readonly providerConfigs: Record<string, unknown>[];

  constructor(providerConfigs: Record<string, unknown>[] = []) {
    this.providerConfigs = providerConfigs;
  }

  prepare(query: string): ProviderConfigPreparedStatement {
    return new ProviderConfigPreparedStatement(this, query);
  }

  first(query: string, values: SqlValue[]): Record<string, unknown> | null {
    if (query.includes("FROM provider_configs")) {
      return this.providerConfigs.find((providerConfig) => providerConfig.workspace_id === values[0]) || null;
    }

    throw new Error(`Unsupported provider config fake query: ${query}`);
  }

  run(query: string, values: SqlValue[]): void {
    if (!query.includes("INTO provider_configs")) {
      throw new Error(`Unsupported provider config fake run query: ${query}`);
    }

    const nextProviderConfig = {
      allowed_data_classes_json: values[4],
      created_at: values[7],
      created_by: values[6],
      credential_ref: values[3],
      enabled_workflows_json: values[5],
      model: values[2],
      provider: values[1],
      updated_at: values[8],
      workspace_id: values[0]
    };
    const existingIndex = this.providerConfigs.findIndex((providerConfig) => providerConfig.workspace_id === values[0]);
    if (existingIndex >= 0) {
      this.providerConfigs[existingIndex] = nextProviderConfig;
    } else {
      this.providerConfigs.push(nextProviderConfig);
    }
  }
}

class ProviderConfigObjectBucket {
  async get(): Promise<null> {
    return null;
  }

  async put(): Promise<void> {
    // Provider config routes do not store objects, but the cloud worker expects the binding shape.
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

function createBoundEnv(metadataDb: ProviderConfigMetadataDb) {
  return {
    ...createEnv(),
    SLIDEOTTER_CLOUD_ADMIN_TOKEN: "secret-token",
    SLIDEOTTER_METADATA_DB: metadataDb,
    SLIDEOTTER_OBJECT_BUCKET: new ProviderConfigObjectBucket()
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("cloud worker creates workspace provider config with Workers AI defaults", async () => {
  const metadataDb = new ProviderConfigMetadataDb();
  const response = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/provider-config", {
    body: JSON.stringify({
      createdBy: "owner-01",
      model: "@cf/meta/llama-3.1-8b-instruct",
      provider: "workers-ai"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "PUT"
  }), createBoundEnv(metadataDb));
  const payload = await readJson(response);
  const providerConfig = payload.providerConfig as {
    allowedDataClasses: string[];
    createdBy: string;
    credentialRef: string | null;
    enabledWorkflows: string[];
    model: string;
    provider: string;
    workspaceId: string;
  };

  assert.equal(response.status, 201);
  assert.equal(payload.resource, "providerConfig");
  assert.equal(providerConfig.workspaceId, "team-alpha");
  assert.equal(providerConfig.provider, "workers-ai");
  assert.equal(providerConfig.model, "@cf/meta/llama-3.1-8b-instruct");
  assert.equal(providerConfig.createdBy, "owner-01");
  assert.equal(providerConfig.credentialRef, null);
  assert.deepEqual(providerConfig.allowedDataClasses, ["deck-context", "selected-source-snippets"]);
  assert.deepEqual(providerConfig.enabledWorkflows, ["deck-outline", "slide-draft", "variant", "theme"]);
  assert.equal(metadataDb.providerConfigs.length, 1);
});

test("cloud worker reads workspace provider config without exposing secrets", async () => {
  const metadataDb = new ProviderConfigMetadataDb([
    {
      allowed_data_classes_json: JSON.stringify(["deck-context", "selected-source-snippets", "materials-metadata"]),
      created_at: "2026-05-01T00:00:00.000Z",
      created_by: "owner-01",
      credential_ref: "workspace-secret",
      enabled_workflows_json: JSON.stringify(["deck-outline"]),
      model: "@cf/meta/llama-3.1-8b-instruct",
      provider: "workers-ai",
      updated_at: "2026-05-01T00:00:00.000Z",
      workspace_id: "team-alpha"
    }
  ]);
  const response = await worker.default.fetch(
    new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/provider-config"),
    createBoundEnv(metadataDb)
  );
  const payload = await readJson(response);
  const providerConfig = payload.providerConfig as {
    allowedDataClasses: string[];
    credentialRef: string;
    enabledWorkflows: string[];
    provider: string;
  };

  assert.equal(response.status, 200);
  assert.equal(providerConfig.provider, "workers-ai");
  assert.equal(providerConfig.credentialRef, "workspace-secret");
  assert.deepEqual(providerConfig.allowedDataClasses, ["deck-context", "selected-source-snippets", "materials-metadata"]);
  assert.deepEqual(providerConfig.enabledWorkflows, ["deck-outline"]);
});

test("cloud worker rejects unsupported provider config values", async () => {
  const metadataDb = new ProviderConfigMetadataDb();
  const unsupportedProvider = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/provider-config", {
    body: JSON.stringify({
      model: "gpt-5.1",
      provider: "openai"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "PUT"
  }), createBoundEnv(metadataDb));
  const unsupportedData = await worker.default.fetch(new Request("https://slideotter.test/api/cloud/v1/workspaces/team-alpha/provider-config", {
    body: JSON.stringify({
      allowedDataClasses: ["full-source-documents"],
      model: "@cf/meta/llama-3.1-8b-instruct",
      provider: "workers-ai"
    }),
    headers: { authorization: "Bearer secret-token" },
    method: "PUT"
  }), createBoundEnv(metadataDb));

  assert.equal(unsupportedProvider.status, 400);
  assert.equal(unsupportedData.status, 400);
});
