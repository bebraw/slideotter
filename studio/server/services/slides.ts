const fs = require("fs");
const path = require("path");
const { getActivePresentationPaths, getPresentationPaths } = require("./presentations.ts");
const { extractSlideSpec, materializeSlideSpec, validateSlideSpec } = require("./slide-specs/index.ts");
const {
  writeAllowedJson,
  writeAllowedText
} = require("./write-boundary.ts");

type JsonRecord = Record<string, unknown>;

type SlideOptions = {
  includeArchived?: unknown;
  includeSkipped?: unknown;
  presentationId?: unknown;
};

type SlideInfo = {
  archived: boolean;
  fileName: string;
  id: string;
  index: number;
  path: string;
  skipMeta: JsonRecord | null;
  skipReason: string;
  skipped: boolean;
  sourcePath: string | null;
  structured: boolean;
  title: string;
};

type StructuredSlideSortInfo = {
  archived: boolean;
  fileName: string;
  filePath: string;
  skipMeta: JsonRecord | null;
  skipReason: string;
  skipped: boolean;
  sortIndex: number;
  title: string;
};

type SlideSpec = JsonRecord & {
  archived?: boolean;
  index?: unknown;
  skipMeta?: unknown;
  skipped?: boolean;
  skipReason?: unknown;
  title?: unknown;
};

type WriteSlideSpecOptions = {
  preservePlacement?: unknown;
};

type SkipSlideOptions = {
  reason?: unknown;
  skippedAt?: unknown;
  targetCount?: unknown;
};

type RestoreSlideOptions = {
  targetIndex?: unknown;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8")) as T;
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown) {
  writeAllowedJson(fileName, value);
}

function getSlidesDir(options: SlideOptions = {}): string {
  if (typeof options.presentationId === "string" && options.presentationId) {
    return getPresentationPaths(options.presentationId).slidesDir;
  }

  return getActivePresentationPaths().slidesDir;
}

function peekNextStructuredSlideFileName() {
  const slidesDir = getSlidesDir();
  const allFiles: string[] = fs.existsSync(slidesDir) ? fs.readdirSync(slidesDir) : [];
  const nextIndex = allFiles
    .map((fileName) => {
      const match = fileName.match(/^slide-(\d+)\.json$/);
      return match ? Number(match[1]) : 0;
    })
    .reduce((maximum, value) => Math.max(maximum, value), 0) + 1;

  return `slide-${String(nextIndex).padStart(2, "0")}.json`;
}

function readStructuredSlideDocumentFile(fileName: string): JsonRecord {
  const parsed = readJson(fileName, {});

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Structured slide JSON must contain an object");
  }

  return asRecord(parsed);
}

function splitStructuredSlideDocument(document: unknown): { slideSpec: SlideSpec; variants: unknown[] } {
  const {
    variants,
    ...slideSpec
  } = asRecord(document);

  return {
    slideSpec,
    variants: []
  };
}

function dehydrateSlideSpecForStorage(slideSpec: unknown): JsonRecord {
  const next = { ...asRecord(slideSpec) };
  const customVisual = asRecord(next.customVisual);

  if (customVisual.id) {
    const reference = { ...customVisual };
    delete reference.content;
    next.customVisual = reference;
  }

  return next;
}

function buildStructuredSlideDocument(slideSpec: unknown) {
  return {
    ...dehydrateSlideSpecForStorage(validateSlideSpec(slideSpec))
  };
}

function extractTitle(source: string, fileName: string): string {
  if (fileName.endsWith(".json")) {
    const record = readJson<JsonRecord>(source, {});
    return typeof record.title === "string" ? record.title : "";
  }

  const match = fs.readFileSync(source, "utf8").match(/title:\s*"([^"]+)"/);
  return match && match[1] ? match[1] : "";
}

function getSlideFiles(options: SlideOptions = {}): string[] {
  const slidesDir = getSlidesDir(options);
  const allFiles: string[] = fs.existsSync(slidesDir) ? fs.readdirSync(slidesDir) : [];
  const jsonFiles = allFiles.filter((fileName) => /^slide-\d+\.json$/.test(fileName)).sort(compareNames);

  if (jsonFiles.length) {
    return jsonFiles;
  }

  return allFiles
    .filter((fileName) => /^slide-\d+\.js$/.test(fileName))
    .sort(compareNames);
}

function readStructuredSlideSortInfo(fileName: string, options: SlideOptions = {}): StructuredSlideSortInfo {
  const slidesDir = getSlidesDir(options);
  const filePath = path.join(slidesDir, fileName);
  const document = readStructuredSlideDocumentFile(filePath);
  const { slideSpec } = splitStructuredSlideDocument(document);
  const numericIndex = Number(slideSpec.index);
  const archived = slideSpec.archived === true;
  const skipped = slideSpec.skipped === true;

  return {
    archived,
    fileName,
    filePath,
    skipMeta: slideSpec.skipMeta && typeof slideSpec.skipMeta === "object" && !Array.isArray(slideSpec.skipMeta)
      ? asRecord(slideSpec.skipMeta)
      : null,
    skipReason: typeof slideSpec.skipReason === "string" ? slideSpec.skipReason : "",
    skipped,
    sortIndex: Number.isFinite(numericIndex) ? numericIndex : Number.MAX_SAFE_INTEGER,
    title: typeof slideSpec.title === "string" ? slideSpec.title : ""
  };
}

