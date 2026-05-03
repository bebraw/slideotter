export type CloudPresentationPath = {
  presentationId: string;
  workspaceId: string;
};

export type CloudSlidePath = CloudPresentationPath & {
  slideId: string;
};

export type CloudSourcePath = CloudPresentationPath & {
  sourceId: string;
};

export type CloudMaterialPath = CloudPresentationPath & {
  materialId: string;
};

export function matchWorkspacePresentationsPath(pathname: string): string | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations$/.exec(pathname);
  return match && match[1] ? match[1] : null;
}

export function matchWorkspacePresentationBundlesPath(pathname: string): string | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentation-bundles$/.exec(pathname);
  return match && match[1] ? match[1] : null;
}

export function matchWorkspaceProviderConfigPath(pathname: string): string | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/provider-config$/.exec(pathname);
  return match && match[1] ? match[1] : null;
}

export function matchPresentationSlidesPath(pathname: string): CloudPresentationPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/slides$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

export function matchPresentationSlidePath(pathname: string): CloudSlidePath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/slides\/([a-z0-9][a-z0-9-]{0,63})$/.exec(pathname);
  return match && match[1] && match[2] && match[3] ? { presentationId: match[2], slideId: match[3], workspaceId: match[1] } : null;
}

export function matchPresentationBundlePath(pathname: string): CloudPresentationPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/bundle$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

export function matchPresentationRenderingProofPath(pathname: string): CloudPresentationPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/rendering-proof$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

export function matchPresentationRenderingProofDocumentPath(pathname: string): CloudPresentationPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/rendering-proof\/document$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

export function matchPresentationJobsPath(pathname: string): CloudPresentationPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/jobs$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

export function matchPresentationSourcesPath(pathname: string): CloudPresentationPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/sources$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

export function matchPresentationSourcePath(pathname: string): CloudSourcePath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/sources\/([a-z0-9][a-z0-9-]{0,63})$/.exec(pathname);
  return match && match[1] && match[2] && match[3] ? { presentationId: match[2], sourceId: match[3], workspaceId: match[1] } : null;
}

export function matchPresentationMaterialsPath(pathname: string): CloudPresentationPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/materials$/.exec(pathname);
  return match && match[1] && match[2] ? { presentationId: match[2], workspaceId: match[1] } : null;
}

export function matchPresentationMaterialPath(pathname: string): CloudMaterialPath | null {
  const match = /^\/api\/cloud\/v1\/workspaces\/([a-z0-9][a-z0-9-]{0,63})\/presentations\/([a-z0-9][a-z0-9-]{0,63})\/materials\/([a-z0-9][a-z0-9-]{0,63})$/.exec(pathname);
  return match && match[1] && match[2] && match[3] ? { materialId: match[3], presentationId: match[2], workspaceId: match[1] } : null;
}
