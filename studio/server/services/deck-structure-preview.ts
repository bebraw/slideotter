import * as fs from "fs";
import * as path from "path";

import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray
} from "../../shared/json-record-utils.ts";
import { buildAndRenderDeck } from "./build.ts";
import { getOutputConfig } from "./output-config.ts";
import { createContactSheet, listPages } from "./page-artifacts.ts";
import { asStudioOutputAssetUrl } from "./studio-output-asset-url.ts";
import { applyDeckStructurePlan, getDeckContext, saveDeckContext } from "./state.ts";
import { getSlides } from "./slide-queries.ts";
import { readSlideSpec } from "./slide-spec-store.ts";
import { writeSlideSpec } from "./slide-writes.ts";
import {
  copyAllowedFile,
  removeAllowedPath
} from "./write-boundary.ts";
import { ensureAllowedDir } from "./ensure-allowed-dir.ts";
import type { DeckPlanEntry } from "./deck-structure-plan-construction.ts";

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

type SlideRecord = JsonObject & {
  id: string;
  path?: string;
};

type DeckStructureCandidate = JsonObject & {
  deckPatch?: unknown;
  id: string;
  label: string;
  outline?: unknown;
  preview?: JsonObject;
  slides: DeckPlanEntry[];
  summary?: unknown;
};

type DeckStructurePreviewDependencies = {
  applyDeckStructureCandidate: (candidate: unknown, options?: JsonObject) => Promise<JsonObject>;
};

function asAssetUrl(fileName: string): string {
  return asStudioOutputAssetUrl(fileName);
}

function restoreDeckStructurePreviewState(originalSpecs: Map<string, SlideSpec>): void {
  originalSpecs.forEach((slideSpec: SlideSpec, slideId: string) => {
    writeSlideSpec(slideId, slideSpec);
  });

  const currentSlides = getSlides({ includeArchived: true });
  currentSlides.forEach((slide: SlideRecord) => {
    if (!originalSpecs.has(slide.id)) {
      if (typeof slide.path === "string") {
        removeAllowedPath(slide.path, { force: true });
      }
    }
  });
}

function copyPreviewPages(pageFiles: string[], candidateDir: string, prefix: string): string[] {
  return pageFiles.map((pageFile: string, index: number) => {
    const targetPath = path.join(candidateDir, `${prefix}${String(index + 1).padStart(2, "0")}.png`);
    copyAllowedFile(pageFile, targetPath);
    return targetPath;
  });
}

async function createOptionalContactSheet(pageFiles: string[], targetPath: string): Promise<void> {
  if (pageFiles.length) {
    await createContactSheet(pageFiles, targetPath);
  }
}

function renderDeckPreviewHints(preview: JsonObject, copiedPages: string[], candidateDir: string): JsonObject[] {
  const previewHints = asJsonObjectArray(preview.previewHints);
  return previewHints.map((hint: JsonObject, index: number) => {
    const proposedIndex = Number(hint.proposedIndex);
    const pageFile = Number.isFinite(proposedIndex) ? copiedPages[proposedIndex - 1] : null;

    if (!pageFile || !fs.existsSync(pageFile)) {
      return {
        ...hint,
        proposedPreview: null
      };
    }

    const targetPath = path.join(candidateDir, `hint-${String(index + 1).padStart(2, "0")}.png`);
    copyAllowedFile(pageFile, targetPath);

    return {
      ...hint,
      proposedPreview: {
        fileName: path.basename(targetPath),
        url: asAssetUrl(targetPath)
      }
    };
  });
}

function updateCandidatePreview(params: {
  candidate: DeckStructureCandidate;
  copiedPages: string[];
  currentCopiedPages: string[];
  currentStripPath: string;
  renderedHints: JsonObject[];
  stripPath: string;
}): void {
  const preview = params.candidate.preview || {};
  params.candidate.preview = {
    ...preview,
    currentStrip: fs.existsSync(params.currentStripPath)
      ? {
        fileName: path.basename(params.currentStripPath),
        pageCount: params.currentCopiedPages.length,
        url: asAssetUrl(params.currentStripPath)
      }
      : null,
    previewHints: params.renderedHints,
    strip: {
      fileName: path.basename(params.stripPath),
      pageCount: params.copiedPages.length,
      url: asAssetUrl(params.stripPath)
    }
  };
}

export async function renderDeckStructureCandidatePreview(
  candidate: DeckStructureCandidate,
  deps: DeckStructurePreviewDependencies
): Promise<void> {
  const originalSlides = getSlides({ includeArchived: true });
  const originalSpecs = new Map<string, SlideSpec>(originalSlides.map((slide: SlideRecord) => [slide.id, asJsonObject(readSlideSpec(slide.id))]));
  const originalContext = getDeckContext();
  const { deckStructurePreviewDir, previewDir } = getOutputConfig();
  const candidateDir = path.join(deckStructurePreviewDir, candidate.id);
  const currentRenderedPages = listPages(previewDir);

  ensureAllowedDir(deckStructurePreviewDir);
  removeAllowedPath(candidateDir, { force: true, recursive: true });
  ensureAllowedDir(candidateDir);

  try {
    const currentCopiedPages = copyPreviewPages(currentRenderedPages, candidateDir, "before-page-");
    const currentStripPath = path.join(candidateDir, "current-strip.png");
    await createOptionalContactSheet(currentCopiedPages, currentStripPath);

    applyDeckStructurePlan({
      deckPatch: candidate.deckPatch,
      label: candidate.label,
      outline: candidate.outline,
      slides: candidate.slides,
      summary: candidate.summary
    });

    await deps.applyDeckStructureCandidate(candidate, {
      promoteIndices: true,
      promoteInsertions: true,
      promoteRemovals: true,
      promoteReplacements: true,
      promoteTitles: true
    });

    const renderedPages = listPages(previewDir);
    const copiedPages = copyPreviewPages(renderedPages, candidateDir, "page-");
    const stripPath = path.join(candidateDir, "strip.png");
    await createContactSheet(copiedPages, stripPath);
    const preview = candidate.preview || {};
    const renderedHints = renderDeckPreviewHints(preview, copiedPages, candidateDir);
    updateCandidatePreview({ candidate, copiedPages, currentCopiedPages, currentStripPath, renderedHints, stripPath });
  } finally {
    restoreDeckStructurePreviewState(originalSpecs);
    saveDeckContext(originalContext);
    await buildAndRenderDeck();
  }
}
