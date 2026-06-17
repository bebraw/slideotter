import { renderDeckDocument, renderPresentationDocument } from "../../rendering/documents.ts";
import { getDomPreviewState, type DomPreviewOptions } from "./dom-preview-state.ts";

function renderDomPreviewDocument() {
  const previewState = getDomPreviewState();
  return renderDeckDocument(previewState);
}

function renderPresentationPreviewDocument(options: DomPreviewOptions = {}) {
  const previewState = getDomPreviewState({
    ...options,
    includeDetours: true
  });
  return renderPresentationDocument(previewState);
}

export {
  renderDomPreviewDocument,
  renderPresentationPreviewDocument
};
