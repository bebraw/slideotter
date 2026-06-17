import * as fs from "fs";
import * as path from "path";
import { getOutputConfig } from "./output-config.ts";
import { listPages } from "./page-artifacts.ts";
import { asStudioOutputAssetUrl } from "./studio-output-asset-url.ts";

function asAssetUrl(fileName: string) {
  return asStudioOutputAssetUrl(fileName);
}

function getPreviewManifest() {
  const { contactSheetFile, previewDir } = getOutputConfig();
  const pages = listPages(previewDir);

  return {
    contactSheetUrl: fs.existsSync(contactSheetFile) ? asAssetUrl(contactSheetFile) : null,
    generatedAt: pages[0] ? fs.statSync(pages[0]).mtime.toISOString() : null,
    pages: pages.map((fileName: string, index: number) => ({
      index: index + 1,
      name: path.basename(fileName),
      url: asAssetUrl(fileName)
    }))
  };
}

export {
  getPreviewManifest
};
