export namespace StudioClientFileReaderActions {
  type FileReaderHost = Window & {
    FileReader?: typeof FileReader;
  };

  export type FileReaderActionsOptions = {
    windowRef: FileReaderHost;
  };

  export type FileReaderActions = {
    readFileAsDataUrl: (file: Blob) => Promise<string | ArrayBuffer | null>;
  };

  export function createFileReaderActions({ windowRef }: FileReaderActionsOptions): FileReaderActions {
    return {
      readFileAsDataUrl: async (file: Blob) => {
        if (!windowRef.FileReader) {
          throw new Error("FileReader is not available in this browser");
        }
        const { StudioClientFileReader } = await import("./file-reader.ts");
        return StudioClientFileReader.readAsDataUrl({ FileReader: windowRef.FileReader }, file);
      }
    };
  }
}
