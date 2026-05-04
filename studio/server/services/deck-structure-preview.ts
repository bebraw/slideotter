import * as fs from "fs";
import * as path from "path";

import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray
} from "../../shared/json-utils.ts";
import { buildAndRenderDeck } from "./build.ts";
import { getOutputConfig } from "./output-config.ts";
import { outputDir } from "./paths.ts";
import { createContactSheet, listPages } from "./page-artifacts.ts";
import { applyDeckStructurePlan, getDeckContext, saveDeckContext } from "./state.ts";
import { getSlides, readSlideSpec, writeSlideSpec } from "./slides.ts";
import {
  copyAllowedFile,
  ensureAllowedDir,
  removeAllowedPath
} from "./write-boundary.ts";
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
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
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
    const currentCopiedPages = currentRenderedPages.map((pageFile: string, index: number) => {
      const targetPath = path.join(candidateDir, `before-page-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);
      return targetPath;
    });
    const currentStripPath = path.join(candidateDir, "current-strip.png");
    if (currentCopiedPages.length) {
      await createContactSheet(currentCopiedPages, currentStripPath);
    }

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
    const copiedPages = renderedPages.map((pageFile: string, index: number) => {
      const targetPath = path.join(candidateDir, `page-${String(index + 1).padStart(2, "0")}.png`);
      copyAllowedFile(pageFile, targetPath);
      return targetPath;
    });
    const stripPath = path.join(candidateDir, "strip.png");
    await createContactSheet(copiedPages, stripPath);

    const preview = candidate.preview || {};
    const previewHints = asJsonObjectArray(preview.previewHints);
    const renderedHints = previewHints.map((hint: JsonObject, index: number) => {
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

    candidate.preview = {
      ...preview,
      currentStrip: fs.existsSync(currentStripPath)
        ? {
          fileName: path.basename(currentStripPath),
          pageCount: currentCopiedPages.length,
          url: asAssetUrl(currentStripPath)
        }
        : null,
      previewHints: renderedHints,
      strip: {
        fileName: path.basename(stripPath),
        pageCount: copiedPages.length,
        url: asAssetUrl(stripPath)
      }
    };
  } finally {
    restoreDeckStructurePreviewState(originalSpecs);
    saveDeckContext(originalContext);
    await buildAndRenderDeck();
  }
}
