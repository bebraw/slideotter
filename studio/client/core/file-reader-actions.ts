export namespace StudioClientFileReaderActions {
  type FileReaderHost = Window & {
    FileReader: typeof FileReader;
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
        const { StudioClientFileReader } = await import("./file-reader.ts");
        return StudioClientFileReader.readAsDataUrl(windowRef, file);
      }
    };
  }
}
