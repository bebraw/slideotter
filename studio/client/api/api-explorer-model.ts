export type ApiExplorerSlideFollowState = {
  activePresentationId: string | null;
  selectedSlideId: string | null;
  url: string;
};

export type ApiExplorerLink = {
  href: string;
};

export type ApiExplorerResource = {
  id?: string;
  links?: Record<string, ApiExplorerLink | null | undefined>;
  resource?: string;
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

export function withClientSelectedSlideLink<TResource extends ApiExplorerResource>(
  resource: TResource,
  state: Pick<ApiExplorerSlideFollowState, "activePresentationId" | "selectedSlideId">
): TResource {
  if (
    resource.resource !== "presentation"
    || !state.activePresentationId
    || !state.selectedSlideId
    || resource.id !== state.activePresentationId
  ) {
    return resource;
  }

  return {
    ...resource,
    links: {
      ...(resource.links || {}),
      selectedSlide: {
        href: `/api/v1/presentations/${state.activePresentationId}/slides/${state.selectedSlideId}`
      }
    }
  };
}
