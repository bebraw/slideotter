export type MediaFit = "contain" | "cover";
export type MediaFocalPoint = "bottom" | "bottom-left" | "bottom-right" | "center" | "left" | "right" | "top" | "top-left" | "top-right";

export type SelectedMedia = {
  fit?: unknown;
  focalPoint?: unknown;
};

export type MediaControlInput = {
  selectedMaterialId: string;
  selectedMedia: SelectedMedia | null;
  selectedSlideId: string | null;
};

export type MediaControlState = {
  detachDisabled: boolean;
  fillDisabled: boolean;
  fitDisabled: boolean;
  focalPointDisabled: boolean;
  focalPointValue: MediaFocalPoint;
  hasMedia: boolean;
  recenterDisabled: boolean;
};

export function normalizeMediaFocalPoint(value: unknown): MediaFocalPoint {
  const normalized = String(value || "").trim().toLowerCase();
  const allowed: MediaFocalPoint[] = [
    "top-left",
    "top",
    "top-right",
    "left",
    "center",
    "right",
    "bottom-left",
    "bottom",
    "bottom-right"
  ];
  return allowed.includes(normalized as MediaFocalPoint) ? normalized as MediaFocalPoint : "center";
}

export function buildMediaControlState(input: MediaControlInput): MediaControlState {
  const hasMedia = Boolean(input.selectedSlideId && input.selectedMedia);
  return {
    detachDisabled: !input.selectedSlideId || !input.selectedMaterialId,
    fillDisabled: !hasMedia || input.selectedMedia?.fit === "cover",
    fitDisabled: !hasMedia || input.selectedMedia?.fit === "contain",
    focalPointDisabled: !hasMedia,
    focalPointValue: normalizeMediaFocalPoint(input.selectedMedia?.focalPoint),
    hasMedia,
    recenterDisabled: !hasMedia || !input.selectedMedia?.focalPoint || input.selectedMedia.focalPoint === "center"
  };
}
