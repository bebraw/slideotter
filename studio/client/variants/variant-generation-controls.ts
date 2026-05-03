export namespace StudioClientVariantGenerationControls {
  export function open(documentRef: Document): void {
    const details = documentRef.querySelector(".variant-generation-details");
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
    }
  }
}
