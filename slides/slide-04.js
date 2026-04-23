const slideSpec = require("./slide-04.json");
const { createSlideFromSpec } = require("./render-slide-spec");

function createSlide(pres, theme, options = {}) {
  return createSlideFromSpec(pres, theme, slideSpec, options);
}

module.exports = {
  createSlide,
  slideConfig: {
    index: slideSpec.index,
    title: slideSpec.title,
    type: slideSpec.type
  }
};
