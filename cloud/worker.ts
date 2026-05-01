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
  first<T = CloudRecord>(): Promise<T | null>;
  run(): Promise<unknown>;
};

type CloudD1Database = {
  prepare(query: string): CloudD1PreparedStatement;
};

type CloudR2Bucket = {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
};

type CloudEnv = {
  ASSETS: CloudAssets;
  SLIDEOTTER_CLOUD_ADMIN_TOKEN?: string;
  SLIDEOTTER_METADATA_DB?: CloudD1Database;
  SLIDEOTTER_OBJECT_BUCKET?: CloudR2Bucket;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};
const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

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

function missingAuthConfigResponse(): Response {
  return jsonResponse({
    code: "cloud-auth-missing",
    error: "Cloud write authentication is not configured for this environment."
  }, {
    status: 503
  });
}

function unauthorizedResponse(): Response {
  return jsonResponse({
    code: "unauthorized",
    error: "A valid bearer token is required for this cloud write."
  }, {
    status: 401
  });
}

function conflictResponse(message: string, currentVersion: number): Response {
  return jsonResponse({
    code: "version-conflict",
    currentVersion,
    error: message
  }, {
    status: 409
  });
}

function badRequestResponse(message: string): Response {
  return jsonResponse({
    code: "bad-request",
    error: message
  }, {
    status: 400
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

function requireCloudWriteAuth(request: Request, env: CloudEnv): Response | null {
  const expectedToken = String(env.SLIDEOTTER_CLOUD_ADMIN_TOKEN || "").trim();
  if (!expectedToken) {
    return missingAuthConfigResponse();
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization !== `Bearer ${expectedToken}`) {
    return unauthorizedResponse();
  }

  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value || 0);
}

function assertCloudId(value: unknown, label: string): string {
  const id = String(value || "").trim();
  if (!idPattern.test(id)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return id;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloudObjectKey(parts: string[]): string {
  return parts.join("/");
}

function presentationPrefix(workspaceId: string, presentationId: string): string {
  return cloudObjectKey(["workspaces", workspaceId, "presentations", presentationId]);
}

async function readJsonRequest(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : badRequestResponse("Request body must be a JSON object.");
  } catch (error) {
    return badRequestResponse("Request body must be valid JSON.");
  }
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

function slideResource(row: CloudRecord) {
  const id = asString(row.id);
  const workspaceId = asString(row.workspace_id);
  const presentationId = asString(row.presentation_id);
  return {
    id,
    links: {
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/slides/${id}` }
    },
    orderIndex: asNumber(row.order_index),
    presentationId,
    title: asString(row.title),
    version: asNumber(row.version),
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

async function createCloudWorkspaceResponse(request: Request, env: CloudEnv): Promise<Response> {
  const authError = requireCloudWriteAuth(request, env);
  if (authError) {
    return authError;
  }

  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const body = await readJsonRequest(request);
  if (body instanceof Response) {
    return body;
  }

  let workspaceId = "";
  try {
    workspaceId = assertCloudId(body.id, "workspace id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid workspace id.");
  }

  const createdAt = nowIso();
  const name = asString(body.name).trim() || "Untitled workspace";
  await bindings.metadataDb.prepare(`
    INSERT OR REPLACE INTO workspaces (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).bind(workspaceId, name, createdAt, createdAt).run();

  return jsonResponse({
    workspace: workspaceResource({
      created_at: createdAt,
      id: workspaceId,
      name,
      updated_at: createdAt
    })
  }, {
    status: 201
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

async function createCloudPresentationResponse(request: Request, env: CloudEnv, workspaceIdInput: string): Promise<Response> {
  const authError = requireCloudWriteAuth(request, env);
  if (authError) {
    return authError;
  }

  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const body = await readJsonRequest(request);
  if (body instanceof Response) {
    return body;
  }

  let workspaceId = "";
  let presentationId = "";
  try {
    workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    presentationId = assertCloudId(body.id, "presentation id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid presentation id.");
  }

  const title = asString(body.title).trim() || "Untitled presentation";
  const createdAt = nowIso();
  const rootPrefix = presentationPrefix(workspaceId, presentationId);
  const manifestKey = cloudObjectKey([rootPrefix, "presentation.json"]);
  const deckContextKey = cloudObjectKey([rootPrefix, "state", "deck-context.json"]);
  const sourcesKey = cloudObjectKey([rootPrefix, "state", "sources.json"]);

  await bindings.objectBucket.put(manifestKey, `${JSON.stringify({
    id: presentationId,
    title,
    workspaceId
  }, null, 2)}\n`, {
    httpMetadata: { contentType: "application/json" }
  });
  await bindings.objectBucket.put(deckContextKey, `${JSON.stringify({
    deck: { title },
    slides: {}
  }, null, 2)}\n`, {
    httpMetadata: { contentType: "application/json" }
  });
  await bindings.objectBucket.put(sourcesKey, `${JSON.stringify({
    sources: []
  }, null, 2)}\n`, {
    httpMetadata: { contentType: "application/json" }
  });
  await bindings.metadataDb.prepare(`
    INSERT OR REPLACE INTO presentations (
      id, workspace_id, title, latest_version, r2_prefix, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(presentationId, workspaceId, title, 1, rootPrefix, createdAt, createdAt).run();

  return jsonResponse({
    presentation: presentationResource({
      created_at: createdAt,
      id: presentationId,
      latest_version: 1,
      r2_prefix: rootPrefix,
      title,
      updated_at: createdAt,
      workspace_id: workspaceId
    })
  }, {
    status: 201
  });
}

async function cloudSlidesResponse(env: CloudEnv, workspaceId: string, presentationId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const rows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, order_index, title, version, spec_object_key
    FROM slides
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY order_index ASC
  `).bind(workspaceId, presentationId).all<CloudRecord>();

  return jsonResponse({
    links: {
      presentation: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}` },
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/slides` }
    },
    presentationId,
    resource: "slideCollection",
    slides: rows.results.map(slideResource),
    workspaceId
  });
}

async function cloudSlideResponse(env: CloudEnv, workspaceId: string, presentationId: string, slideId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const row = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, order_index, title, version, spec_object_key
    FROM slides
    WHERE workspace_id = ? AND presentation_id = ? AND id = ?
  `).bind(workspaceId, presentationId, slideId).first<CloudRecord>();

  if (!row) {
    return notFound(`/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/slides/${slideId}`);
  }

  const objectKey = asString(row.spec_object_key);
  const object = await bindings.objectBucket.get(objectKey);
  if (!object) {
    return jsonResponse({
      code: "slide-spec-missing",
      error: "Slide metadata exists but its R2 slide spec object is missing.",
      objectKey
    }, {
      status: 502
    });
  }

  return jsonResponse({
    links: {
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/slides/${slideId}` },
      slides: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/slides` }
    },
    resource: "slide",
    slide: slideResource(row),
    slideSpec: JSON.parse(await object.text())
  });
}

async function upsertCloudSlideResponse(request: Request, env: CloudEnv, workspaceIdInput: string, presentationIdInput: string, slideIdInput: string): Promise<Response> {
  const authError = requireCloudWriteAuth(request, env);
  if (authError) {
    return authError;
  }

  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const body = await readJsonRequest(request);
  if (body instanceof Response) {
    return body;
  }

  let workspaceId = "";
  let presentationId = "";
  let slideId = "";
  try {
    workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    presentationId = assertCloudId(presentationIdInput, "presentation id");
    slideId = assertCloudId(slideIdInput, "slide id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid slide id.");
  }

  const slideSpec = body.slideSpec;
  if (!slideSpec || typeof slideSpec !== "object" || Array.isArray(slideSpec)) {
    return badRequestResponse("slideSpec must be a JSON object.");
  }

  const existing = await bindings.metadataDb.prepare(`
    SELECT version
    FROM slides
    WHERE workspace_id = ? AND presentation_id = ? AND id = ?
  `).bind(workspaceId, presentationId, slideId).first<CloudRecord>();
  const currentVersion = existing ? asNumber(existing.version) : 0;
  const baseVersion = body.baseVersion === undefined || body.baseVersion === null ? currentVersion : asNumber(body.baseVersion);
  if (baseVersion !== currentVersion) {
    return conflictResponse("Slide changed before this write could be applied.", currentVersion);
  }

  const nextVersion = currentVersion + 1;
  const orderIndex = body.orderIndex === undefined || body.orderIndex === null ? 0 : asNumber(body.orderIndex);
  const title = asString(body.title).trim() || asString((slideSpec as CloudRecord).title).trim() || slideId;
  const specObjectKey = cloudObjectKey([presentationPrefix(workspaceId, presentationId), "slides", `${slideId}.json`]);
  await bindings.objectBucket.put(specObjectKey, `${JSON.stringify(slideSpec, null, 2)}\n`, {
    httpMetadata: { contentType: "application/json" }
  });
  await bindings.metadataDb.prepare(`
    INSERT OR REPLACE INTO slides (
      id, workspace_id, presentation_id, order_index, title, version, spec_object_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(slideId, workspaceId, presentationId, orderIndex, title, nextVersion, specObjectKey).run();

  return jsonResponse({
    slide: slideResource({
      id: slideId,
      order_index: orderIndex,
      presentation_id: presentationId,
      title,
      version: nextVersion,
      workspace_id: workspaceId
    })
  }, {
    status: existing ? 200 : 201
  });
}

function matchWorkspacePresentationsPath(pathname: string): string | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations$/.exec(pathname);
  return match && match[1] ? match[1] : null;
}

function matchPresentationSlidesPath(pathname: string): { presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/slides$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

function matchPresentationSlidePath(pathname: string): { presentationId: string; slideId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/slides\/([a-z0-9][a-z0-9-]{0,63})$/.exec(pathname);
  return match && match[1] && match[2] && match[3] ? { presentationId: match[2], slideId: match[3], workspaceId: match[1] } : null;
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

    if (url.pathname === "/api/cloud/v1/workspaces" && request.method === "POST") {
      return createCloudWorkspaceResponse(request, env);
    }

    if (url.pathname === "/api/cloud/v1/workspaces") {
      return cloudWorkspacesResponse(env);
    }

    const workspacePresentationsId = matchWorkspacePresentationsPath(url.pathname);
    if (workspacePresentationsId && request.method === "POST") {
      return createCloudPresentationResponse(request, env, workspacePresentationsId);
    }

    if (workspacePresentationsId) {
      return cloudPresentationsResponse(env, workspacePresentationsId);
    }

    const presentationSlides = matchPresentationSlidesPath(url.pathname);
    if (presentationSlides) {
      return cloudSlidesResponse(env, presentationSlides.workspaceId, presentationSlides.presentationId);
    }

    const presentationSlide = matchPresentationSlidePath(url.pathname);
    if (presentationSlide && request.method === "PUT") {
      return upsertCloudSlideResponse(request, env, presentationSlide.workspaceId, presentationSlide.presentationId, presentationSlide.slideId);
    }

    if (presentationSlide) {
      return cloudSlideResponse(env, presentationSlide.workspaceId, presentationSlide.presentationId, presentationSlide.slideId);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
