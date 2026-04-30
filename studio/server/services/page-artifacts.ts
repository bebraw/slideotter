const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

type PageImage = {
  fileName: string;
  height: number;
  width: number;
};

type ContactSheetComposite = {
  input: string;
  left: number;
  top: number;
};

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(dir: string): void {
  fs.rmSync(dir, { force: true, recursive: true });
  ensureDir(dir);
}

function listPages(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((name: string) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name: string) => path.join(dir, name));
}

async function createContactSheet(pageFiles: string[], targetPath: string): Promise<void> {
  if (!pageFiles.length) {
    throw new Error("Cannot create a contact sheet without page images.");
  }

  ensureDir(path.dirname(targetPath));

  const images: PageImage[] = await Promise.all(pageFiles.map(async (fileName: string) => {
    const metadata = await sharp(fileName).metadata();
    return {
      fileName,
      height: metadata.height || 0,
      width: metadata.width || 0
    };
  }));
  const rows: PageImage[][] = [];

  for (let index = 0; index < images.length; index += 2) {
    rows.push(images.slice(index, index + 2));
  }

  const rowHeights = rows.map((row) => Math.max(...row.map((image) => image.height)));
  const width = Math.max(...rows.map((row) => row.reduce((sum, image) => sum + image.width, 0)));
  const height = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);
  const composites: ContactSheetComposite[] = [];
  let top = 0;

  rows.forEach((row, rowIndex) => {
    let left = 0;

    row.forEach((image) => {
      composites.push({
        input: image.fileName,
        left,
        top
      });
      left += image.width;
    });

    top += rowHeights[rowIndex] ?? 0;
  });

  await sharp({
    create: {
      background: "#ffffff",
      channels: 4,
      height,
      width
    }
  })
    .composite(composites)
    .png()
    .toFile(targetPath);
}

module.exports = {
  createContactSheet,
  ensureDir,
  listPages,
  resetDir
};
