import * as http from "http";
import * as path from "path";
import { URL } from "url";
import { fileURLToPath } from "url";
import { handleApi } from "./api-dispatch.ts";
import { createJsonResponse } from "./http-responses.ts";
import {
  publishRuntimeState,
  runtimeState,
  updateWorkflowState
} from "./runtime-state.ts";
import { errorCode, errorMessage, errorStatusCode } from "./server-errors.ts";
import { loadEnvFiles } from "./services/env.ts";
import {
  clearPresentationCreationDraft
} from "./services/presentations.ts";
import { ensureState } from "./services/state.ts";
import { handleStatic } from "./static-routes.ts";

loadEnvFiles();

const defaultPort = Number(process.env.PORT || 4173);
const defaultHost = process.env.HOST || "127.0.0.1";

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;
type ServerStartOptions = {
  host?: string;
  port?: number | string;
};

async function requestHandler(req: ServerRequest, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    handleStatic(req, res, url);
  } catch (error) {
    if (runtimeState.workflow && runtimeState.workflow.status === "running") {
      updateWorkflowState({
        message: errorMessage(error),
        ok: false,
        stage: "failed",
        status: "failed"
      });
    }
    runtimeState.lastError = {
      message: errorMessage(error),
      updatedAt: new Date().toISOString()
    };
    publishRuntimeState();
    createJsonResponse(res, errorStatusCode(error), {
      code: errorCode(error),
      error: errorMessage(error)
    });
  }
}

function startServer(options: ServerStartOptions = {}) {
  const host = options.host || defaultHost;
  const port = Number(options.port ?? defaultPort);

  ensureState();
  clearPresentationCreationDraft();

  const server = http.createServer(requestHandler);
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = address && typeof address === "object" ? address.port : port;
    process.stdout.write(`Presentation studio available at http://${host}:${actualPort}\n`);
  });

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}

export {
  startServer
};
