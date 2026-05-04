import * as fs from "fs";
import * as path from "path";
import { createTextResponse, notFound, sendFile } from "./http-responses.ts";
import { getMaterialFilePath } from "./services/materials.ts";
import { clientDistDir, outputDir } from "./services/paths.ts";
import { renderDomPreviewDocument, renderPresentationPreviewDocument } from "./services/dom-preview.ts";

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;

export function handleStatic(req: ServerRequest, res: ServerResponse, url: URL): void {
  if (req.method === "GET" && url.pathname === "/deck-preview") {
    createTextResponse(res, 200, renderDomPreviewDocument(), "text/html; charset=utf-8");
    return;
  }

  if (req.method === "GET" && url.pathname === "/present") {
    createTextResponse(res, 200, renderPresentationPreviewDocument(), "text/html; charset=utf-8");
    return;
  }

  const presentationPreviewMatch = url.pathname.match(/^\/present\/([a-z0-9-]+)$/);
  if (req.method === "GET" && presentationPreviewMatch) {
    const presentationId = presentationPreviewMatch[1];
    if (!presentationId) {
      notFound(res);
      return;
    }
    createTextResponse(res, 200, renderPresentationPreviewDocument({
      presentationId
    }), "text/html; charset=utf-8");
    return;
  }

  const materialMatch = url.pathname.match(/^\/presentation-materials\/([a-z0-9-]+)\/([^/]+)$/);
  if (materialMatch) {
    const presentationId = materialMatch[1];
    const fileName = materialMatch[2];
    if (!presentationId || !fileName) {
      notFound(res);
      return;
    }
    sendFile(res, getMaterialFilePath(decodeURIComponent(presentationId), decodeURIComponent(fileName)));
    return;
  }

  if (url.pathname.startsWith("/studio-output/")) {
    const assetPath = path.join(outputDir, url.pathname.replace("/studio-output/", ""));
    sendFile(res, assetPath);
    return;
  }

  const fileName = url.pathname === "/"
    ? path.join(clientDistDir, "index.html")
    : path.join(clientDistDir, url.pathname.replace(/^\/+/, ""));

  if (fs.existsSync(fileName) && fs.statSync(fileName).isFile()) {
    sendFile(res, fileName);
    return;
  }

  sendFile(res, path.join(clientDistDir, "index.html"));
}
