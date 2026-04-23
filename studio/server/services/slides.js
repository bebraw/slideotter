const fs = require("fs");
const path = require("path");
const { slidesDir } = require("./paths");

function compareNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true });
}

function extractTitle(source) {
  const match = source.match(/title:\s*"([^"]+)"/);
  return match ? match[1] : "";
}

function getSlideFiles() {
  return fs.readdirSync(slidesDir)
    .filter((fileName) => /^slide-\d+\.js$/.test(fileName))
    .sort(compareNames);
}

function getSlides() {
  return getSlideFiles().map((fileName, index) => {
    const filePath = path.join(slidesDir, fileName);
    const source = fs.readFileSync(filePath, "utf8");

    return {
      fileName,
      id: path.basename(fileName, ".js"),
      index: index + 1,
      path: filePath,
      title: extractTitle(source) || `Slide ${index + 1}`
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
  return fs.readFileSync(slide.path, "utf8");
}

function writeSlideSource(slideId, source) {
  const slide = getSlide(slideId);
  fs.writeFileSync(slide.path, source, "utf8");
  return slide;
}

module.exports = {
  getSlide,
  getSlides,
  readSlideSource,
  writeSlideSource
};
