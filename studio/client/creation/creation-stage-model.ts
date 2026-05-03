export type CreationStage = "brief" | "content" | "structure";

export type CreationStageAccessContext = {
  approved?: boolean;
  hasOutline?: boolean;
  outlineDirty?: boolean;
};

export type CreationStageAccess = {
  enabled: boolean;
  state: "active" | "available" | "complete" | "locked";
};

export function isCreationStage(stage: unknown): stage is CreationStage {
  return stage === "brief" || stage === "structure" || stage === "content";
}

export function normalizeCreationStage(stage: unknown): CreationStage {
  if (stage === "sources") {
    return "structure";
  }

  return isCreationStage(stage) ? stage : "brief";
}

export function getCreationStageAccess(stage: unknown, context: CreationStageAccessContext = {}): CreationStageAccess {
  const hasOutline = context.hasOutline === true;
  const outlineDirty = context.outlineDirty === true;
  const approved = context.approved === true;

  if (stage === "brief") {
    return {
      enabled: true,
      state: hasOutline && !outlineDirty ? "complete" : "active"
    };
  }

  if (stage === "structure") {
    return {
      enabled: hasOutline,
      state: !hasOutline ? "locked" : approved && !outlineDirty ? "complete" : "active"
    };
  }

  if (stage === "content") {
    return {
      enabled: approved && hasOutline && !outlineDirty,
      state: approved && hasOutline && !outlineDirty ? "available" : "locked"
    };
  }

  return {
    enabled: false,
    state: "locked"
  };
}
