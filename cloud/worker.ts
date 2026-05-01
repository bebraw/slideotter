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

type CloudQueue = {
  send(message: unknown): Promise<unknown>;
};

type CloudQueueMessage = {
  body: unknown;
};

type CloudQueueBatch = {
  messages: CloudQueueMessage[];
};

type CloudBrowserBinding = unknown;

type CloudBrowserPage = {
  close?(): Promise<unknown>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  pdf?(options?: Record<string, unknown>): Promise<ArrayBuffer | Uint8Array | string>;
  screenshot?(options?: Record<string, unknown>): Promise<ArrayBuffer | Uint8Array | string>;
};

type CloudBrowser = {
  close(): Promise<unknown>;
  newPage(): Promise<CloudBrowserPage>;
};

type CloudPuppeteerLauncher = {
  launch(binding: CloudBrowserBinding): Promise<CloudBrowser>;
};

type CloudPuppeteerModule = CloudPuppeteerLauncher & {
  default?: CloudPuppeteerLauncher;
};

type CloudEnv = {
  ASSETS: CloudAssets;
  SLIDEOTTER_BROWSER?: CloudBrowserBinding;
  SLIDEOTTER_CLOUD_ADMIN_TOKEN?: string;
  SLIDEOTTER_JOBS_QUEUE?: CloudQueue;
  SLIDEOTTER_METADATA_DB?: CloudD1Database;
  SLIDEOTTER_OBJECT_BUCKET?: CloudR2Bucket;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};
const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const jobKindPattern = /^(export|generation|import|validation)$/;
const maxMaterialBase64Length = 8_000_000;
const maxSourceTextLength = 200_000;

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

function missingBrowserRenderingResponse(): Response {
  return jsonResponse({
    code: "browser-rendering-missing",
    error: "Cloudflare Browser Rendering is not configured for this environment."
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

function requireCloudMetadataBinding(env: CloudEnv): CloudD1Database | Response {
  if (!env.SLIDEOTTER_METADATA_DB) {
    return missingCloudBindingsResponse();
  }

  return env.SLIDEOTTER_METADATA_DB;
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

function asRecord(value: unknown): CloudRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as CloudRecord : null;
}

function asRecordArray(value: unknown): CloudRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((record): record is CloudRecord => Boolean(record)) : [];
}

function hasLocalBrowserLauncher(value: unknown): value is { launch(): Promise<CloudBrowser> } {
  return Boolean(value && typeof value === "object" && "launch" in value && typeof (value as { launch?: unknown }).launch === "function");
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

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function byteLength(value: unknown): number {
  if (typeof value === "string") {
    return new TextEncoder().encode(value).byteLength;
  }
  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }
  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }
  return 0;
}

async function launchCloudBrowser(env: CloudEnv): Promise<CloudBrowser | Response> {
  if (!env.SLIDEOTTER_BROWSER) {
    return missingBrowserRenderingResponse();
  }
  if (hasLocalBrowserLauncher(env.SLIDEOTTER_BROWSER)) {
    return env.SLIDEOTTER_BROWSER.launch();
  }

  const puppeteerModule: CloudPuppeteerModule = await import("@cloudflare/puppeteer");
  const launcher = puppeteerModule.default || puppeteerModule;
  return launcher.launch(env.SLIDEOTTER_BROWSER);
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

function jobResource(row: CloudRecord) {
  const id = asString(row.id);
  const workspaceId = asString(row.workspace_id);
  const presentationId = asString(row.presentation_id);
  return {
    createdAt: asString(row.created_at),
    id,
    kind: asString(row.kind),
    links: {
      presentation: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}` },
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/jobs/${id}` }
    },
    presentationId,
    status: asString(row.status),
    updatedAt: asString(row.updated_at),
    workspaceId
  };
}

