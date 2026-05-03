import * as fs from "fs";
import * as path from "path";
import pptxModule from "pptxgenjs";
import { renderDeckImagesFromDom } from "./dom-export.ts";
import { getDomPreviewState } from "./dom-preview.ts";
import { getOutputConfig } from "./output-config.ts";
import { getActivePresentationId } from "./presentations.ts";
import { ensureAllowedDir, assertAllowedWriteTarget } from "./write-boundary.ts";

type SlideEntry = {
  id?: string;
  index: number | string;
  title?: string;
};

type PreviewState = {
  generatedAt?: string;
  metadata?: unknown;
  slides: SlideEntry[];
  title?: string;
};

type PptxExportOptions = {
  imageScale?: number;
  previewState?: PreviewState;
};

type PptxExportResult = {
  diagnostics: {
    imageResolution: string;
    imageScale: number;
    slideCount: number;
    warnings: string[];
  };
  imageFiles: string[];
  pptxFile: string;
};

type ExportMetadata = {
  author: string;
  company: string;
  subject: string;
};

const slideWidthInches = 10;
const slideHeightInches = 5.625;

function getPptxConstructor(moduleValue: unknown): typeof import("pptxgenjs").default {
  if (typeof moduleValue === "function") {
    return moduleValue as typeof import("pptxgenjs").default;
  }

  if (moduleValue && typeof moduleValue === "object" && "default" in moduleValue) {
    const defaultExport = moduleValue.default;
    if (typeof defaultExport === "function") {
      return defaultExport as typeof import("pptxgenjs").default;
    }
  }

  throw new Error("pptxgenjs did not expose a constructable export.");
}

const PptxGenJS = getPptxConstructor(pptxModule);
const baseSlideWidthPixels = 960;
const baseSlideHeightPixels = 540;
const defaultImageScale = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getExportMetadata(metadata: unknown): ExportMetadata {
  const source = isRecord(metadata) ? metadata : {};

  return {
    author: asString(source.author),
    company: asString(source.company),
    subject: asString(source.subject)
  };
}

function normalizeImageScale(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : defaultImageScale;
}

function buildSlideNotes(options: {
  exportedAt: string;
  presentationId: string;
  slide: SlideEntry;
}): string {
  const index = String(options.slide.index);
  const slideId = options.slide.id || `slide-${index}`;
  const title = options.slide.title || "";

  return [
    "slideotter export metadata",
    `Presentation: ${options.presentationId}`,
    `Slide: ${slideId}`,
    `Source: ${slideId}`,
    `Index: ${index}`,
    title ? `Title: ${title}` : "",
    `Exported: ${options.exportedAt}`
  ].filter(Boolean).join("\n");
}

function assertRenderedImageFiles(imageFiles: string[], slideCount: number): void {
  if (imageFiles.length !== slideCount) {
    throw new Error(`Expected ${slideCount} rendered slide image${slideCount === 1 ? "" : "s"}, got ${imageFiles.length}.`);
  }

  imageFiles.forEach((fileName) => {
    if (!fs.existsSync(fileName) || fs.statSync(fileName).size === 0) {
      throw new Error(`Rendered slide image is missing or empty: ${fileName}`);
    }
  });
}

async function writePptxFromRenderedSlides(options: {
  imageFiles: string[];
  imageScale: number;
  pptxFile: string;
  presentationId: string;
  previewState: PreviewState;
}): Promise<PptxExportResult> {
  const pptx = new PptxGenJS();
  const exportedAt = options.previewState.generatedAt || new Date().toISOString();
  const metadata = getExportMetadata(options.previewState.metadata);
  const resolvedPptxFile = assertAllowedWriteTarget(options.pptxFile, "write PPTX export");

  assertRenderedImageFiles(options.imageFiles, options.previewState.slides.length);
  ensureAllowedDir(path.dirname(resolvedPptxFile));

  pptx.defineLayout({
    height: slideHeightInches,
    name: "SLIDEOTTER_WIDE",
    width: slideWidthInches
  });
  pptx.layout = "SLIDEOTTER_WIDE";
  pptx.author = metadata.author || "slideotter";
  pptx.company = metadata.company;
  pptx.subject = metadata.subject || "slideotter PPTX export";
  pptx.title = options.previewState.title || options.presentationId;

  options.imageFiles.forEach((imageFile, index) => {
    const slide = pptx.addSlide();
    const slideEntry = options.previewState.slides[index];
    slide.background = { color: "FFFFFF" };
    slide.addImage({
      altText: slideEntry?.title || `Slide ${index + 1}`,
      h: slideHeightInches,
      path: imageFile,
      w: slideWidthInches,
      x: 0,
      y: 0
    });
    slide.addNotes(buildSlideNotes({
      exportedAt,
      presentationId: options.presentationId,
      slide: slideEntry || { index: index + 1 }
    }));
  });

  await pptx.writeFile({
    compression: true,
    fileName: resolvedPptxFile
  });

  return {
    diagnostics: {
      imageResolution: `${Math.round(baseSlideWidthPixels * options.imageScale)}x${Math.round(baseSlideHeightPixels * options.imageScale)}`,
      imageScale: options.imageScale,
      slideCount: options.previewState.slides.length,
      warnings: [
        "Slides are exported as full-slide images for visual fidelity; text and shapes are not editable in PowerPoint."
      ]
    },
    imageFiles: options.imageFiles,
    pptxFile: resolvedPptxFile
  };
}

async function exportDeckPptxFromDom(options: PptxExportOptions = {}): Promise<PptxExportResult> {
  const previewState = options.previewState || getDomPreviewState();
  const imageScale = normalizeImageScale(options.imageScale);
  const { pptxFile, pptxPreviewDir } = getOutputConfig();
  const imageFiles = await renderDeckImagesFromDom(previewState, {
    imageScale,
    targetDir: pptxPreviewDir
  });

  return writePptxFromRenderedSlides({
    imageFiles,
    imageScale,
    pptxFile,
    presentationId: getActivePresentationId(),
    previewState
  });
}

const _test = {
  buildSlideNotes,
  writePptxFromRenderedSlides
};

export {
  _test,
  exportDeckPptxFromDom
};
