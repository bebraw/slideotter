import { collectDeckStructureContext, type DeckStructureContext, type DeckStructureSlide } from "./deck-structure-context.ts";
import { createDeckStructurePlan } from "./deck-structure-plan-construction.ts";
import {
  createBoundaryDeckPatch,
  createCompressedDeckPatch,
  createComposedDecisionHandoffDeckPatch,
  createDecisionDeckPatch,
  createOperatorDeckPatch,
  createSequenceDeckPatch
} from "./deck-structure-local-patches.ts";
import {
  createDeckWideAuthoringPlan,
  createInsertedDecisionCriteriaSlide,
  createReplacementOperatorChecklistSlide,
  type DeckWideAuthoringDetails
} from "./deck-structure-local-authoring.ts";
import {
  rewriteContentSlideSpec,
  rewriteCoverSlideSpec,
  rewriteDividerSlideSpec,
  rewritePhotoGridSlideSpec,
  rewritePhotoSlideSpec,
  rewriteQuoteSlideSpec,
  rewriteSummarySlideSpec,
  rewriteTocSlideSpec
} from "./deck-structure-slide-rewrites.ts";

type JsonObject = Record<string, unknown>;

type DeckContext = JsonObject & {
  deck: JsonObject;
  slides: Record<string, JsonObject>;
};

