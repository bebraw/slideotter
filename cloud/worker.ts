type CloudAssets = {
  fetch(request: Request): Promise<Response>;
};

type CloudSqlValue = string | number | null;

type CloudRecord = Record<string, unknown>;

type CloudD1ResultSet<T> = {
  results: T[];
};

type CloudD1PreparedStatement = {
  all<T = CloudRecord>(): Promise<CloudD1ResultSet<T>>;
  bind(...values: CloudSqlValue[]): CloudD1PreparedStatement;
};

type CloudD1Database = {
  prepare(query: string): CloudD1PreparedStatement;
};

type CloudR2Bucket = {
  get(key: string): Promise<unknown>;
};

type CloudEnv = {
  ASSETS: CloudAssets;
  SLIDEOTTER_METADATA_DB?: CloudD1Database;
  SLIDEOTTER_OBJECT_BUCKET?: CloudR2Bucket;
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

function missingCloudBindingsResponse(): Response {
  return jsonResponse({
    code: "cloud-bindings-missing",
    error: "Cloud metadata and object bindings are not configured for this environment."
  }, {
    status: 503
  });
}

function requireCloudBindings(env: CloudEnv): { metadataDb: CloudD1Database; objectBucket: CloudR2Bucket } | Response {
  if (!env.SLIDEOTTER_METADATA_DB || !env.SLIDEOTTER_OBJECT_BUCKET) {
    return missingCloudBindingsResponse();
  }

  return {
    metadataDb: env.SLIDEOTTER_METADATA_DB,
    objectBucket: env.SLIDEOTTER_OBJECT_BUCKET
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0);
}

function workspaceResource(row: CloudRecord) {
  const id = asString(row.id);
  return {
    createdAt: asString(row.created_at),
    id,
    links: {
      presentations: { href: `/api/cloud/v1/workspaces/${id}/presentations` },
      self: { href: `/api/cloud/v1/workspaces/${id}` }
    },
    name: asString(row.name),
    updatedAt: asString(row.updated_at)
  };
}

function presentationResource(row: CloudRecord) {
  const id = asString(row.id);
  const workspaceId = asString(row.workspace_id);
  return {
    createdAt: asString(row.created_at),
    id,
    latestVersion: asNumber(row.latest_version),
    links: {
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${id}` },
      slides: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${id}/slides` }
    },
    title: asString(row.title),
    updatedAt: asString(row.updated_at),
    workspaceId
  };
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

async function cloudWorkspacesResponse(env: CloudEnv): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const rows = await bindings.metadataDb.prepare(`
    SELECT id, name, created_at, updated_at
    FROM workspaces
    ORDER BY updated_at DESC
  `).all<CloudRecord>();

  return jsonResponse({
    links: {
      self: { href: "/api/cloud/v1/workspaces" }
    },
    resource: "workspaceCollection",
    workspaces: rows.results.map(workspaceResource)
  });
}

async function cloudPresentationsResponse(env: CloudEnv, workspaceId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const rows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, title, latest_version, r2_prefix, created_at, updated_at
    FROM presentations
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
  `).bind(workspaceId).all<CloudRecord>();

  return jsonResponse({
    links: {
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations` },
      workspace: { href: `/api/cloud/v1/workspaces/${workspaceId}` }
    },
    presentations: rows.results.map(presentationResource),
    resource: "presentationCollection",
    workspaceId
  });
}

function matchWorkspacePresentationsPath(pathname: string): string | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations$/.exec(pathname);
  return match && match[1] ? match[1] : null;
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

    if (url.pathname === "/api/cloud/v1/workspaces") {
      return cloudWorkspacesResponse(env);
    }

    const workspacePresentationsId = matchWorkspacePresentationsPath(url.pathname);
    if (workspacePresentationsId) {
      return cloudPresentationsResponse(env, workspacePresentationsId);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
