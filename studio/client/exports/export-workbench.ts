import type { StudioClientElements } from "../core/elements.ts";
import type { StudioClientState } from "../core/state.ts";
import { StudioClientRuntimePayloadState } from "../runtime/runtime-payload-state.ts";
import { StudioClientArtifactDownload } from "./artifact-download.ts";

export namespace StudioClientExportWorkbench {
  type PdfExportPayload = {
    pdf?: {
      path?: string;
      url?: string;
    };
  };

  type PptxExportPayload = StudioClientState.JsonRecord & {
    diagnostics?: {
      imageResolution?: string;
      imageScale?: number;
      slideCount?: number;
      warnings?: string[];
    };
    pptx?: {
      path?: string;
      url?: string;
    };
    runtime?: StudioClientState.State["runtime"];
  };

  type Dependencies = {
    buildDeck: () => Promise<PdfExportPayload>;
    elements: StudioClientElements.Elements;
    renderStatus: () => void;
    request: <TResponse = unknown>(url: string, options?: RequestInit) => Promise<TResponse>;
    setBusy: (button: StudioClientElements.StudioElement, label: string) => () => void;
    state: StudioClientState.State;
    window: Window;
  };

  export type Workbench = {
    exportPdf: () => Promise<void>;
    exportPptx: () => Promise<void>;
  };

  export function createExportWorkbench({
    buildDeck,
    elements,
    renderStatus,
    request,
    setBusy,
    state,
    window
  }: Dependencies): Workbench {
    async function exportPdf(): Promise<void> {
      const done = setBusy(elements.exportMenuButton, "Exporting...");
      try {
        const payload = await buildDeck();
        StudioClientArtifactDownload.download(
          window,
          payload.pdf?.url,
          StudioClientArtifactDownload.getFileName(payload.pdf?.path, "deck.pdf")
        );
        elements.operationStatus.textContent = StudioClientArtifactDownload.getPdfExportStatus(payload.pdf?.path);
      } finally {
        done();
      }
    }

    async function exportPptx(): Promise<void> {
      const done = setBusy(elements.exportMenuButton, "Exporting...");
      try {
        const payload = await request<PptxExportPayload>("/api/v1/exports/pptx", {
          body: JSON.stringify({}),
          method: "POST"
        });
        StudioClientRuntimePayloadState.applyRuntimePayload(state, payload);
        renderStatus();
        const slideCount = payload.diagnostics?.slideCount || 0;
        const resolution = payload.diagnostics?.imageResolution || "2x";
        StudioClientArtifactDownload.download(
          window,
          payload.pptx?.url,
          StudioClientArtifactDownload.getFileName(payload.pptx?.path, "deck.pptx")
        );
        elements.operationStatus.textContent = StudioClientArtifactDownload.getPptxExportStatus({
          path: payload.pptx?.path,
          resolution,
          slideCount
        });
      } finally {
        done();
      }
    }

    return {
      exportPdf,
      exportPptx
    };
  }
}
