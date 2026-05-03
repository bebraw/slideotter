export namespace StudioClientPresentationModeControl {
  export type OpenPresentationModeOptions = {
    missingPresentationMessage: string;
    presentationId: string | null | undefined;
    urlForPresentation: (presentationId: string) => string;
    windowRef: Window;
  };

  export function openPresentationMode({
    missingPresentationMessage,
    presentationId,
    urlForPresentation,
    windowRef
  }: OpenPresentationModeOptions): void {
    if (!presentationId) {
      windowRef.alert(missingPresentationMessage);
      return;
    }

    const url = urlForPresentation(presentationId);
    const popup = windowRef.open(url, "_blank");
    if (!popup) {
      windowRef.location.href = url;
    }
  }
}