function sourceResource(row: CloudRecord) {
  const id = asString(row.id);
  const workspaceId = asString(row.workspace_id);
  const presentationId = asString(row.presentation_id);
  return {
    createdAt: asString(row.created_at),
    id,
    links: {
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/sources/${id}` }
    },
    presentationId,
    sourceType: asString(row.source_type),
    title: asString(row.title),
    updatedAt: asString(row.updated_at),
    url: asString(row.url) || null,
    workspaceId
  };
}

function materialResource(row: CloudRecord) {
  const id = asString(row.id);
  const workspaceId = asString(row.workspace_id);
  const presentationId = asString(row.presentation_id);
  return {
    createdAt: asString(row.created_at),
    fileName: asString(row.file_name),
    id,
    links: {
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/materials/${id}` }
    },
    mediaType: asString(row.media_type),
    presentationId,
    title: asString(row.title),
    updatedAt: asString(row.updated_at),
    workspaceId
  };
}

async function readCloudObjectJson(objectBucket: CloudR2Bucket, objectKey: string, missingCode: string): Promise<unknown | Response> {
  const object = await objectBucket.get(objectKey);
  if (!object) {
    return jsonResponse({
      code: missingCode,
      error: "Cloud metadata exists but its R2 object is missing.",
      objectKey
    }, {
      status: 502
    });
  }

  return JSON.parse(await object.text());
}

