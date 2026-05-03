type JsonObject = Record<string, unknown>;

export type RemediationSlideSpec = JsonObject;

export type CheckRemediationIssue = JsonObject & {
  level?: unknown;
  message?: unknown;
  rule?: unknown;
  slide?: unknown;
};

export type CheckRemediationCandidate = JsonObject & {
  changeScope?: string;
  changeSummary?: string[];
  label: string;
  notes?: unknown;
  promptSummary?: unknown;
  remediationStrategy?: string;
  slideSpec: RemediationSlideSpec;
  sourceIssues?: JsonObject[];
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export function issueRule(issue: CheckRemediationIssue): string {
  return String(issue.rule || "").trim();
}

function hasPrimaryMedia(slideSpec: RemediationSlideSpec): boolean {
  const media = asJsonObject(slideSpec.media);
  return Boolean(media.url || media.src || media.materialId || media.alt || media.caption);
}

function withMediaSettings(slideSpec: RemediationSlideSpec, settings: JsonObject): RemediationSlideSpec {
  return {
    ...slideSpec,
    media: {
      ...asJsonObject(slideSpec.media),
      ...settings
    }
  };
}

function hasCompactableLayoutDefinition(slideSpec: RemediationSlideSpec): boolean {
  const layoutDefinition = asJsonObject(slideSpec.layoutDefinition);
  return Array.isArray(layoutDefinition.regions) && layoutDefinition.regions.some((region: unknown) => {
    const normalized = asJsonObject(region);
    return normalized.spacing !== "tight";
  });
}

function withCompactLayoutSpacing(slideSpec: RemediationSlideSpec): RemediationSlideSpec {
  const layoutDefinition = asJsonObject(slideSpec.layoutDefinition);
  const regions = Array.isArray(layoutDefinition.regions) ? layoutDefinition.regions : [];
  return {
    ...slideSpec,
    layoutDefinition: {
      ...layoutDefinition,
      regions: regions.map((region: unknown) => ({
        ...asJsonObject(region),
        spacing: "tight"
      }))
    }
  };
}

export function createCheckRemediationCandidates(baseSlideSpec: RemediationSlideSpec, issue: CheckRemediationIssue): CheckRemediationCandidate[] {
  const sourceIssues = [issue];
  const rule = issueRule(issue);
  const candidates: CheckRemediationCandidate[] = [];

  if ((rule === "media-legibility" || rule === "caption-source-spacing" || rule === "bounds") && hasPrimaryMedia(baseSlideSpec)) {
    candidates.push({
      changeScope: "slide-media",
      changeSummary: [
        "Switches the primary media to contain fit so the full image remains visible.",
        "Recenters the media crop target for a predictable review starting point."
      ],
      generator: "local",
      label: "Fit image",
      notes: "Mechanical media repair candidate for a validation issue.",
      promptSummary: "Check remediation proposed a local media fit adjustment.",
      provider: "local",
      remediationStrategy: "media-fit-contain",
      slideSpec: withMediaSettings(baseSlideSpec, { fit: "contain", focalPoint: "center" }),
      sourceIssues
    });
    candidates.push({
      changeScope: "slide-media",
      changeSummary: [
        "Keeps the media region filled while resetting the focal point to center.",
        "Useful when contain fit leaves too much empty space for the current layout."
      ],
      generator: "local",
      label: "Fill image",
      notes: "Mechanical media repair candidate for a validation issue.",
      promptSummary: "Check remediation proposed a local media fill adjustment.",
      provider: "local",
      remediationStrategy: "media-fit-cover",
      slideSpec: withMediaSettings(baseSlideSpec, { fit: "cover", focalPoint: "center" }),
      sourceIssues
    });
  }

  if (hasCompactableLayoutDefinition(baseSlideSpec)) {
    candidates.push({
      changeScope: "layout-definition",
      changeSummary: [
        "Tightens custom layout region spacing while preserving the current content.",
        "Keeps the repair mechanical so the candidate can be reviewed before applying."
      ],
      generator: "local",
      label: "Use compact spacing",
      notes: "Mechanical custom layout spacing repair candidate for a validation issue.",
      promptSummary: "Check remediation proposed a local compact spacing adjustment.",
      provider: "local",
      remediationStrategy: "layout-compact-spacing",
      slideSpec: withCompactLayoutSpacing(baseSlideSpec),
      sourceIssues
    });
  }

  return candidates;
}
