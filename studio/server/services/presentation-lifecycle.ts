import * as presentations from "./presentations.ts";

const createPresentation = presentations.createPresentation;
const deletePresentation = presentations.deletePresentation;
const duplicatePresentation = presentations.duplicatePresentation;
const listPresentations = presentations.listPresentations;
const readPresentationSummary = presentations.readPresentationSummary;
const regeneratePresentationSlides = presentations.regeneratePresentationSlides;
const setActivePresentation = presentations.setActivePresentation;

export {
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  listPresentations,
  readPresentationSummary,
  regeneratePresentationSlides,
  setActivePresentation
};