function cloudHealthResponse(): Response {
  return jsonResponse({
    deployment: "cloudflare-workers",
    renderer: {
      canonical: "dom",
      hostedProof: "browser-rendering"
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

async function createCloudPresentationBundleResponse(request: Request, env: CloudEnv, workspaceIdInput: string): Promise<Response> {
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

  const bundle = asRecord(body.bundle) || body;
  if (asNumber(bundle.bundleVersion) !== 1 || asString(bundle.resource) !== "presentationBundle") {
    return badRequestResponse("bundle must be a presentationBundle document with bundleVersion 1.");
  }

  const presentation = asRecord(bundle.presentation);
  if (!presentation) {
    return badRequestResponse("bundle.presentation must be a JSON object.");
  }

  let workspaceId = "";
  let presentationId = "";
  try {
    workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    presentationId = assertCloudId(body.presentationId || presentation.id, "presentation id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid bundle import scope.");
  }

  const existing = await bindings.metadataDb.prepare(`
    SELECT id
    FROM presentations
    WHERE workspace_id = ? AND id = ?
  `).bind(workspaceId, presentationId).first<CloudRecord>();
  if (existing) {
    return jsonResponse({
      code: "presentation-exists",
      error: "A presentation with this id already exists in the target workspace.",
      presentationId,
      workspaceId
    }, {
      status: 409
    });
  }

  const createdAt = nowIso();
  const title = asString(presentation.title).trim() || presentationId;
  const rootPrefix = presentationPrefix(workspaceId, presentationId);
  const latestVersion = asNumber(presentation.latestVersion) || 1;

  await bindings.objectBucket.put(cloudObjectKey([rootPrefix, "presentation.json"]), `${JSON.stringify({
    id: presentationId,
    importedFrom: asString(presentation.id) || null,
    title,
    workspaceId
  }, null, 2)}\n`, {
    httpMetadata: { contentType: "application/json" }
  });
  await bindings.metadataDb.prepare(`
    INSERT OR REPLACE INTO presentations (
      id, workspace_id, title, latest_version, r2_prefix, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(presentationId, workspaceId, title, latestVersion, rootPrefix, createdAt, createdAt).run();

  const importedSlides = [];
  for (const item of asRecordArray(bundle.slides)) {
    const metadata = asRecord(item.metadata) || {};
    const slideSpec = asRecord(item.slideSpec);
    if (!slideSpec) {
      return badRequestResponse("Each imported slide must include a slideSpec object.");
    }
    let slideId = "";
    try {
      slideId = assertCloudId(metadata.id, "slide id");
    } catch (error) {
      return badRequestResponse(error instanceof Error ? error.message : "Invalid imported slide id.");
    }
    const objectKey = cloudObjectKey([rootPrefix, "slides", `${slideId}.json`]);
    await bindings.objectBucket.put(objectKey, `${JSON.stringify(slideSpec, null, 2)}\n`, {
      httpMetadata: { contentType: "application/json" }
    });
    const orderIndex = asNumber(metadata.orderIndex);
    const version = asNumber(metadata.version) || 1;
    const slideTitle = asString(metadata.title).trim() || asString(slideSpec.title).trim() || slideId;
    await bindings.metadataDb.prepare(`
      INSERT OR REPLACE INTO slides (
        id, workspace_id, presentation_id, order_index, title, version, spec_object_key
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(slideId, workspaceId, presentationId, orderIndex, slideTitle, version, objectKey).run();
    importedSlides.push(slideId);
  }

  const importedSources = [];
  for (const item of asRecordArray(bundle.sources)) {
    const metadata = asRecord(item.metadata) || {};
    const sourceDocument = asRecord(item.sourceDocument);
    if (!sourceDocument) {
      return badRequestResponse("Each imported source must include a sourceDocument object.");
    }
    let sourceId = "";
    try {
      sourceId = assertCloudId(metadata.id || sourceDocument.id, "source id");
    } catch (error) {
      return badRequestResponse(error instanceof Error ? error.message : "Invalid imported source id.");
    }
    const objectKey = cloudObjectKey([rootPrefix, "sources", `${sourceId}.json`]);
    await bindings.objectBucket.put(objectKey, `${JSON.stringify({
      ...sourceDocument,
      id: sourceId,
      presentationId,
      workspaceId
    }, null, 2)}\n`, {
      httpMetadata: { contentType: "application/json" }
    });
    const sourceType = asString(metadata.sourceType || sourceDocument.type).trim() || "note";
    const sourceTitle = asString(metadata.title || sourceDocument.title).trim() || sourceId;
    const sourceUrl = asString(metadata.url || sourceDocument.url).trim();
    await bindings.metadataDb.prepare(`
      INSERT OR REPLACE INTO sources (
        id, workspace_id, presentation_id, title, source_type, url, object_key, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sourceId, workspaceId, presentationId, sourceTitle, sourceType, sourceUrl || null, objectKey, createdAt, createdAt).run();
    importedSources.push(sourceId);
  }

  const importedMaterials = [];
  for (const item of asRecordArray(bundle.materials)) {
    const metadata = asRecord(item.metadata) || {};
    const materialDocument = asRecord(item.materialDocument);
    if (!materialDocument) {
      return badRequestResponse("Each imported material must include a materialDocument object.");
    }
    let materialId = "";
    try {
      materialId = assertCloudId(metadata.id || materialDocument.id, "material id");
    } catch (error) {
      return badRequestResponse(error instanceof Error ? error.message : "Invalid imported material id.");
    }
    const objectKey = cloudObjectKey([rootPrefix, "materials", `${materialId}.json`]);
    await bindings.objectBucket.put(objectKey, `${JSON.stringify({
      ...materialDocument,
      id: materialId,
      presentationId,
      workspaceId
    }, null, 2)}\n`, {
      httpMetadata: { contentType: "application/json" }
    });
    const mediaType = asString(metadata.mediaType || materialDocument.mediaType).trim() || "application/octet-stream";
    const fileName = asString(metadata.fileName || materialDocument.fileName).trim() || `${materialId}.bin`;
    const materialTitle = asString(metadata.title || materialDocument.title).trim() || materialId;
    await bindings.metadataDb.prepare(`
      INSERT OR REPLACE INTO materials (
        id, workspace_id, presentation_id, title, media_type, file_name, object_key, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(materialId, workspaceId, presentationId, materialTitle, mediaType, fileName, objectKey, createdAt, createdAt).run();
    importedMaterials.push(materialId);
  }

  return jsonResponse({
    imported: {
      materials: importedMaterials.length,
      slides: importedSlides.length,
      sources: importedSources.length
    },
    presentation: presentationResource({
      created_at: createdAt,
      id: presentationId,
      latest_version: latestVersion,
      r2_prefix: rootPrefix,
      title,
      updated_at: createdAt,
      workspace_id: workspaceId
    }),
    resource: "presentationBundleImport"
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

async function cloudJobsResponse(env: CloudEnv, workspaceId: string, presentationId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const rows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, kind, status, created_at, updated_at
    FROM jobs
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY created_at DESC
  `).bind(workspaceId, presentationId).all<CloudRecord>();

  return jsonResponse({
    jobs: rows.results.map(jobResource),
    links: {
      presentation: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}` },
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/jobs` }
    },
    presentationId,
    resource: "jobCollection",
    workspaceId
  });
}

async function createCloudJobResponse(request: Request, env: CloudEnv, workspaceIdInput: string, presentationIdInput: string): Promise<Response> {
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
    presentationId = assertCloudId(presentationIdInput, "presentation id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid job scope.");
  }

  const kind = asString(body.kind);
  if (!jobKindPattern.test(kind)) {
    return badRequestResponse("kind must be one of export, generation, import, or validation.");
  }

  const createdAt = nowIso();
  const jobId = asString(body.id).trim() || `${kind}-${Date.now()}`;
  try {
    assertCloudId(jobId, "job id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid job id.");
  }

  const jobRow = {
    created_at: createdAt,
    id: jobId,
    kind,
    presentation_id: presentationId,
    status: "queued",
    updated_at: createdAt,
    workspace_id: workspaceId
  };
  await bindings.metadataDb.prepare(`
    INSERT OR REPLACE INTO jobs (
      id, workspace_id, presentation_id, kind, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(jobId, workspaceId, presentationId, kind, "queued", createdAt, createdAt).run();

  if (env.SLIDEOTTER_JOBS_QUEUE) {
    await env.SLIDEOTTER_JOBS_QUEUE.send({
      id: jobId,
      kind,
      presentationId,
      workspaceId
    });
  }

  return jsonResponse({
    job: jobResource(jobRow),
    queued: Boolean(env.SLIDEOTTER_JOBS_QUEUE)
  }, {
    status: 202
  });
}

async function cloudSourcesResponse(env: CloudEnv, workspaceId: string, presentationId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const rows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, title, source_type, url, object_key, created_at, updated_at
    FROM sources
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY updated_at DESC
  `).bind(workspaceId, presentationId).all<CloudRecord>();

  return jsonResponse({
    links: {
      presentation: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}` },
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/sources` }
    },
    presentationId,
    resource: "sourceCollection",
    sources: rows.results.map(sourceResource),
    workspaceId
  });
}

async function cloudSourceResponse(env: CloudEnv, workspaceId: string, presentationId: string, sourceId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const row = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, title, source_type, url, object_key, created_at, updated_at
    FROM sources
    WHERE workspace_id = ? AND presentation_id = ? AND id = ?
  `).bind(workspaceId, presentationId, sourceId).first<CloudRecord>();

  if (!row) {
    return notFound(`/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/sources/${sourceId}`);
  }

  const objectKey = asString(row.object_key);
  const object = await bindings.objectBucket.get(objectKey);
  if (!object) {
    return jsonResponse({
      code: "source-object-missing",
      error: "Source metadata exists but its R2 object is missing.",
      objectKey
    }, {
      status: 502
    });
  }

  return jsonResponse({
    links: {
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/sources/${sourceId}` },
      sources: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/sources` }
    },
    resource: "source",
    source: sourceResource(row),
    sourceDocument: JSON.parse(await object.text())
  });
}

async function createCloudSourceResponse(request: Request, env: CloudEnv, workspaceIdInput: string, presentationIdInput: string): Promise<Response> {
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
  let sourceId = "";
  try {
    workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    presentationId = assertCloudId(presentationIdInput, "presentation id");
    sourceId = assertCloudId(body.id, "source id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid source id.");
  }

  const text = asString(body.text);
  if (!text.trim()) {
    return badRequestResponse("text must be a non-empty string.");
  }
  if (text.length > maxSourceTextLength) {
    return badRequestResponse(`text must be ${maxSourceTextLength} characters or fewer.`);
  }

  const title = asString(body.title).trim() || sourceId;
  const url = asString(body.url).trim();
  const sourceType = url ? "url" : "note";
  const createdAt = nowIso();
  const objectKey = cloudObjectKey([presentationPrefix(workspaceId, presentationId), "sources", `${sourceId}.json`]);
  const sourceDocument = {
    id: sourceId,
    text,
    title,
    type: sourceType,
    url: url || null,
    workspaceId,
    presentationId
  };
  await bindings.objectBucket.put(objectKey, `${JSON.stringify(sourceDocument, null, 2)}\n`, {
    httpMetadata: { contentType: "application/json" }
  });
  await bindings.metadataDb.prepare(`
    INSERT OR REPLACE INTO sources (
      id, workspace_id, presentation_id, title, source_type, url, object_key, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(sourceId, workspaceId, presentationId, title, sourceType, url || null, objectKey, createdAt, createdAt).run();

  return jsonResponse({
    source: sourceResource({
      created_at: createdAt,
      id: sourceId,
      object_key: objectKey,
      presentation_id: presentationId,
      source_type: sourceType,
      title,
      updated_at: createdAt,
      url: url || null,
      workspace_id: workspaceId
    })
  }, {
    status: 201
  });
}

async function cloudMaterialsResponse(env: CloudEnv, workspaceId: string, presentationId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const rows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, title, media_type, file_name, object_key, created_at, updated_at
    FROM materials
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY updated_at DESC
  `).bind(workspaceId, presentationId).all<CloudRecord>();

  return jsonResponse({
    links: {
      presentation: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}` },
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/materials` }
    },
    materials: rows.results.map(materialResource),
    presentationId,
    resource: "materialCollection",
    workspaceId
  });
}

async function cloudMaterialResponse(env: CloudEnv, workspaceId: string, presentationId: string, materialId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const row = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, title, media_type, file_name, object_key, created_at, updated_at
    FROM materials
    WHERE workspace_id = ? AND presentation_id = ? AND id = ?
  `).bind(workspaceId, presentationId, materialId).first<CloudRecord>();

  if (!row) {
    return notFound(`/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/materials/${materialId}`);
  }

  const objectKey = asString(row.object_key);
  const object = await bindings.objectBucket.get(objectKey);
  if (!object) {
    return jsonResponse({
      code: "material-object-missing",
      error: "Material metadata exists but its R2 object is missing.",
      objectKey
    }, {
      status: 502
    });
  }

  return jsonResponse({
    links: {
      materials: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/materials` },
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/materials/${materialId}` }
    },
    material: materialResource(row),
    materialDocument: JSON.parse(await object.text()),
    resource: "material"
  });
}

async function cloudPresentationBundleResponse(env: CloudEnv, workspaceId: string, presentationId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const presentation = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, title, latest_version, r2_prefix, created_at, updated_at
    FROM presentations
    WHERE workspace_id = ? AND id = ?
  `).bind(workspaceId, presentationId).first<CloudRecord>();

  if (!presentation) {
    return notFound(`/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/bundle`);
  }

  const slideRows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, order_index, title, version, spec_object_key
    FROM slides
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY order_index ASC
  `).bind(workspaceId, presentationId).all<CloudRecord>();
  const sourceRows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, title, source_type, url, object_key, created_at, updated_at
    FROM sources
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY updated_at DESC
  `).bind(workspaceId, presentationId).all<CloudRecord>();
  const materialRows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, title, media_type, file_name, object_key, created_at, updated_at
    FROM materials
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY updated_at DESC
  `).bind(workspaceId, presentationId).all<CloudRecord>();

  const slides: Array<{ metadata: ReturnType<typeof slideResource>; slideSpec: unknown }> = [];
  for (const row of slideRows.results) {
    const slideSpec = await readCloudObjectJson(bindings.objectBucket, asString(row.spec_object_key), "bundle-object-missing");
    if (slideSpec instanceof Response) {
      return slideSpec;
    }
    slides.push({
      metadata: slideResource(row),
      slideSpec
    });
  }

  const sources: Array<{ metadata: ReturnType<typeof sourceResource>; sourceDocument: unknown }> = [];
  for (const row of sourceRows.results) {
    const sourceDocument = await readCloudObjectJson(bindings.objectBucket, asString(row.object_key), "bundle-object-missing");
    if (sourceDocument instanceof Response) {
      return sourceDocument;
    }
    sources.push({
      metadata: sourceResource(row),
      sourceDocument
    });
  }

  const materials: Array<{ materialDocument: unknown; metadata: ReturnType<typeof materialResource> }> = [];
  for (const row of materialRows.results) {
    const materialDocument = await readCloudObjectJson(bindings.objectBucket, asString(row.object_key), "bundle-object-missing");
    if (materialDocument instanceof Response) {
      return materialDocument;
    }
    materials.push({
      materialDocument,
      metadata: materialResource(row)
    });
  }

  return jsonResponse({
    bundleVersion: 1,
    links: {
      presentation: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}` },
      self: { href: `/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/bundle` }
    },
    materials,
    presentation: presentationResource(presentation),
    resource: "presentationBundle",
    slides,
    sources
  });
}

