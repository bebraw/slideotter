type CloudAssets = {
  fetch(request: Request): Promise<Response>;
};

type CloudEnv = {
  ASSETS: CloudAssets;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init.headers
    }
  });
}

function notFound(pathname: string): Response {
  return jsonResponse({
    error: "Not found",
    path: pathname
  }, {
    status: 404
  });
}

function cloudHealthResponse(): Response {
  return jsonResponse({
    deployment: "cloudflare-workers",
    renderer: {
      canonical: "dom",
      hostedProof: "pending"
    },
    status: "ok",
    storage: {
      metadata: "d1",
      objects: "r2"
    }
  });
}

function cloudApiRootResponse(): Response {
  return jsonResponse({
    deployment: "cloudflare-workers",
    links: {
      health: { href: "/api/cloud/health" },
      jobs: { href: "/api/cloud/v1/jobs" },
      self: { href: "/api/cloud/v1" },
      workspaces: { href: "/api/cloud/v1/workspaces" }
    },
    resource: "cloudHosting",
    storage: {
      metadata: "d1",
      objects: "r2"
    },
    version: "v1"
  });
}

export default {
  fetch(request: Request, env: CloudEnv): Promise<Response> | Response {
    const url = new URL(request.url);

    if (url.pathname === "/api/cloud/v1") {
      return cloudApiRootResponse();
    }

    if (url.pathname === "/api/cloud/health") {
      return cloudHealthResponse();
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
