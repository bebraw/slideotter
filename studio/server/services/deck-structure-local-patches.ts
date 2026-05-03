import type { DeckStructureContext, JsonObject } from "./deck-structure-plan-model.ts";

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export function createDecisionDeckPatch(context: DeckStructureContext): JsonObject {
  return {
    subject: `Decision support for ${context.audience}`,
    themeBrief: "keep the deck crisp, direct, and centered on one decision path",
    tone: "decisive and evidence-led",
    visualTheme: {
      accent: "d97a2b",
      primary: "15304a",
      progressFill: "15304a",
      secondary: "215e8b"
    }
  };
}

export function createOperatorDeckPatch(): JsonObject {
  return {
    subject: "Operator handoff and maintenance routine",
    themeBrief: "keep the deck sober, maintenance-oriented, and checklist-friendly",
    tone: "operational and exact",
    visualTheme: {
      accent: "4f7a28",
      panel: "f7faf7",
      progressFill: "4f7a28",
      secondary: "325d52"
    }
  };
}

export function createBoundaryDeckPatch(): JsonObject {
  return {
    subject: "Ownership boundary map",
    themeBrief: "make boundaries explicit and keep the deck cleanly sectioned",
    tone: "structural and exact",
    visualTheme: {
      accent: "6b8de3",
      panel: "f5f8ff",
      progressFill: "275d8c",
      secondary: "3f67a8"
    }
  };
}

export function createSequenceDeckPatch(): JsonObject {
  return {
    subject: "Start-to-finish operating sequence",
    themeBrief: "keep the deck sequential, concrete, and easy to follow from frame to handoff",
    tone: "linear, practical, and calm",
    visualTheme: {
      accent: "c76d2a",
      primary: "173449",
      progressFill: "2c6b73",
      secondary: "2c6b73"
    }
  };
}

export function createCompressedDeckPatch(): JsonObject {
  return {
    designConstraints: {
      maxWordsPerSlide: 65,
      minContentGapIn: 0.22
    },
    subject: "Compressed proof and handoff path",
    themeBrief: "keep only the framing, proof, and handoff beats that survive a shorter run",
    tone: "brief, evidence-led, and action-oriented",
    visualTheme: {
      accent: "b05f2a",
      muted: "4f6070",
      progressFill: "b05f2a",
      secondary: "2f5f69"
    }
  };
}

export function createComposedDecisionHandoffDeckPatch(context: DeckStructureContext): JsonObject {
  const decisionPatch = createDecisionDeckPatch(context);
  const decisionTheme = asJsonObject(decisionPatch.visualTheme);

  return {
    ...decisionPatch,
    designConstraints: {
      maxWordsPerSlide: 70,
      minContentGapIn: 0.2
    },
    subject: "Composed decision handoff",
    themeBrief: "keep decision criteria, proof, and operator handoff in one tight path",
    tone: "decisive, operational, and concise",
    visualTheme: {
      ...decisionTheme,
      panel: "f7faf7",
      progressFill: "d97a2b",
      secondary: "325d52"
    }
  };
}
