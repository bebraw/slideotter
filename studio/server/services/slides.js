const fs = require("fs");
const path = require("path");
const { slidesDir } = require("./paths");
const { extractSlideSpec, materializeSlideSpec, validateSlideSpec } = require("./slide-specs");

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
  fs.writeFileSync(fileName, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
  const allFiles = fs.readdirSync(slidesDir);
  const jsonFiles = allFiles.filter((fileName) => /^slide-\d+\.json$/.test(fileName)).sort(compareNames);

  if (jsonFiles.length) {
    return jsonFiles;
  }

  return allFiles
    .filter((fileName) => /^slide-\d+\.js$/.test(fileName))
    .sort(compareNames);
}

function getSlides() {
  return getSlideFiles().map((fileName, index) => {
    const filePath = path.join(slidesDir, fileName);
    const slideId = path.basename(fileName, path.extname(fileName));

    return {
      fileName,
      id: slideId,
      index: index + 1,
      path: filePath,
      sourcePath: fileName.endsWith(".json") ? path.join(slidesDir, `${slideId}.js`) : filePath,
      structured: fileName.endsWith(".json"),
      title: extractTitle(filePath, fileName) || `Slide ${index + 1}`
    };
  });
}

function getSlide(slideId) {
  const slide = getSlides().find((entry) => entry.id === slideId);
  if (!slide) {
    throw new Error(`Unknown slide: ${slideId}`);
  }
  return slide;
}

function readSlideSource(slideId) {
  const slide = getSlide(slideId);
  return fs.readFileSync(slide.sourcePath || slide.path, "utf8");
}

function writeSlideSource(slideId, source) {
  const slide = getSlide(slideId);
  fs.writeFileSync(slide.sourcePath || slide.path, source, "utf8");
  return slide;
}

function readSlideSpec(slideId) {
  const slide = getSlide(slideId);

  if (slide.structured) {
    return validateSlideSpec(readJson(slide.path, {}));
  }

  return extractSlideSpec(readSlideSource(slideId));
}

function writeSlideSpec(slideId, slideSpec) {
  const slide = getSlide(slideId);
  const validated = validateSlideSpec(slideSpec);

  if (slide.structured) {
    writeJson(slide.path, validated);
    return slide;
  }

  const currentSource = readSlideSource(slideId);
  writeSlideSource(slideId, materializeSlideSpec(currentSource, validated));
  return slide;
}

module.exports = {
  getSlide,
  getSlides,
  readSlideSpec,
  readSlideSource,
  writeSlideSpec,
  writeSlideSource
};