function getSlides(options: SlideOptions = {}): SlideInfo[] {
  const includeArchived = options.includeArchived === true;
  const includeSkipped = options.includeSkipped === true;
  const slideFiles = getSlideFiles(options);
  const firstSlideFile = slideFiles[0] || "";
  const orderedFiles = firstSlideFile.endsWith(".json")
    ? slideFiles
      .map((fileName) => readStructuredSlideSortInfo(fileName, options))
      .filter((entry) => (includeArchived || !entry.archived) && (includeSkipped || !entry.skipped))
      .sort((left, right) => {
        if (left.sortIndex !== right.sortIndex) {
          return left.sortIndex - right.sortIndex;
        }

        return compareNames(left.fileName, right.fileName);
      })
      .map((entry) => entry.fileName)
    : slideFiles;

  return orderedFiles.map((fileName, index) => {
    const slidesDir = getSlidesDir(options);
    const filePath = path.join(slidesDir, fileName);
    const slideId = path.basename(fileName, path.extname(fileName));
    const structured = fileName.endsWith(".json");
    const sortInfo = structured
      ? readStructuredSlideSortInfo(fileName, options)
      : {
          archived: false,
          skipMeta: null,
          skipReason: "",
          skipped: false
        };

    return {
      archived: sortInfo.archived,
      fileName,
      id: slideId,
      index: index + 1,
      path: filePath,
      skipMeta: sortInfo.skipMeta,
      skipReason: sortInfo.skipReason,
      skipped: sortInfo.skipped,
      sourcePath: structured ? null : filePath,
      structured,
      title: extractTitle(filePath, fileName) || `Slide ${index + 1}`
    };
  });
}

function getSlide(slideId: string, options: SlideOptions = {}): SlideInfo {
  const slide = getSlides({
    includeArchived: options.includeArchived === true,
    includeSkipped: options.includeSkipped === true,
    presentationId: options.presentationId
  }).find((entry) => entry.id === slideId);
  if (!slide) {
    throw new Error(`Unknown slide: ${slideId}`);
  }
  return slide;
}

function readSlideSource(slideId: string, options: SlideOptions = {}): string {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId: options.presentationId
  });
  return fs.readFileSync(slide.path, "utf8");
}

function writeSlideSource(slideId: string, source: string): SlideInfo {
  const slide = getSlide(slideId, { includeArchived: true, includeSkipped: true });
  if (slide.structured) {
    throw new Error("Raw source writes are disabled for structured JSON slides.");
  }

  writeAllowedText(slide.path, source);
  return slide;
}

function readSlideSpec(slideId: string, options: SlideOptions = {}): SlideSpec {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId: options.presentationId
  });

  if (slide.structured) {
    const { slideSpec } = splitStructuredSlideDocument(readStructuredSlideDocumentFile(slide.path));
    return validateSlideSpec(slideSpec);
  }

  return extractSlideSpec(readSlideSource(slideId, options));
}

function getSlideSpecWithPreservedPlacement(slideId: string, slide: SlideInfo, slideSpec: SlideSpec): SlideSpec {
  const currentSpec = readSlideSpec(slideId);
  const nextSpec: SlideSpec = {
    ...slideSpec,
    archived: currentSpec.archived === true,
    index: Number.isFinite(Number(currentSpec.index)) ? currentSpec.index : slide.index,
    skipped: currentSpec.skipped === true
  };

  if (currentSpec.skipReason !== undefined) {
    nextSpec.skipReason = currentSpec.skipReason;
  } else {
    delete nextSpec.skipReason;
  }

  if (currentSpec.skipMeta !== undefined) {
    nextSpec.skipMeta = currentSpec.skipMeta;
  } else {
    delete nextSpec.skipMeta;
  }

  return nextSpec;
}

function writeSlideSpec(slideId: string, slideSpec: SlideSpec, options: WriteSlideSpecOptions = {}): SlideInfo {
  const slide = getSlide(slideId, { includeArchived: true, includeSkipped: true });
  const candidate = options.preservePlacement === true
    ? getSlideSpecWithPreservedPlacement(slideId, slide, slideSpec)
    : slideSpec;
  const validated = validateSlideSpec(candidate);

  if (slide.structured) {
    writeJson(slide.path, buildStructuredSlideDocument(validated));
    return slide;
  }

  const currentSource = readSlideSource(slideId);
  writeSlideSource(slideId, materializeSlideSpec(currentSource, validated));
  return slide;
}

function compactActiveSlideIndices() {
  const activeSlides = getSlides();

  activeSlides.forEach((slide, index) => {
    const currentSpec = readSlideSpec(slide.id);
    const nextIndex = index + 1;

    if (currentSpec.index === nextIndex) {
      return;
    }

    writeSlideSpec(slide.id, {
      ...currentSpec,
      index: nextIndex
    });
  });

  return getSlides();
}