async function cloudRenderingProofDocumentResponse(env: CloudEnv, workspaceId: string, presentationId: string): Promise<Response> {
  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const presentation = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, title, latest_version, r2_prefix, created_at, updated_at
    FROM presentations
    WHERE workspace_id = ? AND id = ?
  `).bind(workspaceId, presentationId).first<CloudRecord>();
  if (!presentation) {
    return notFound(`/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/rendering-proof/document`);
  }

  const slideRows = await bindings.metadataDb.prepare(`
    SELECT id, workspace_id, presentation_id, order_index, title, version, spec_object_key
    FROM slides
    WHERE workspace_id = ? AND presentation_id = ?
    ORDER BY order_index ASC
  `).bind(workspaceId, presentationId).all<CloudRecord>();
  const slideItems = [];
  for (const row of slideRows.results) {
    const slideSpec = await readCloudObjectJson(bindings.objectBucket, asString(row.spec_object_key), "rendering-proof-object-missing");
    if (slideSpec instanceof Response) {
      return slideSpec;
    }
    const spec = asRecord(slideSpec) || {};
    const title = asString(spec.title).trim() || asString(row.title).trim() || asString(row.id);
    slideItems.push(`<li data-slide-id="${htmlEscape(asString(row.id))}">${htmlEscape(title)}</li>`);
  }

  const title = asString(presentation.title).trim() || presentationId;
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)} rendering proof</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; color: #172026; background: #f8fafc; }
    main { min-height: 100vh; display: grid; align-content: center; gap: 24px; padding: 48px; }
    h1 { font-size: 40px; margin: 0; }
    ol { display: grid; gap: 12px; margin: 0; padding-left: 24px; font-size: 20px; }
  </style>
</head>
<body>
  <main data-slideotter-render-proof="true" data-slide-count="${slideItems.length}">
    <h1>${htmlEscape(title)}</h1>
    <ol>${slideItems.join("")}</ol>
  </main>
</body>
</html>
`, {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

async function createCloudRenderingProofResponse(request: Request, env: CloudEnv, workspaceId: string, presentationId: string): Promise<Response> {
  const authError = requireCloudWriteAuth(request, env);
  if (authError) {
    return authError;
  }

  const bindings = requireCloudBindings(env);
  if (bindings instanceof Response) {
    return bindings;
  }

  const browser = await launchCloudBrowser(env);
  if (browser instanceof Response) {
    return browser;
  }

  const proofDocumentUrl = new URL(`/api/cloud/v1/workspaces/${workspaceId}/presentations/${presentationId}/rendering-proof/document`, request.url).href;
  const page = await browser.newPage();
  try {
    await page.goto(proofDocumentUrl, {
      waitUntil: "networkidle0"
    });
    const domValidation = await page.evaluate(() => {
      const proofRoot = document.querySelector("[data-slideotter-render-proof]");
      return {
        hasProofRoot: Boolean(proofRoot),
        slideCount: Number(proofRoot?.getAttribute("data-slide-count") || 0),
        title: document.title
      };
    });
    const screenshot = page.screenshot ? await page.screenshot({ type: "png" }) : "";
    const pdf = page.pdf ? await page.pdf({ format: "Letter", printBackground: true }) : "";
    const createdAt = nowIso();
    const reportObjectKey = cloudObjectKey([presentationPrefix(workspaceId, presentationId), "artifacts", `rendering-proof-${Date.now()}.json`]);
    const report = {
      createdAt,
      domValidation,
      pdfByteLength: byteLength(pdf),
      proofDocumentUrl,
      renderer: "cloudflare-browser-rendering",
      screenshotByteLength: byteLength(screenshot)
    };

    await bindings.objectBucket.put(reportObjectKey, `${JSON.stringify(report, null, 2)}\n`, {
      httpMetadata: { contentType: "application/json" }
    });

    return jsonResponse({
      report,
      reportObjectKey,
      resource: "hostedRenderingProof"
    });
  } finally {
    if (page.close) {
      await page.close();
    }
    await browser.close();
  }
}

async function createCloudMaterialResponse(request: Request, env: CloudEnv, workspaceIdInput: string, presentationIdInput: string): Promise<Response> {
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
  let materialId = "";
  try {
    workspaceId = assertCloudId(workspaceIdInput, "workspace id");
    presentationId = assertCloudId(presentationIdInput, "presentation id");
    materialId = assertCloudId(body.id, "material id");
  } catch (error) {
    return badRequestResponse(error instanceof Error ? error.message : "Invalid material id.");
  }

  const dataBase64 = asString(body.dataBase64).trim();
  if (!dataBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
    return badRequestResponse("dataBase64 must be a base64-encoded string.");
  }
  if (dataBase64.length > maxMaterialBase64Length) {
    return badRequestResponse(`dataBase64 must be ${maxMaterialBase64Length} characters or fewer.`);
  }

  const mediaType = asString(body.mediaType).trim();
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(mediaType)) {
    return badRequestResponse("mediaType must be image/png, image/jpeg, image/webp, or image/svg+xml.");
  }

  const fileName = asString(body.fileName).trim() || `${materialId}.${mediaType === "image/jpeg" ? "jpg" : "bin"}`;
  if (fileName.includes("/") || fileName.includes("..")) {
    return badRequestResponse("fileName must not contain path segments.");
  }

  const title = asString(body.title).trim() || materialId;
  const createdAt = nowIso();
  const objectKey = cloudObjectKey([presentationPrefix(workspaceId, presentationId), "materials", `${materialId}.json`]);
  const materialDocument = {
    alt: asString(body.alt).trim(),
    dataBase64,
    fileName,
    id: materialId,
    mediaType,
    presentationId,
    title,
    workspaceId
  };
  await bindings.objectBucket.put(objectKey, `${JSON.stringify(materialDocument, null, 2)}\n`, {
    httpMetadata: { contentType: "application/json" }
  });
  await bindings.metadataDb.prepare(`
    INSERT OR REPLACE INTO materials (
      id, workspace_id, presentation_id, title, media_type, file_name, object_key, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(materialId, workspaceId, presentationId, title, mediaType, fileName, objectKey, createdAt, createdAt).run();

  return jsonResponse({
    material: materialResource({
      created_at: createdAt,
      file_name: fileName,
      id: materialId,
      media_type: mediaType,
      object_key: objectKey,
      presentation_id: presentationId,
      title,
      updated_at: createdAt,
      workspace_id: workspaceId
    })
  }, {
    status: 201
  });
}

async function processCloudJobQueue(batch: CloudQueueBatch, env: CloudEnv): Promise<void> {
  const metadataDb = requireCloudMetadataBinding(env);
  if (metadataDb instanceof Response) {
    throw new Error("Cloud metadata binding is not configured for queue processing.");
  }

  for (const message of batch.messages) {
    const body = asRecord(message.body);
    if (!body) {
      continue;
    }
    const jobId = asString(body.id);
    const workspaceId = asString(body.workspaceId);
    const presentationId = asString(body.presentationId);
    if (!jobId || !workspaceId || !presentationId) {
      continue;
    }

    await metadataDb.prepare(`
      UPDATE jobs
      SET status = ?, updated_at = ?
      WHERE workspace_id = ? AND presentation_id = ? AND id = ?
    `).bind("completed", nowIso(), workspaceId, presentationId, jobId).run();
  }
}

function matchWorkspacePresentationsPath(pathname: string): string | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations$/.exec(pathname);
  return match && match[1] ? match[1] : null;
}

function matchWorkspacePresentationBundlesPath(pathname: string): string | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentation-bundles$/.exec(pathname);
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

function matchPresentationBundlePath(pathname: string): { presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/bundle$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

function matchPresentationRenderingProofPath(pathname: string): { presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/rendering-proof$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

function matchPresentationRenderingProofDocumentPath(pathname: string): { presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/rendering-proof\/document$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

function matchPresentationJobsPath(pathname: string): { presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/jobs$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

function matchPresentationSourcesPath(pathname: string): { presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/sources$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

function matchPresentationSourcePath(pathname: string): { presentationId: string; sourceId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/sources\/([a-z0-9][a-z0-9-]{0,63})$/.exec(pathname);
  return match && match[1] && match[2] && match[3] ? { presentationId: match[2], sourceId: match[3], workspaceId: match[1] } : null;
}

function matchPresentationMaterialsPath(pathname: string): { presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/materials$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

function matchPresentationMaterialPath(pathname: string): { materialId: string; presentationId: string; workspaceId: string } | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/materials\/([a-z0-9][a-z0-9-]{0,63})$/.exec(pathname);
  return match && match[1] && match[2] && match[3] ? { materialId: match[3], presentationId: match[2], workspaceId: match[1] } : null;
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

    const workspacePresentationBundlesId = matchWorkspacePresentationBundlesPath(url.pathname);
    if (workspacePresentationBundlesId && request.method === "POST") {
      return createCloudPresentationBundleResponse(request, env, workspacePresentationBundlesId);
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

    const presentationBundle = matchPresentationBundlePath(url.pathname);
    if (presentationBundle) {
      return cloudPresentationBundleResponse(env, presentationBundle.workspaceId, presentationBundle.presentationId);
    }

    const presentationRenderingProofDocument = matchPresentationRenderingProofDocumentPath(url.pathname);
    if (presentationRenderingProofDocument) {
      return cloudRenderingProofDocumentResponse(env, presentationRenderingProofDocument.workspaceId, presentationRenderingProofDocument.presentationId);
    }

    const presentationRenderingProof = matchPresentationRenderingProofPath(url.pathname);
    if (presentationRenderingProof && request.method === "POST") {
      return createCloudRenderingProofResponse(request, env, presentationRenderingProof.workspaceId, presentationRenderingProof.presentationId);
    }

    const presentationJobs = matchPresentationJobsPath(url.pathname);
    if (presentationJobs && request.method === "POST") {
      return createCloudJobResponse(request, env, presentationJobs.workspaceId, presentationJobs.presentationId);
    }

    if (presentationJobs) {
      return cloudJobsResponse(env, presentationJobs.workspaceId, presentationJobs.presentationId);
    }

    const presentationSources = matchPresentationSourcesPath(url.pathname);
    if (presentationSources && request.method === "POST") {
      return createCloudSourceResponse(request, env, presentationSources.workspaceId, presentationSources.presentationId);
    }

    if (presentationSources) {
      return cloudSourcesResponse(env, presentationSources.workspaceId, presentationSources.presentationId);
    }

    const presentationSource = matchPresentationSourcePath(url.pathname);
    if (presentationSource) {
      return cloudSourceResponse(env, presentationSource.workspaceId, presentationSource.presentationId, presentationSource.sourceId);
    }

    const presentationMaterials = matchPresentationMaterialsPath(url.pathname);
    if (presentationMaterials && request.method === "POST") {
      return createCloudMaterialResponse(request, env, presentationMaterials.workspaceId, presentationMaterials.presentationId);
    }

    if (presentationMaterials) {
      return cloudMaterialsResponse(env, presentationMaterials.workspaceId, presentationMaterials.presentationId);
    }

    const presentationMaterial = matchPresentationMaterialPath(url.pathname);
    if (presentationMaterial) {
      return cloudMaterialResponse(env, presentationMaterial.workspaceId, presentationMaterial.presentationId, presentationMaterial.materialId);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  },

  queue(batch: CloudQueueBatch, env: CloudEnv): Promise<void> {
    return processCloudJobQueue(batch, env);
  }
};
