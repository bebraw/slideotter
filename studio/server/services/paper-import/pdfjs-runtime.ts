import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextRuntime } from "@kirjolab/paper-import";

const pdfJsEntry = import.meta.resolve("pdfjs-dist/legacy/build/pdf.mjs");
const standardFontDataUrl = fileURLToPath(new URL("../../standard_fonts/", pdfJsEntry));

const pdfJsTextRuntime: PdfTextRuntime = {
  getDocument({ data }) {
    const task = getDocument({
      data,
      disableFontFace: true,
      standardFontDataUrl,
      stopAtErrors: true,
      useSystemFonts: false
    });

    return {
      destroy: async () => {
        await task.destroy();
      },
      promise: task.promise.then((documentModel) => ({
        getPage: async (pageNumber) => {
          const page = await documentModel.getPage(pageNumber);
          return {
            cleanup: () => {
              page.cleanup();
            },
            streamTextContent: () => page.streamTextContent()
          };
        },
        numPages: documentModel.numPages
      }))
    };
  }
};

export { pdfJsTextRuntime };