function skipStructuredSlide(slideId: string, options: SkipSlideOptions = {}): SlideInfo {
  const activeSlides = getSlides();
  const slide = activeSlides.find((entry) => entry.id === slideId);
  if (!slide) {
    throw new Error(`Unknown active slide: ${slideId}`);
  }

  if (!slide.structured) {
    throw new Error("Slide length scaling is available for structured JSON slides only.");
  }

  if (activeSlides.length <= 1) {
    throw new Error("Cannot skip the only active slide in the deck.");
  }

  const slideSpec = readSlideSpec(slideId);
  const timestamp = typeof options.skippedAt === "string" ? options.skippedAt : new Date().toISOString();
  writeSlideSpec(slideId, {
    ...slideSpec,
    skipped: true,
    skipReason: typeof options.reason === "string" ? options.reason : `Scaled to ${options.targetCount} slides`,
    skipMeta: {
      ...(slideSpec.skipMeta && typeof slideSpec.skipMeta === "object" && !Array.isArray(slideSpec.skipMeta) ? slideSpec.skipMeta : {}),
      operation: "scale-deck-length",
      previousIndex: Number.isFinite(Number(slideSpec.index)) ? Number(slideSpec.index) : slide.index,
      skippedAt: timestamp,
      targetCount: Number.isFinite(Number(options.targetCount)) ? Number(options.targetCount) : null
    }
  });

  return slide;
}

function restoreSkippedSlide(slideId: string, options: RestoreSlideOptions = {}): SlideInfo {
  const slide = getSlide(slideId, { includeSkipped: true });
  if (!slide.skipped) {
    return slide;
  }

  if (!slide.structured) {
    throw new Error("Slide restoration is available for structured JSON slides only.");
  }

  const slideSpec = readSlideSpec(slideId);
  const skipMeta = asRecord(slideSpec.skipMeta);
  const requestedIndex = Number(options.targetIndex);
  const previousIndex = Number(skipMeta.previousIndex);
  const nextIndex = Number.isFinite(requestedIndex)
    ? requestedIndex
    : Number.isFinite(previousIndex)
      ? previousIndex
      : slideSpec.index;
  const restoredSpec = {
    ...slideSpec,
    archived: false,
    index: nextIndex,
    skipped: false
  };
  delete restoredSpec.skipReason;
  delete restoredSpec.skipMeta;

  writeSlideSpec(slideId, restoredSpec);
  return getSlide(slideId);
}

function createStructuredSlide(slideSpec: SlideSpec) {
  const validated = validateSlideSpec(slideSpec);
  const fileName = peekNextStructuredSlideFileName();
  const slidesDir = getSlidesDir();
  const filePath = path.join(slidesDir, fileName);
  writeJson(filePath, buildStructuredSlideDocument(validated));

  return {
    fileName,
    id: path.basename(fileName, path.extname(fileName)),
    path: filePath,
    slideSpec: validated
  };
}

function insertStructuredSlide(slideSpec: SlideSpec, targetIndex: unknown) {
  const activeSlides = getSlides();
  const requestedIndex = Number(targetIndex);
  const nextIndex = Number.isFinite(requestedIndex)
    ? Math.min(Math.max(1, Math.round(requestedIndex)), activeSlides.length + 1)
    : activeSlides.length + 1;

  activeSlides
    .filter((slide) => slide.index >= nextIndex)
    .sort((left, right) => right.index - left.index)
    .forEach((slide) => {
      const currentSpec = readSlideSpec(slide.id);
      writeSlideSpec(slide.id, {
        ...currentSpec,
        index: slide.index + 1
      });
    });

  return createStructuredSlide({
    ...slideSpec,
    index: nextIndex
  });
}

function archiveStructuredSlide(slideId: string): SlideInfo {
  const activeSlides = getSlides();
  const slide = activeSlides.find((entry) => entry.id === slideId);
  if (!slide) {
    throw new Error(`Unknown active slide: ${slideId}`);
  }

  if (!slide.structured) {
    throw new Error("Manual slide removal is available for structured JSON slides only.");
  }

  if (activeSlides.length <= 1) {
    throw new Error("Cannot remove the only slide in the deck.");
  }

  const slideSpec = readSlideSpec(slideId);
  writeSlideSpec(slideId, {
    ...slideSpec,
    archived: true
  });

  activeSlides
    .filter((entry) => entry.id !== slideId && entry.index > slide.index)
    .sort((left, right) => left.index - right.index)
    .forEach((entry) => {
      const currentSpec = readSlideSpec(entry.id);
      writeSlideSpec(entry.id, {
        ...currentSpec,
        index: entry.index - 1
      });
    });

  return slide;
}

module.exports = {
  archiveStructuredSlide,
  compactActiveSlideIndices,
  getSlide,
  getSlides,
  createStructuredSlide,
  insertStructuredSlide,
  peekNextStructuredSlideFileName,
  readSlideSpec,
  readSlideSource,
  restoreSkippedSlide,
  skipStructuredSlide,
  writeSlideSpec,
  writeSlideSource
};
