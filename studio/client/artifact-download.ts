export namespace StudioClientArtifactDownload {
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
}
