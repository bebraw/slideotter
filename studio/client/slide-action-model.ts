export type CurrentSlideActionKey = "improve" | "media" | "visuals";

export type CurrentSlideActionInput = {
  customVisualCount: number;
  materialCount: number;
  selectedSlideId: string | null;
  variantCount: number;
};

export type CurrentSlideAction = {
  key: CurrentSlideActionKey;
  enabled: boolean;
  label: string;
  summary: string;
};

export function buildCurrentSlideActions(input: CurrentSlideActionInput): CurrentSlideAction[] {
  const hasSlide = Boolean(input.selectedSlideId);
  return [
    {
      key: "improve",
      enabled: hasSlide,
      label: "Improve",
      summary: input.variantCount > 0 ? `${input.variantCount} candidate${input.variantCount === 1 ? "" : "s"} ready` : "Draft and compare alternatives"
    },
    {
      key: "media",
      enabled: hasSlide,
      label: "Materials",
      summary: input.materialCount > 0 ? `${input.materialCount} material${input.materialCount === 1 ? "" : "s"} available` : "Attach or tune slide images"
    },
    {
      key: "visuals",
      enabled: hasSlide,
      label: "Custom visuals",
      summary: input.customVisualCount > 0 ? `${input.customVisualCount} visual${input.customVisualCount === 1 ? "" : "s"} available` : "Attach SVG artifacts"
    }
  ];
}
