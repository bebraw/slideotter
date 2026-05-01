const assert = require("node:assert/strict");
const test = require("node:test");

type Link = {
  href: string;
};

type WorkerModule = {
  default: {
    fetch(request: Request, env: {
      ASSETS: {
        fetch(request: Request): Promise<Response>;
      };
    }): Promise<Response> | Response;
  };
};

const worker = require("../cloud/worker.ts") as WorkerModule;

function createEnv() {
  return {
    ASSETS: {
      async fetch(request: Request): Promise<Response> {
        return new Response(`asset:${new URL(request.url).pathname}`);
      }
    }
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

test("cloud worker routes non-api paths to Workers Static Assets", async () => {
  const response = await worker.default.fetch(new Request("https://slideotter.test/studio"), createEnv());

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset:/studio");
});
