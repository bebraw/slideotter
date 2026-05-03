import * as http from "http";
import * as path from "path";

import { buildAndRenderDeck, exportDeckPptx, getPreviewManifest } from "./services/build.ts";
import { outputDir } from "./services/paths.ts";
import { remediateCheckIssue } from "./services/operations.ts";
import { validateDeck } from "./services/validate.ts";
import { listAllVariants } from "./services/variants.ts";

type ServerRequest = http.IncomingMessage;
type ServerResponse = http.ServerResponse;
type JsonObject = Record<string, unknown>;

type RuntimeStateAccess = {
  build: {
    ok: boolean;
    updatedAt: string | null;
  };
  lastError: {
    message?: string;
    updatedAt?: string;
  } | null;
  validation: JsonObject | null;
};

type BuildValidationHandlerDependencies = {
  createJsonResponse: (res: ServerResponse, statusCode: number, payload: unknown) => void;
  publishRuntimeState: () => void;
  readJsonBody: (req: ServerRequest) => Promise<JsonObject>;
  runtimeState: RuntimeStateAccess;
  serializeRuntimeState: () => JsonObject;
  updateWorkflowState: (nextWorkflow: JsonObject) => void;
};

export function createBuildValidationHandlers(deps: BuildValidationHandlerDependencies) {
  const {
    createJsonResponse,
    publishRuntimeState,
    readJsonBody,
    runtimeState,
    serializeRuntimeState,
    updateWorkflowState
  } = deps;

  async function handleBuild(res: ServerResponse): Promise<void> {
    const result = await buildAndRenderDeck();
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    runtimeState.lastError = null;
    publishRuntimeState();

    createJsonResponse(res, 200, {
      pdf: {
        path: result.build.pdfFile,
        url: `/studio-output/${path.relative(outputDir, result.build.pdfFile).split(path.sep).join("/")}`
      },
      previews: result.previews,
      runtime: serializeRuntimeState()
    });
  }

  async function handlePptxExport(res: ServerResponse): Promise<void> {
    updateWorkflowState({
      message: "Exporting PowerPoint handoff...",
      ok: false,
      operation: "export-pptx",
      stage: "rendering-pptx",
      status: "running"
    });
    const result = await exportDeckPptx();
    runtimeState.build = {
      ok: true,
      updatedAt: new Date().toISOString()
    };
    runtimeState.lastError = null;
    updateWorkflowState({
      message: `Exported PPTX with ${result.diagnostics.slideCount} slide${result.diagnostics.slideCount === 1 ? "" : "s"}.`,
      ok: true,
      operation: "export-pptx",
      stage: "complete",
      status: "complete"
    });
    publishRuntimeState();

    createJsonResponse(res, 200, {
      diagnostics: result.diagnostics,
      pptx: {
        path: result.pptxFile,
        url: `/studio-output/${path.relative(outputDir, result.pptxFile).split(path.sep).join("/")}`
      },
      runtime: serializeRuntimeState()
    });
  }

  async function handleValidate(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    updateWorkflowState({
      includeRender: body.includeRender === true,
      message: body.includeRender === true
        ? "Running full render validation..."
        : "Running geometry and text validation...",
      ok: false,
      operation: "validate",
      stage: body.includeRender === true ? "validating-render" : "validating-geometry-text",
      status: "running"
    });
    const result = await validateDeck({
      includeRender: body.includeRender === true
    });

    runtimeState.validation = {
      includeRender: body.includeRender === true,
      ok: result.ok,
      updatedAt: new Date().toISOString()
    };
    updateWorkflowState({
      includeRender: body.includeRender === true,
      message: result.ok ? "Validation completed without blocking issues." : "Validation completed and found issues.",
      ok: result.ok,
      operation: "validate",
      stage: "completed",
      status: "completed"
    });
    runtimeState.lastError = null;
    publishRuntimeState();
    createJsonResponse(res, 200, {
      ...result,
      runtime: serializeRuntimeState()
    });
  }

  async function handleCheckRemediation(req: ServerRequest, res: ServerResponse): Promise<void> {
    const body = await readJsonBody(req);
    const slideId = typeof body.slideId === "string" ? body.slideId : "";
    if (!slideId) {
      throw new Error("Expected slideId when creating check remediation candidates");
    }

    const result = await remediateCheckIssue(slideId, {
      blockName: body.blockName,
      issue: body.issue,
      issueIndex: body.issueIndex
    });
    runtimeState.lastError = null;
    publishRuntimeState();
    createJsonResponse(res, 200, {
      ...result,
      previews: getPreviewManifest(),
      runtime: serializeRuntimeState(),
      variants: listAllVariants()
    });
  }

  return {
    handleBuild,
    handleCheckRemediation,
    handlePptxExport,
    handleValidate
  };
}
