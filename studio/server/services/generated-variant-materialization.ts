import * as path from "path";

import {
  asRecord as asJsonObject,
  asRecordArray as asJsonObjectArray
} from "../../shared/json-utils.ts";
import { createStandaloneSlideHtml, withBrowser } from "./dom-export.ts";
import { getDomPreviewState } from "./dom-preview.ts";
import { getOutputConfig } from "./output-config.ts";
import { outputDir } from "./paths.ts";
import { getSlide } from "./slides.ts";
import { ensureAllowedDir } from "./write-boundary.ts";
import {
  applyCandidateSlideDefaults,
  serializeSlideSpec
} from "./generated-variant-safety.ts";

type JsonObject = Record<string, unknown>;
type SlideSpec = JsonObject;

type OperationOptions = JsonObject & {
  baseSlideSpec?: unknown;
  labelFormatter?: (label: string) => string;
  operation?: string;
};

function asAssetUrl(fileName: string): string {
  const relativePath = path.relative(outputDir, fileName).split(path.sep).join("/");
  return `/studio-output/${relativePath}`;
}

function createTransientVariant(options: JsonObject): JsonObject {
  const timestamp = new Date().toISOString();
  return {
    changeSummary: Array.isArray(options.changeSummary) ? options.changeSummary : [],
    changeScope: typeof options.changeScope === "string" ? options.changeScope : null,
    createdAt: timestamp,
    id: `candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: options.kind || "generated",
    label: options.label,
    layoutDefinition: options.layoutDefinition && typeof options.layoutDefinition === "object" && !Array.isArray(options.layoutDefinition)
      ? options.layoutDefinition
      : null,
    layoutPreview: options.layoutPreview && typeof options.layoutPreview === "object" && !Array.isArray(options.layoutPreview)
      ? options.layoutPreview
      : null,
    notes: options.notes || "",
    operation: options.operation || null,
    operationScope: options.operationScope && typeof options.operationScope === "object" && !Array.isArray(options.operationScope)
      ? options.operationScope
      : null,
    generator: options.generator || null,
    model: options.model || null,
    persisted: false,
    previewImage: options.previewImage || null,
    promptSummary: options.promptSummary || "",
    provider: options.provider || null,
    remediationStrategy: typeof options.remediationStrategy === "string" ? options.remediationStrategy : null,
    slideId: options.slideId,
    slideSpec: options.slideSpec || null,
    source: options.source,
    sourceIssues: Array.isArray(options.sourceIssues) ? options.sourceIssues.filter((issue: unknown) => asJsonObject(issue) === issue) : [],
    updatedAt: timestamp,
    visualTheme: options.visualTheme && typeof options.visualTheme === "object" && !Array.isArray(options.visualTheme)
      ? options.visualTheme
      : null
  };
}

async function renderVariantPreview(slideId: string, slideSpec: SlideSpec, variantId: string, visualTheme: unknown = null): Promise<JsonObject> {
  const slide = getSlide(slideId);
  const { variantPreviewDir } = getOutputConfig();
  ensureAllowedDir(variantPreviewDir);
  const previewState = getDomPreviewState();
  const theme = visualTheme && typeof visualTheme === "object" && !Array.isArray(visualTheme)
    ? { ...previewState.theme, ...visualTheme }
    : previewState.theme;
  const targetFile = path.join(variantPreviewDir, `${variantId}.png`);
  const html = createStandaloneSlideHtml(
    { ...previewState, theme },
    {
      id: slide.id,
      index: slide.index,
      slideSpec,
      title: slide.title
    }
  );

  await withBrowser(async (browser: { newPage: (options: JsonObject) => Promise<{ close: () => Promise<void>; screenshot: (options: JsonObject) => Promise<unknown>; setContent: (html: string, options: JsonObject) => Promise<unknown> }> }) => {
    const page = await browser.newPage({
      viewport: {
        height: 540,
        width: 960
      }
    });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({
      omitBackground: false,
      path: targetFile,
      type: "png"
    });
    await page.close();
  });

  return {
    fileName: path.basename(targetFile),
    url: asAssetUrl(targetFile)
  };
}

export async function materializeCandidatesToVariants(slideId: string, candidates: unknown, options: OperationOptions = {}): Promise<JsonObject[]> {
  const createdVariants: JsonObject[] = [];

  for (const candidate of asJsonObjectArray(candidates)) {
    const slideSpec = applyCandidateSlideDefaults(candidate.slideSpec, options.baseSlideSpec);
    const source = serializeSlideSpec(slideSpec);
    const variant = createTransientVariant({
      changeSummary: candidate.changeSummary,
      generator: candidate.generator,
      kind: "generated",
      label: options.labelFormatter ? options.labelFormatter(String(candidate.label || "")) : candidate.label,
      layoutDefinition: candidate.layoutDefinition || null,
      layoutPreview: candidate.layoutPreview || null,
      model: candidate.model,
      notes: candidate.notes,
      operation: options.operation,
      operationScope: candidate.operationScope || null,
      promptSummary: candidate.promptSummary,
      provider: candidate.provider,
      remediationStrategy: candidate.remediationStrategy,
      sourceIssues: candidate.sourceIssues,
      changeScope: candidate.changeScope,
      slideId,
      slideSpec,
      source,
      visualTheme: candidate.visualTheme || null
    });
    const previewImage = await renderVariantPreview(slideId, slideSpec, String(variant.id || ""), candidate.visualTheme);
    createdVariants.push({
      ...variant,
      previewImage
    });
  }

  return createdVariants;
}

export const _test = {
  createTransientVariant,
  renderVariantPreview
};
