export type ApiExplorerSlideFollowState = {
  activePresentationId: string | null;
  selectedSlideId: string | null;
  url: string;
};

const selectedSlideResourcePattern = /^\/api\/v1\/presentations\/([^/?#]+)\/slides\/([^/?#]+)$/;

export function getSelectedSlideResourceRefreshHref(state: ApiExplorerSlideFollowState): string | null {
  const activePresentationId = state.activePresentationId;
  const selectedSlideId = state.selectedSlideId;
  if (!activePresentationId || !selectedSlideId) {
    return null;
  }

  const match = selectedSlideResourcePattern.exec(state.url || "");
  if (!match || match[1] !== activePresentationId) {
    return null;
  }

  const nextHref = `/api/v1/presentations/${activePresentationId}/slides/${selectedSlideId}`;
  return state.url === nextHref ? null : nextHref;
}
