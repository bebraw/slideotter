const fs = require("fs");
const path = require("path");
const { getActivePresentationPaths, getPresentationPaths } = require("./presentations.ts");
const { extractSlideSpec, materializeSlideSpec, validateSlideSpec } = require("./slide-specs/index.ts");
const {
  writeAllowedJson,
  writeAllowedText
} = require("./write-boundary.ts");

function compareNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function readJson(fileName, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName, value) {
  writeAllowedJson(fileName, value);
}

function getSlidesDir(options: any = {}) {
  if (options.presentationId) {
    return getPresentationPaths(options.presentationId).slidesDir;
  }

  return getActivePresentationPaths().slidesDir;
}

function peekNextStructuredSlideFileName() {
  const slidesDir = getSlidesDir();
  const allFiles = fs.existsSync(slidesDir) ? fs.readdirSync(slidesDir) : [];
  const nextIndex = allFiles
    .map((fileName) => {
      const match = fileName.match(/^slide-(\d+)\.json$/);
      return match ? Number(match[1]) : 0;
    })
    .reduce((maximum, value) => Math.max(maximum, value), 0) + 1;

  return `slide-${String(nextIndex).padStart(2, "0")}.json`;
}

function readStructuredSlideDocumentFile(fileName) {
  const parsed = readJson(fileName, {});

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Structured slide JSON must contain an object");
  }

  return parsed;
}

function splitStructuredSlideDocument(document) {
  const {
    variants,
    ...slideSpec
  } = document || {};

  return {
    slideSpec,
    variants: []
  };
}

function buildStructuredSlideDocument(slideSpec) {
  return {
    ...validateSlideSpec(slideSpec)
  };
}

function extractTitle(source, fileName) {
  if (fileName.endsWith(".json")) {
    const parsed = readJson(source, {});
    return parsed && parsed.title ? parsed.title : "";
  }

  const match = fs.readFileSync(source, "utf8").match(/title:\s*"([^"]+)"/);
  return match ? match[1] : "";
}

function getSlideFiles(options: any = {}) {
  const slidesDir = getSlidesDir(options);
  const allFiles = fs.existsSync(slidesDir) ? fs.readdirSync(slidesDir) : [];
  const jsonFiles = allFiles.filter((fileName) => /^slide-\d+\.json$/.test(fileName)).sort(compareNames);

  if (jsonFiles.length) {
    return jsonFiles;
  }

  return allFiles
    .filter((fileName) => /^slide-\d+\.js$/.test(fileName))
    .sort(compareNames);
}

function readStructuredSlideSortInfo(fileName, options: any = {}) {
  const slidesDir = getSlidesDir(options);
  const filePath = path.join(slidesDir, fileName);
  const document = readStructuredSlideDocumentFile(filePath);
  const { slideSpec } = splitStructuredSlideDocument(document);
  const numericIndex = Number(slideSpec && slideSpec.index);
  const archived = slideSpec && slideSpec.archived === true;
  const skipped = slideSpec && slideSpec.skipped === true;

  return {
    archived,
    fileName,
    filePath,
    skipMeta: slideSpec && slideSpec.skipMeta && typeof slideSpec.skipMeta === "object" && !Array.isArray(slideSpec.skipMeta)
      ? slideSpec.skipMeta
      : null,
    skipReason: slideSpec && typeof slideSpec.skipReason === "string" ? slideSpec.skipReason : "",
    skipped,
    sortIndex: Number.isFinite(numericIndex) ? numericIndex : Number.MAX_SAFE_INTEGER,
    title: slideSpec && slideSpec.title ? slideSpec.title : ""
  };
}

function getSlides(options: any = {}) {
  const includeArchived = options.includeArchived === true;
  const includeSkipped = options.includeSkipped === true;
  const slideFiles = getSlideFiles(options);
  const orderedFiles = slideFiles.length && slideFiles[0].endsWith(".json")
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

function getSlide(slideId, options: any = {}) {
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

function readSlideSource(slideId, options: any = {}) {
  const slide = getSlide(slideId, {
    includeArchived: true,
    includeSkipped: true,
    presentationId: options.presentationId
  });
  return fs.readFileSync(slide.path, "utf8");
}

function writeSlideSource(slideId, source) {
  const slide = getSlide(slideId, { includeArchived: true, includeSkipped: true });
  if (slide.structured) {
    throw new Error("Raw source writes are disabled for structured JSON slides.");
  }

  writeAllowedText(slide.path, source);
  return slide;
}

function readSlideSpec(slideId, options: any = {}) {
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

function getSlideSpecWithPreservedPlacement(slideId, slide, slideSpec) {
  const currentSpec = readSlideSpec(slideId);
  const nextSpec = {
    ...slideSpec,
    archived: currentSpec.archived,
    index: Number.isFinite(Number(currentSpec.index)) ? currentSpec.index : slide.index,
    skipped: currentSpec.skipped
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

function writeSlideSpec(slideId, slideSpec, options: any = {}) {
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

function skipStructuredSlide(slideId, options: any = {}) {
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
  const timestamp = options.skippedAt || new Date().toISOString();
  writeSlideSpec(slideId, {
    ...slideSpec,
    skipped: true,
    skipReason: options.reason || `Scaled to ${options.targetCount} slides`,
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

function restoreSkippedSlide(slideId, options: any = {}) {
  const slide = getSlide(slideId, { includeSkipped: true });
  if (!slide.skipped) {
    return slide;
  }

  if (!slide.structured) {
    throw new Error("Slide restoration is available for structured JSON slides only.");
  }

  const slideSpec = readSlideSpec(slideId);
  const skipMeta = slideSpec.skipMeta && typeof slideSpec.skipMeta === "object" && !Array.isArray(slideSpec.skipMeta)
    ? slideSpec.skipMeta
    : {};
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

function createStructuredSlide(slideSpec) {
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

function insertStructuredSlide(slideSpec, targetIndex) {
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

function archiveStructuredSlide(slideId) {
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
