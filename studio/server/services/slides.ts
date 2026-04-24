const fs = require("fs");
const path = require("path");
const { getActivePresentationPaths } = require("./presentations.ts");
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

function getSlidesDir() {
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

function getSlideFiles() {
  const slidesDir = getSlidesDir();
  const allFiles = fs.existsSync(slidesDir) ? fs.readdirSync(slidesDir) : [];
  const jsonFiles = allFiles.filter((fileName) => /^slide-\d+\.json$/.test(fileName)).sort(compareNames);

  if (jsonFiles.length) {
    return jsonFiles;
  }

  return allFiles
    .filter((fileName) => /^slide-\d+\.js$/.test(fileName))
    .sort(compareNames);
}

function readStructuredSlideSortInfo(fileName) {
  const slidesDir = getSlidesDir();
  const filePath = path.join(slidesDir, fileName);
  const document = readStructuredSlideDocumentFile(filePath);
  const { slideSpec } = splitStructuredSlideDocument(document);
  const numericIndex = Number(slideSpec && slideSpec.index);
  const archived = slideSpec && slideSpec.archived === true;

  return {
    archived,
    fileName,
    filePath,
    sortIndex: Number.isFinite(numericIndex) ? numericIndex : Number.MAX_SAFE_INTEGER,
    title: slideSpec && slideSpec.title ? slideSpec.title : ""
  };
}

function getSlides(options: any = {}) {
  const includeArchived = options.includeArchived === true;
  const slideFiles = getSlideFiles();
  const orderedFiles = slideFiles.length && slideFiles[0].endsWith(".json")
    ? slideFiles
      .map((fileName) => readStructuredSlideSortInfo(fileName))
      .filter((entry) => includeArchived || !entry.archived)
      .sort((left, right) => {
        if (left.sortIndex !== right.sortIndex) {
          return left.sortIndex - right.sortIndex;
        }

        return compareNames(left.fileName, right.fileName);
      })
      .map((entry) => entry.fileName)
    : slideFiles;

  return orderedFiles.map((fileName, index) => {
    const slidesDir = getSlidesDir();
    const filePath = path.join(slidesDir, fileName);
    const slideId = path.basename(fileName, path.extname(fileName));
    const structured = fileName.endsWith(".json");
    const archived = structured
      ? readStructuredSlideSortInfo(fileName).archived
      : false;

    return {
      archived,
      fileName,
      id: slideId,
      index: index + 1,
      path: filePath,
      sourcePath: structured ? null : filePath,
      structured,
      title: extractTitle(filePath, fileName) || `Slide ${index + 1}`
    };
  });
}

function getSlide(slideId, options: any = {}) {
  const slide = getSlides({ includeArchived: options.includeArchived === true }).find((entry) => entry.id === slideId);
  if (!slide) {
    throw new Error(`Unknown slide: ${slideId}`);
  }
  return slide;
}

function readSlideSource(slideId) {
  const slide = getSlide(slideId, { includeArchived: true });
  return fs.readFileSync(slide.path, "utf8");
}

function writeSlideSource(slideId, source) {
  const slide = getSlide(slideId, { includeArchived: true });
  if (slide.structured) {
    throw new Error("Raw source writes are disabled for structured JSON slides.");
  }

  writeAllowedText(slide.path, source);
  return slide;
}

function readSlideSpec(slideId) {
  const slide = getSlide(slideId, { includeArchived: true });

  if (slide.structured) {
    const { slideSpec } = splitStructuredSlideDocument(readStructuredSlideDocumentFile(slide.path));
    return validateSlideSpec(slideSpec);
  }

  return extractSlideSpec(readSlideSource(slideId));
}

function writeSlideSpec(slideId, slideSpec) {
  const slide = getSlide(slideId, { includeArchived: true });
  const validated = validateSlideSpec(slideSpec);

  if (slide.structured) {
    writeJson(slide.path, buildStructuredSlideDocument(validated));
    return slide;
  }

  const currentSource = readSlideSource(slideId);
  writeSlideSource(slideId, materializeSlideSpec(currentSource, validated));
  return slide;
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
  getSlide,
  getSlides,
  createStructuredSlide,
  insertStructuredSlide,
  peekNextStructuredSlideFileName,
  readSlideSpec,
  readSlideSource,
  writeSlideSpec,
  writeSlideSource
};
