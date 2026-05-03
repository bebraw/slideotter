export namespace StudioClientFileReader {
  type FileReaderHost = {
    FileReader: typeof FileReader;
  };

  export function readAsDataUrl(windowRef: FileReaderHost, file: Blob): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const reader = new windowRef.FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(reader.error || new Error("Could not read material file")));
      reader.readAsDataURL(file);
    });
  }
}
