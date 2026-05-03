type JsonObject = Record<string, unknown>;

export type ContentRunArtifactMaterial = JsonObject & {
  alt?: unknown;
  caption?: unknown;
  creator?: unknown;
  dataUrl?: unknown;
  fileName?: unknown;
  id?: unknown;
  license?: unknown;
  licenseUrl?: unknown;
  provider?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  url?: unknown;
};

export type ContentRunArtifactState = JsonObject & {
  materials?: unknown;
  sourceText?: unknown;
};

export type ContentRunSlideSpecPayload = JsonObject & {
  layout?: unknown;
  media?: JsonObject;
  type?: unknown;
};

export type ContentRunArtifactDependencies = {
  createMaterialFromDataUrl: (material: {
    alt?: unknown;
    caption?: unknown;
    dataUrl?: unknown;
    fileName?: unknown;
    id?: unknown;
    title?: unknown;
  }) => ContentRunArtifactMaterial;
  createMaterialFromRemoteImage: (material: {
    alt?: unknown;
    caption?: unknown;
    creator?: unknown;
    id?: unknown;
    license?: unknown;
    licenseUrl?: unknown;
    provider?: unknown;
    sourceUrl?: unknown;
    title?: unknown;
    url?: unknown;
  }) => Promise<ContentRunArtifactMaterial>;
  createSource: (source: {
    text: unknown;
    title: string;
  }) => Promise<unknown>;
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isContentRunArtifactMaterial(value: unknown): value is ContentRunArtifactMaterial {
  return isJsonObject(value);
}

export function replaceMaterialUrlsInSlideSpec(spec: unknown, materialUrlById: Map<string, unknown>): ContentRunSlideSpecPayload {
  const next = JSON.parse(JSON.stringify(isJsonObject(spec) ? spec : {}));
  if (isJsonObject(next.media)) {
    const mediaId = typeof next.media.id === "string" ? next.media.id : "";
    const url = materialUrlById.get(mediaId);
    if (url) {
      next.media.src = url;
    }
  }
  if (Array.isArray(next.mediaItems)) {
    next.mediaItems = next.mediaItems.map((item: unknown) => {
      if (!isJsonObject(item)) {
        return item;
      }
      const itemId = typeof item.id === "string" ? item.id : "";
      const url = materialUrlById.get(itemId);
      if (!url) {
        return item;
      }
      return {
        ...item,
        src: url
      };
    });
  }
  return next;
}

export async function importContentRunArtifacts(
  run: ContentRunArtifactState,
  deps: ContentRunArtifactDependencies
): Promise<Map<string, unknown>> {
  const generationMaterials = Array.isArray(run.materials)
    ? run.materials.filter(isContentRunArtifactMaterial)
    : [];
  const importedMaterials: ContentRunArtifactMaterial[] = [];
  const starterGenerationMaterials = generationMaterials.filter((material: ContentRunArtifactMaterial) => material.dataUrl);
  starterGenerationMaterials.forEach((material: ContentRunArtifactMaterial) => {
    importedMaterials.push(deps.createMaterialFromDataUrl({
      alt: material.alt,
      caption: material.caption,
      dataUrl: material.dataUrl,
      fileName: material.fileName,
      id: material.id,
      title: material.title
    }));
  });

  const remoteMaterials = generationMaterials.filter((material: ContentRunArtifactMaterial) => material.url && !material.dataUrl);
  for (const material of remoteMaterials) {
    try {
      importedMaterials.push(await deps.createMaterialFromRemoteImage({
        alt: material.alt,
        caption: material.caption,
        creator: material.creator,
        id: material.id,
        license: material.license,
        licenseUrl: material.licenseUrl,
        provider: material.provider,
        sourceUrl: material.sourceUrl,
        title: material.title,
        url: material.url
      }));
    } catch (error) {
      // Keep accepting the partial deck even if a searched image is unavailable.
    }
  }

  if (run.sourceText) {
    await deps.createSource({
      text: run.sourceText,
      title: "Starter sources"
    });
  }

  return new Map(importedMaterials.map((material: ContentRunArtifactMaterial) => [String(material.id || ""), material.url]));
}
