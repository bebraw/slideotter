import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

type ServerRequest = import("http").IncomingMessage;
type ServerResponse = import("http").ServerResponse;
type JsonObject = Record<string, unknown>;

export function createJsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(body);
}

export function createTextResponse(
  res: ServerResponse,
  statusCode: number,
  body: string,
  contentType = "text/plain; charset=utf-8"
): void {
  res.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": contentType
  });
  res.end(body);
}

export function notFound(res: ServerResponse): void {
  createTextResponse(res, 404, "Not found");
}

function readBody(req: ServerRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk: Buffer | string) => {
      body += chunk;
      if (body.length > 7 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export async function readJsonBody(req: ServerRequest): Promise<JsonObject> {
  const body = await readBody(req);
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Request body must be valid JSON");
  }
}

export function sendFile(res: ServerResponse, fileName: string): void {
  if (!fs.existsSync(fileName) && path.extname(fileName).toLowerCase() === ".js") {
    const tsFileName = `${fileName.slice(0, -3)}.ts`;
    if (fs.existsSync(tsFileName) && fs.statSync(tsFileName).isFile()) {
      const source = fs.readFileSync(tsFileName, "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.None,
          target: ts.ScriptTarget.ES2022
        },
        fileName: tsFileName
      }).outputText;
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "application/javascript; charset=utf-8"
      });
      res.end(output);
      return;
    }
  }

  if (!fs.existsSync(fileName) || !fs.statSync(fileName).isFile()) {
    notFound(res);
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".svg": "image/svg+xml; charset=utf-8",
    ".webp": "image/webp"
  };
  const contentType = contentTypes[ext] || "application/octet-stream";
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Content-Type": contentType
  };

  if (ext === ".pdf" || ext === ".pptx") {
    headers["Content-Disposition"] = `attachment; filename="${path.basename(fileName).replace(/["\\\r\n]/gu, "_")}"`;
  }

  const stream = fs.createReadStream(fileName);
  res.writeHead(200, headers);
  stream.pipe(res);
}
