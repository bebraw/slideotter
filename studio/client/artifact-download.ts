export namespace StudioClientArtifactDownload {
  export type PptxExportStatusOptions = {
    path?: string | undefined;
    resolution?: string | undefined;
    slideCount?: number | undefined;
  };

  export function getFileName(artifactPath: string | undefined, fallback: string): string {
    if (!artifactPath) {
      return fallback;
    }

    const fileName = artifactPath.split(/[\\/]/u).pop();
    return fileName && fileName.trim() ? fileName : fallback;
  }

  export function download(windowRef: Window, url: string | undefined, fileName: string): void {
    if (!url) {
      return;
    }

    const link = windowRef.document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.hidden = true;
    windowRef.document.body.append(link);
    link.click();
    link.remove();
  }

  export function getPdfExportStatus(path: string | undefined): string {
    return path ? `Exported PDF to ${path}.` : "Exported PDF.";
  }

  export function getPptxExportStatus({
    path,
    resolution = "2x",
    slideCount = 0
  }: PptxExportStatusOptions): string {
    if (!path) {
      return "Exported PPTX.";
    }

    return `Exported PPTX (${slideCount} slide${slideCount === 1 ? "" : "s"}, ${resolution}) to ${path}.`;
  }
}
