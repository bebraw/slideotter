export namespace StudioClientUrlState {
  export function getSlideParam(windowRef: Window): string {
    return new URLSearchParams(windowRef.location.search).get("slide") || "";
  }

  export function setSlideParam(windowRef: Window, slideId: string | null): void {
    const url = new URL(windowRef.location.href);
    const nextSlideId = String(slideId || "");
    if (nextSlideId) {
      url.searchParams.set("slide", nextSlideId);
    } else {
      url.searchParams.delete("slide");
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${windowRef.location.pathname}${windowRef.location.search}${windowRef.location.hash}`;
    if (nextUrl !== currentUrl) {
      windowRef.history.replaceState(null, "", nextUrl);
    }
  }
}
