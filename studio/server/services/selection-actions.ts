export function buildActionDescriptors(): Array<Record<string, unknown>> {
  return [
    {
      acceptsScope: ["selection", "slide"],
      effect: "candidate",
      href: "/api/v1/assistant/message",
      input: {
        required: ["message", "slideId"],
        optional: ["selection", "candidateCount", "sessionId"]
      },
      label: "Selection-aware assistant command",
      method: "POST",
      rel: "assistant-message"
    },
    {
      acceptsScope: ["selection", "slide"],
      effect: "write",
      href: "/api/v1/slides/{slideId}/slide-spec",
      input: {
        required: ["slideSpec"],
        optional: ["selectionScope", "rebuild", "visualTheme"]
      },
      label: "Apply slide candidate",
      method: "POST",
      rel: "apply-slide-spec"
    },
    {
      acceptsScope: ["deck"],
      effect: "candidate",
      href: "/api/v1/operations/ideate-deck-structure",
      input: {
        optional: ["dryRun"]
      },
      label: "Generate deck-plan candidates",
      method: "POST",
      rel: "ideate-deck-structure"
    }
  ];
}
