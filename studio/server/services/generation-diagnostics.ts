const fs = require("fs");
const path = require("path");
const { logsDir, mode, userDataRoot } = require("./paths.ts");

function sanitizeFilePart(value, fallback = "error") {
  const safe = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return safe || fallback;
}

function serializeError(error) {
  if (!error) {
    return {
      message: "Unknown error"
    };
  }

  const serialized: any = {
    message: String(error.message || error),
    name: error.name || "Error"
  };

  if (error.code) {
    serialized.code = error.code;
  }
  if (error.stack) {
    serialized.stack = String(error.stack);
  }
  if (error.cause) {
    serialized.cause = serializeError(error.cause);
  }

  return serialized;
}

function writeGenerationErrorDiagnostic(error, context: any = {}) {
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
