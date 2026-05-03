import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";
import {
  createContactSheet,
  ensureDir,
  listPages,
  resetDir
} from "./page-artifacts.ts";

type ImageMetadata = {
  height?: number;
  width?: number;
};

type RawImageBuffer = {
  data: Buffer;
  info: {
    height: number;
    width: number;
  };
};

async function renderPdfPages(targetDir: string, inputFile: string): Promise<string[]> {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Missing PDF input: ${inputFile}`);
  }

  resetDir(targetDir);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fs.readFileSync(inputFile));
  const document = await pdfjs.getDocument({
    data,
    disableFontFace: true
  }).promise;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 160 / 72 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
    fs.writeFileSync(
      path.join(targetDir, `page-${String(pageNumber - 1).padStart(2, "0")}.png`),
      canvas.toBuffer("image/png")
    );
    page.cleanup();
  }

  await document.cleanup();
  await document.destroy();

  const pages = listPages(targetDir);
  if (!pages.length) {
    throw new Error(`No rendered pages were created in ${targetDir}`);
  }

  return pages;
}

function createDimensionDiff(diffPath: string, leftMetadata: ImageMetadata, rightMetadata: ImageMetadata) {
  const width = Math.max(leftMetadata.width || 1, rightMetadata.width || 1);
  const height = Math.max(leftMetadata.height || 1, rightMetadata.height || 1);

  return sharp({
    create: {
      background: "#c2410c",
      channels: 4,
      height,
      width
    }
  })
    .png()
    .toFile(diffPath);
}

async function readRawRgba(fileName: string): Promise<RawImageBuffer> {
  return sharp(fileName)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function comparePageImages(baselinePage: string, currentPage: string, diffPath: string) {
  ensureDir(path.dirname(diffPath));
  const [baselineMetadata, currentMetadata] = await Promise.all([
    sharp(baselinePage).metadata(),
    sharp(currentPage).metadata()
  ]);

  if (
    baselineMetadata.width !== currentMetadata.width ||
    baselineMetadata.height !== currentMetadata.height
  ) {
    await createDimensionDiff(diffPath, baselineMetadata, currentMetadata);

    return {
      normalized: 1,
      raw: `dimension mismatch (${baselineMetadata.width}x${baselineMetadata.height} vs ${currentMetadata.width}x${currentMetadata.height})`,
      exitCode: 1
    };
  }

  const [baseline, current] = await Promise.all([
    readRawRgba(baselinePage),
    readRawRgba(currentPage)
  ]);
  const diffBuffer = Buffer.alloc(baseline.data.length);
  let sumSquared = 0;

  for (let index = 0; index < baseline.data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const offset = index + channel;
      const delta = (baseline.data[offset] ?? 0) - (current.data[offset] ?? 0);
      sumSquared += delta * delta;
      diffBuffer[offset] = Math.min(255, Math.abs(delta) * 4);
    }

    diffBuffer[index + 3] = 255;
  }

  const channelCount = (baseline.info.width || 0) * (baseline.info.height || 0) * 3;
  const rmse = Math.sqrt(sumSquared / channelCount);
  const normalized = rmse / 255;
  await sharp(diffBuffer, {
    raw: {
      channels: 4,
      height: baseline.info.height,
      width: baseline.info.width
    }
  })
    .png()
    .toFile(diffPath);

  return {
    exitCode: normalized > 0 ? 1 : 0,
    normalized,
    raw: `RMSE ${rmse.toFixed(6)} (${normalized.toFixed(6)})`
  };
}

export {
  comparePageImages,
  createContactSheet,
  ensureDir,
  listPages,
  renderPdfPages,
  resetDir
};
