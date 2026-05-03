const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init.headers
    }
  });
}

export function notFound(pathname: string): Response {
  return jsonResponse({
    error: "Not found",
    path: pathname
  }, {
    status: 404
  });
}

export function missingCloudBindingsResponse(): Response {
  return jsonResponse({
    code: "cloud-bindings-missing",
    error: "Cloud metadata and object bindings are not configured for this environment."
  }, {
    status: 503
  });
}

export function missingAuthConfigResponse(): Response {
  return jsonResponse({
    code: "cloud-auth-missing",
    error: "Cloud write authentication is not configured for this environment."
  }, {
    status: 503
  });
}

export function unauthorizedResponse(): Response {
  return jsonResponse({
    code: "unauthorized",
    error: "A valid bearer token is required for this cloud write."
  }, {
    status: 401
  });
}

export function conflictResponse(message: string, currentVersion: number): Response {
  return jsonResponse({
    code: "version-conflict",
    currentVersion,
    error: message
  }, {
    status: 409
  });
}

export function badRequestResponse(message: string): Response {
  return jsonResponse({
    code: "bad-request",
    error: message
  }, {
    status: 400
  });
}

export function missingBrowserRenderingResponse(): Response {
  return jsonResponse({
    code: "browser-rendering-missing",
    error: "Cloudflare Browser Rendering is not configured for this environment."
  }, {
    status: 503
  });
}