export function createLocalDeckStructureCandidates(context: DeckContext): JsonObject[] {
  const structureContext = collectDeckStructureContext(context);
  const currentLines = structureContext.slides.map((slide) => slide.outlineLine);
  const currentTitles = structureContext.slides.map((slide) => slide.currentTitle);
  const fallbackTitles = currentLines.length ? currentLines : currentTitles;

  return [
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck as a clearer start-to-finish operating sequence.",
      deckPatch: createSequenceDeckPatch(),
      focus: [
        `Open with the main claim for ${structureContext.audience}.`,
        "Show the shared system that makes the claim hold together.",
        "Put the strongest evidence and constraints in one place.",
        "Close on the operating or handoff path."
      ],
      label: "Sequence-led structure",
      notes: "Turns the deck into a stepwise path from framing through proof and handoff.",
      promptSummary: "Uses the deck objective and saved outline to build a cleaner sequence across the whole deck.",
      rationales: [
        "Keep the first slide as the frame so the deck states its claim immediately.",
        "Use the second slide to explain the shared system before proof details land.",
        "Let the third slide carry the strongest evidence and constraints.",
        "Reserve the final slide for the concrete handoff or next step."
      ],
      roles: ["Frame", "System", "Proof", "Handoff"],
      summary: `Organize the deck as a sequence that moves from ${fallbackTitles[0] || "framing"} toward ${fallbackTitles[fallbackTitles.length - 1] || "handoff"}.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        fallbackTitles[1] || "Shared system",
        fallbackTitles[2] || "Proof and guardrails",
        fallbackTitles[3] || "What to do next"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around ownership boundaries instead of a linear walkthrough.",
      deckPatch: createBoundaryDeckPatch(),
      focus: [
        "Start by showing what belongs in the deck itself.",
        "Make the validation and boundary logic explicit before the shared runtime details.",
        "Clarify which concerns belong to the shared runtime.",
        "Close on what the next operator should keep in view."
      ],
      label: "Boundary-led structure",
      notes: "Frames the presentation around authorship, runtime, validation, and handoff boundaries.",
      order: [0, 2, 1, 3],
      promptSummary: "Uses deck constraints, theme brief, and current slide roles to build a clearer ownership map.",
      rationales: [
        "Keep the first slide focused on what the deck owns.",
        "Move the proof slide earlier so the validation boundary is visible before runtime details.",
        "Push the shared runtime explanation after the validation frame.",
        "Close on handoff so the operator leaves with a clear next move."
      ],
      roles: ["Authoring", "Guardrails", "Runtime", "Handoff"],
      summary: `Organize the deck as a boundary map so ${structureContext.constraints}.`,
      titles: [
        "Slide-owned content",
        "Validation guardrails",
        "Shared runtime system",
        "Editor handoff"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around one decision path rather than a general demo tour.",
      deckPatch: createDecisionDeckPatch(structureContext),
      focus: [
        "Open with the core decision or claim the deck needs to support.",
        "Show the options or structure that shape that decision.",
        "Insert one explicit criteria slide before the proof block so the decision rules are visible.",
        "Make the strongest proof and operational limits explicit.",
        "Close on the action the team should take next."
      ],
      insertions: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number) => createInsertedDecisionCriteriaSlide(context, proposedIndex),
          proposedIndex: 3,
          summary: "Insert one decision-criteria slide to bridge the options and proof sections.",
          title: "Decision criteria",
          type: "content"
        }
      ],
      label: "Decision-led structure",
      notes: "Turns the presentation into a decision-support flow aimed at a concrete next move.",
      promptSummary: "Uses audience, objective, and saved notes to build a more decision-oriented presentation structure.",
      rationales: [
        "Keep the opening slide focused on the decision instead of a generic intro.",
        "Use the second slide to surface the available structure options.",
        "Add one explicit criteria slide so the audience sees how options are judged before proof lands.",
        "Let the third slide act as the proof block that narrows the decision.",
        "Turn the final slide into the explicit action to take next."
      ],
      roles: ["Decision", "Options", "Criteria", "Evidence", "Action"],
      summary: `Organize the deck around one decision path for ${structureContext.audience}, then close on the next action.`,
      titles: [
        "The decision to make",
        "The structure options",
        "Decision criteria",
        "The proof and limits",
        "The next action"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Reframed the deck around a stronger operator handoff by replacing the closing slide with a checklist scaffold.",
      deckPatch: createOperatorDeckPatch(),
      focus: [
        "Open with the deck claim and keep the audience anchored on the decision.",
        "Use the structure slide to show the available paths before the proof lands.",
        "Keep the proof slide focused on evidence and limits.",
        "Replace the final slide with an operator checklist that turns the proof into an explicit handoff."
      ],
      label: "Operator-checklist structure",
      notes: "Keeps the current deck length but repurposes the closing slot into a more operational summary surface.",
      promptSummary: "Uses the saved objective and tone to turn the final slide into an operator-ready checklist instead of a generic summary.",
      rationales: [
        "Keep the opening claim visible so the rest of the deck still has a clear frame.",
        "Use the second slide to orient the audience before the proof block.",
        "Leave the third slide as the concentrated evidence layer.",
        "Replace the last slide with one checklist surface so the deck ends on a concrete handoff."
      ],
      replacements: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number, proposedTitle: string) => createReplacementOperatorChecklistSlide(context, proposedIndex, proposedTitle),
          currentIndex: 4,
          summary: "Replace the final summary slide with an operator checklist that names the decision, guardrails, and next owner.",
          type: "summary"
        }
      ],
      roles: ["Frame", "Orientation", "Proof", "Checklist"],
      summary: `Organize the deck as a proof-backed handoff for ${structureContext.audience}, then replace the closing slide with an explicit operator checklist.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        "The structure map",
        fallbackTitles[2] || "Proof and guardrails",
        "Operator checklist"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Compressed the deck by archiving the explicit outline slide and moving straight from framing to proof to handoff.",
      deckPatch: createCompressedDeckPatch(),
      focus: [
        "Open with the core claim and keep the audience oriented on the decision.",
        "Move directly into proof and operating limits without restating the outline.",
        "Close on the operator-facing handoff."
      ],
      label: "Compressed proof structure",
      notes: "Shortens the deck to three live slides by archiving the outline beat instead of deleting its source file.",
      order: [0, 2, 3],
      promptSummary: "Uses the saved outline and objective to collapse the deck into a shorter frame-proof-handoff path.",
      rationales: [
        "Keep the opening claim so the deck still has a clear frame.",
        "Move straight into the proof block once the audience has the frame.",
        "End on the handoff instead of keeping a separate outline recap."
      ],
      removals: [
        {
          currentIndex: 2,
          rationale: "Archive the outline slide once the opening frame already explains the path.",
          role: "Archived outline",
          summary: "Remove the explicit outline slide from the live deck while keeping its source file recoverable."
        }
      ],
      roles: ["Frame", "Proof", "Handoff"],
      summary: `Compress the deck for ${structureContext.audience} by archiving the outline beat and moving directly from frame to proof to handoff.`,
      titles: [
        fallbackTitles[0] || "Why this matters",
        fallbackTitles[2] || "Proof and guardrails",
        "Operator handoff"
      ]
    }),
    createDeckStructurePlan(structureContext, {
      changeLead: "Composed a tighter decision path by archiving the outline slide, inserting explicit criteria, and replacing the close with an operator checklist.",
      deckPatch: createComposedDecisionHandoffDeckPatch(structureContext),
      focus: [
        "Open with the decision or claim the audience needs to make.",
        "Insert one compact criteria slide immediately so the audience knows how options will be judged.",
        "Move from criteria into proof and constraints without the separate outline beat.",
        "Replace the final close with an operator checklist that turns the proof into an explicit handoff."
      ],
      insertions: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number) => createInsertedDecisionCriteriaSlide(context, proposedIndex),
          proposedIndex: 2,
          summary: "Insert a compact criteria slide before the proof block so the decision rules are visible early.",
          title: "Decision criteria",
          type: "content"
        }
      ],
      label: "Composed decision handoff",
      notes: "Combines archive, insert, replacement, retitle, and reorder moves into one guarded deck-level compose pass.",
      order: [0, 2, 3],
      promptSummary: "Uses the saved objective and outline to compose one tighter decision-support deck path with explicit criteria and handoff scaffolding.",
      rationales: [
        "Keep the opening slide focused on the decision instead of re-explaining the outline.",
        "Insert criteria before the proof so the audience knows how evidence will be judged.",
        "Let the proof slide narrow the decision with the strongest constraints in one place.",
        "Replace the final close with a checklist so the deck ends on a concrete operating handoff."
      ],
      removals: [
        {
          currentIndex: 2,
          rationale: "Archive the explicit outline beat once the deck already moves as a clear decision path.",
          role: "Archived outline",
          summary: "Remove the separate outline slide from the live deck while keeping the source file available."
        }
      ],
      replacements: [
        {
          createSlideSpec: (context: DeckStructureContext, proposedIndex: number, proposedTitle: string) => createReplacementOperatorChecklistSlide(context, proposedIndex, proposedTitle),
          currentIndex: 4,
          summary: "Replace the closing summary with an operator checklist that carries the decision and guardrails into execution.",
          type: "summary"
        }
      ],
      roles: ["Decision", "Criteria", "Proof", "Checklist"],
      summary: `Compose the deck into a tighter decision-support path for ${structureContext.audience} by combining criteria, proof, and handoff in one guarded plan.`,
      titles: [
        "The decision to make",
        "Decision criteria",
        "The proof and limits",
        "Operator checklist"
      ]
    }),
    createDeckWideAuthoringPlan(structureContext, {
      changeLead: "Rewrote the full deck around one explicit decision path so every live slide carries claim, proof, and next action language.",
      createSlideSpec: (currentContext: DeckStructureContext, details: DeckWideAuthoringDetails) => {
        const objective = currentContext.objective;
        const audience = currentContext.audience;
        const baseSpec = details.currentSpec;

        switch (baseSpec.type) {
          case "divider":
            return rewriteDividerSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle);
          case "quote":
            return rewriteQuoteSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              attribution: "Decision path",
              context: `Use this pull quote to keep ${audience} focused on the approval call.`,
              quote: "A deck earns trust when the decision, proof, and next move stay visible.",
              source: "Authored deck copy"
            });
          case "photo":
            return rewritePhotoSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Use the image as visual evidence for the decision, proof, and next move."
            });
          case "photoGrid":
            return rewritePhotoGridSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Use the image set as visual evidence for the decision, proof, and next move.",
              summary: "Keep the grid focused on comparison, proof, and the next action."
            });
          case "cover":
            return rewriteCoverSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: `State the decision clearly for ${audience} before showing tooling detail.`,
                  title: "Decision"
                },
                {
                  body: "Make the judging criteria visible so the audience knows how proof will be read.",
                  title: "Criteria"
                },
                {
                  body: "Close the opener on the concrete move the team should approve next.",
                  title: "Next move"
                }
              ],
              eyebrow: "Decision",
              note: "Carry one claim, the evaluation criteria, and the next move through the whole deck.",
              summary: `Frame the presentation as one decision-support path that helps ${audience} ${objective}.`
            });
          case "toc":
            return rewriteTocSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "Open with the decision and the audience context instead of a generic product tour.",
                  title: "Frame the call"
                },
                {
                  body: "Show the shared runtime and the checks that explain why the decision is defensible.",
                  title: "Explain the system"
                },
                {
                  body: "End on proof, limits, and the concrete approval step.",
                  title: "Approve the move"
                }
              ],
              eyebrow: "Path",
              note: "The outline should read like a decision path, not a neutral contents page.",
              summary: `Map the deck as a short path from framing through proof to the next move for ${audience}.`
            });
          case "content":
            return rewriteContentSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              eyebrow: "Evidence",
              guardrails: [
                {
                  body: `Keep the live path to ${currentContext.slides.length} reviewed slides.`,
                  title: "Slides in path"
                },
                {
                  body: "Ask for one explicit approval after comparison.",
                  title: "Approval step"
                },
                {
                  body: "Run the local quality gate before archive update.",
                  title: "Quality gate"
                }
              ],
              guardrailsTitle: "Decision guardrails",
              signals: [
                {
                  body: "The slide should state the decision the deck supports.",
                  title: "Claim"
                },
                {
                  body: "The runtime path explains why the claim is maintainable.",
                  title: "System"
                },
                {
                  body: "Validation and baseline checks make the proof inspectable.",
                  title: "Proof"
                }
              ],
              signalsTitle: "Decision signals",
              summary: "Concentrate the strongest proof and operating limits on one slide before asking for approval."
            });
          case "summary":
            return rewriteSummarySlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              bullets: [
                {
                  body: "Restate the decision in one sentence so the close names the actual call to make.",
                  title: "Approve the call"
                },
                {
                  body: "Name the owner, timing, and apply step so the audience knows what happens next.",
                  title: "Assign the next move"
                },
                {
                  body: "Run the rebuild and validation gate before treating the deck as approved output.",
                  title: "Validate the result"
                }
              ],
              eyebrow: "Action",
              resources: [
                {
                  body: "slides/output/<presentation-id>.pdf",
                  title: "Approval artifact"
                },
                {
                  body: "npm run quality:gate",
                  title: "Final check"
                }
              ],
              resourcesTitle: "Decision support",
              summary: `Close on an explicit approval path so ${audience} can act on the deck without guessing.`
            });
          default:
            return baseSpec;
        }
      },
      focus: [
        "Open on the decision and the audience context instead of a generic demo frame.",
        "Turn the outline into an explicit path from framing through proof to approval.",
        "Make the strongest evidence and operating limits visible on one concentrated slide.",
        "Close on approval, ownership, and the validation step."
      ],
      deckPatch: createDecisionDeckPatch(structureContext),
      kindLabel: "Deck authoring",
      label: "Decision narrative authoring",
      notes: "Batch-authors every live slide so the whole deck reads as one decision path instead of a demo tour.",
      promptSummary: "Uses the saved deck objective and audience to rewrite the current slide files into a tighter decision-support narrative.",
      rationales: [
        "Retitle and rewrite the opener so the whole deck starts on the decision to make.",
        "Rewrite the outline slide as a real narrative path instead of a neutral contents list.",
        "Turn the evidence slide into an explicit proof-and-guardrails surface.",
        "Close on approval, ownership, and the final validation step."
      ],
      replacementSummary: (slide: DeckStructureSlide) => `Rewrite ${slide.currentTitle} so it supports the full-deck decision narrative instead of only its current local role.`,
      roles: ["Decision", "Path", "Evidence", "Approval"],
      summary: `Rewrite the live deck for ${structureContext.audience} as one decision narrative with explicit proof and action language.`,
      titles: [
        "The decision to make",
        "The decision path",
        "Evidence and guardrails",
        "Approve the next move"
      ]
    }),
    createDeckWideAuthoringPlan(structureContext, {
      changeLead: "Rewrote the full deck as an operator-facing handoff so every slide carries maintenance, validation, and ownership language.",
      createSlideSpec: (currentContext: DeckStructureContext, details: DeckWideAuthoringDetails) => {
        const objective = currentContext.objective;
        const baseSpec = details.currentSpec;

        switch (baseSpec.type) {
          case "divider":
            return rewriteDividerSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle);
          case "quote":
            return rewriteQuoteSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              attribution: "Operator handoff",
              context: `Use this pull quote to keep ${objective} attached to validation and ownership.`,
              quote: "A maintained deck keeps the source, preview, and validation path in the same loop.",
              source: "Authored deck copy"
            });
          case "photo":
            return rewritePhotoSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Keep the image attached to the source, preview, and validation loop."
            });
          case "photoGrid":
            return rewritePhotoGridSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              caption: "Keep the image set attached to the source, preview, and validation loop.",
              summary: "Use the grid to compare maintained artifacts without losing provenance."
            });
          case "cover":
            return rewriteCoverSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "State what the deck must preserve when someone new edits or extends it.",
                  title: "Hold the source"
                },
                {
                  body: "Make the runtime and layout rules readable before any edits are proposed.",
                  title: "Understand the system"
                },
                {
                  body: "Leave the opener with the one approval gate the next operator must run.",
                  title: "Keep the gate"
                }
              ],
              eyebrow: "Operator",
              note: "Treat the deck as a maintained system: source, runtime, preview, and validation stay connected.",
              summary: `Frame the deck as an operator handoff that helps the next editor ${objective}.`
            });
          case "toc":
            return rewriteTocSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              cards: [
                {
                  body: "Start with the authoring boundary so slide-specific and shared logic do not blur together.",
                  title: "Authoring boundary"
                },
                {
                  body: "Show how the runtime and preview loop keep structure, rendering, and state aligned.",
                  title: "Runtime loop"
                },
                {
                  body: "End on validation and handoff so the operating routine is explicit.",
                  title: "Validation routine"
                }
              ],
              eyebrow: "Routine",
              note: "The outline should read like a maintenance loop for the next operator.",
              summary: "Map the deck as one operating routine from authoring boundary through runtime checks to handoff."
            });
          case "content":
            return rewriteContentSlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              eyebrow: "Guardrails",
              guardrails: [
                {
                  body: `Keep edits scoped to the ${currentContext.slides.length} active slide files.`,
                  title: "Slide files"
                },
                {
                  body: "Keep browser preview and export on the shared DOM path.",
                  title: "Runtime path"
                },
                {
                  body: "Treat render validation as the handoff gate.",
                  title: "Render gate"
                }
              ],
              guardrailsTitle: "Operating guardrails",
              signals: [
                {
                  body: "Deck context and slide specs describe the intended edit.",
                  title: "Authoring"
                },
                {
                  body: "The DOM renderer owns preview and exported output.",
                  title: "Runtime"
                },
                {
                  body: "Compare surfaces show candidates before apply.",
                  title: "Preview"
                }
              ],
              signalsTitle: "Operating signals",
              summary: "Make the runtime signals and validation guardrails explicit so the next editor knows what keeps the deck stable."
            });
          case "summary":
            return rewriteSummarySlideSpec(baseSpec, details.proposedIndex, details.proposedTitle, {
              bullets: [
                {
                  body: "Save the brief, context, and structure plan before changing slide files.",
                  title: "Carry the context"
                },
                {
                  body: "Rebuild previews after edits so the working deck stays visible and comparable.",
                  title: "Rebuild the truth"
                },
                {
                  body: "Run the quality gate before treating the change as a finished handoff.",
                  title: "Close the gate"
                }
              ],
              eyebrow: "Handoff",
              resources: [
                {
                  body: "presentations/<id>/state/deck-context.json",
                  title: "Saved context"
                },
                {
                  body: "render baseline + npm run quality:gate",
                  title: "Gate surface"
                }
              ],
              resourcesTitle: "Keep nearby",
              summary: "End with the concrete operating routine the next editor should follow before shipping a change."
            });
          default:
            return baseSpec;
        }
      },
      focus: [
        "Open on the maintenance contract the next editor must preserve.",
        "Explain the operating routine instead of only listing sections.",
        "Show the signals and guardrails that keep the deck stable.",
        "End on the handoff checklist the next editor should follow."
      ],
      deckPatch: createOperatorDeckPatch(),
      kindLabel: "Deck authoring",
      label: "Operator handoff authoring",
      notes: "Batch-authors every live slide around ownership boundaries, runtime routine, and the operator-facing validation loop.",
      promptSummary: "Uses the saved constraints, objective, and theme brief to rewrite the live deck as an operator handoff rather than a product demo.",
      rationales: [
        "Rewrite the opener so the deck starts on the maintenance contract instead of the demo surface.",
        "Turn the outline into an operating routine the next editor can actually follow.",
        "Make the proof slide explicitly about signals and guardrails that keep the deck stable.",
        "Finish on a checklist-style handoff for the next editor."
      ],
      replacementSummary: (slide: DeckStructureSlide) => `Rewrite ${slide.currentTitle} so it contributes to one operator-facing handoff across the full deck.`,
      roles: ["Contract", "Routine", "Guardrails", "Handoff"],
      summary: `Rewrite the live deck as an operator handoff so the next editor can maintain the system without reconstructing the workflow.`,
      titles: [
        "What the deck must hold",
        "How the deck is maintained",
        "What keeps it stable",
        "Operator handoff"
      ]
    })
  ];
}
