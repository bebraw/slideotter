const fs = require("fs");
const path = require("path");
const { logsDir, mode, userDataRoot } = require("./paths.ts");

type SerializedError = {
  cause?: SerializedError;
  code?: unknown;
  message: string;
  name?: string;
  stack?: string;
};

type GenerationErrorContext = {
  deckTitle?: unknown;
  operation?: unknown;
  planSlide?: unknown;
  runId?: unknown;
  slideCount?: unknown;
  slideIndex?: unknown;
  workflow?: unknown;
};

function sanitizeFilePart(value: unknown, fallback = "error") {
  const safe = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return safe || fallback;
}

function serializeError(error: unknown): SerializedError {
  if (!error) {
    return {
      message: "Unknown error"
    };
  }

  const errorRecord = error && typeof error === "object"
    ? error as Record<string, unknown>
    : null;
  const serialized: SerializedError = {
    message: String(errorRecord?.message || error),
    name: String(errorRecord?.name || "Error")
  };

  if (errorRecord?.code) {
    serialized.code = errorRecord.code;
  }
  if (errorRecord?.stack) {
    serialized.stack = String(errorRecord.stack);
  }
  if (errorRecord?.cause) {
    serialized.cause = serializeError(errorRecord.cause);
  }

  return serialized;
}

function writeGenerationErrorDiagnostic(error: unknown, context: GenerationErrorContext = {}) {
  const timestamp = new Date().toISOString();
  const hasSlideIndex = context.slideIndex !== null
    && context.slideIndex !== undefined
    && Number.isFinite(Number(context.slideIndex));
  const slideNumber = hasSlideIndex
    ? Number(context.slideIndex) + 1
    : null;
  const runPart = sanitizeFilePart(context.runId, "content-run");
  const slidePart = slideNumber ? `slide-${slideNumber}` : "run";
  const fileName = `${timestamp.replace(/[:.]/g, "-")}-${runPart}-${slidePart}.json`;
  const dir = path.join(logsDir, "generation-errors");
  const filePath = path.join(dir, fileName);
  const latestPath = path.join(dir, "latest-generation-error.json");
  const diagnostic = {
    context: {
      deckTitle: context.deckTitle || "",
      failedSlideIndex: hasSlideIndex ? Number(context.slideIndex) : null,
      failedSlideNumber: slideNumber,
      operation: context.operation || "",
      planSlide: context.planSlide || null,
      runId: context.runId || "",
      runtime: {
        mode,
        userDataRoot
      },
      slideCount: Number.isFinite(Number(context.slideCount)) ? Number(context.slideCount) : null,
      workflow: context.workflow || null
    },
    error: serializeError(error),
    timestamp
  };

  fs.mkdirSync(dir, { recursive: true });
  const body = `${JSON.stringify(diagnostic, null, 2)}\n`;
  fs.writeFileSync(filePath, body, "utf8");
  fs.writeFileSync(latestPath, body, "utf8");

  return {
    filePath,
    latestPath
  };
}

module.exports = {
  writeGenerationErrorDiagnostic
};
