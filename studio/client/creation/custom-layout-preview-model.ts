export type LayoutDefinition = {
  type?: string;
} & Record<string, unknown>;

export type SlideSpec = {
  layout?: string;
  layoutDefinition?: LayoutDefinition | null;
  type?: string;
} & Record<string, unknown>;

export type CustomLayoutPreviewOptions = {
  includeLayoutDefinition?: boolean;
};

export type CustomLayoutLivePreviewContext = {
  drawerOpen: boolean;
  definitionPreviewActive: boolean;
  mainPreviewActive: boolean;
  selectedSlideSupported: boolean;
  slidePresent: boolean;
};

export function normalizeLayoutTreatment(value: unknown): string {
  const treatment = String(value || "").trim().toLowerCase();
  return treatment === "default" || !treatment ? "standard" : treatment;
}

export function parseRequiredJson(source: unknown, emptyMessage: string, invalidMessage: string): unknown {
  const trimmed = String(source || "").trim();
  if (!trimmed) {
    throw new Error(emptyMessage);
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(invalidMessage);
  }
}

export function parseOptionalLayoutDefinition(source: unknown): LayoutDefinition | null {
  const trimmed = String(source || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as LayoutDefinition
      : null;
  } catch (error) {
    return null;
  }
}

export function buildCustomLayoutPreviewSlideSpec(
  baseSpec: SlideSpec | null | undefined,
  treatment: unknown,
  layoutDefinition: LayoutDefinition | null,
  options: CustomLayoutPreviewOptions = {}
): SlideSpec | null {
  if (!baseSpec || !["content", "cover"].includes(baseSpec.type || "")) {
    return null;
  }

  const previewSpec: SlideSpec = {
    ...baseSpec,
    layout: normalizeLayoutTreatment(treatment || baseSpec.layout)
  };

  if (options.includeLayoutDefinition !== false) {
    previewSpec.layoutDefinition = layoutDefinition;
  }

  return previewSpec;
}

export function shouldUseCustomLayoutLivePreview(context: CustomLayoutLivePreviewContext): boolean {
  return context.slidePresent
    && context.drawerOpen
    && context.mainPreviewActive
    && context.selectedSlideSupported;
}
