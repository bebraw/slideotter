# ADR 0047: Merge Deck Planning Into Slide Studio

## Status

Proposed implementation plan.

## Context

Slide Studio is the primary workspace for editing the active presentation. It owns the active slide preview, current-slide editing, materials, custom layouts, theme controls, validation, variant review, and the live post-outline creation flow.

Deck Planning is currently a separate top-level page even though its operations change the same active presentation:

- scaling deck length by skipping, restoring, or inserting slides
- generating deck structure candidates and applying shared deck-context changes
- managing reusable outline plans
- deriving new presentations from approved plans
- staging outline plans for live Slide Studio generation
- storing and using presentation-scoped source notes

That split reflects implementation history more than author intent. Authors usually decide whether to restructure a deck while looking at the active deck and slide. Moving to a separate page hides the immediate preview context and makes deck-level operations feel detached from the editing surface they mutate.

The current client implementation already has `deck-planning-workbench.ts`, so the browser code has a useful module boundary. The product surface can change without merging all deck-planning code back into the Slide Studio module.

## Decision Direction

Merge the Deck Planning product surface into Slide Studio as a deck-level operations area.

Slide Studio should remain the first screen for active presentation work. Deck-level controls should appear inside it as a compact, inspectable section, not as a separate top-level page. The user should be able to review the active slide/deck preview, generate or inspect deck plans, and apply deck-level changes without leaving the main editing workspace.

Keep the internal `deck-planning-workbench.ts` module boundary. The merge is a navigation and composition change, not a reason to mix deck planning logic into current-slide editing code.

## Product Rules

- Deck planning remains explicitly deck-level. Do not present it as current-slide editing.
- The default Slide Studio view should stay focused on the active slide, preview, and current action.
- Deck planning controls should be compact until the author opens or starts a deck-level workflow.
- Generated plans, deck-length proposals, outline changes, and structure diffs remain proposals until explicit apply.
- Applying a deck plan must preserve the existing review/compare boundary and stale-version safeguards.
- Source records remain presentation-scoped. This ADR does not create a global source library.
- Advanced details such as raw diffs, plan JSON, source retrieval, and diagnostics stay inspectable but secondary.
- The old top-level Deck Planning navigation should remain until the embedded Slide Studio flow reaches parity.

## Proposed UI Shape

Add a deck-level area inside Slide Studio, using a label such as `Deck` or `Structure`.

The collapsed/default state should show:

- current slide count and skipped-slide count
- active outline or structure label when present
- primary actions for target length, generate plan, and inspect saved plans
- a concise source status summary when source notes exist

The expanded state can expose:

- deck length controls
- deck structure candidate list
- outline plan library and plan actions
- source note list and add/delete controls
- plan comparison details and explicit apply controls

Candidate review should reuse the existing preview/compare patterns where practical so deck-level proposals feel consistent with slide variants.

## Implementation Plan

1. Embed a read-only deck summary in Slide Studio.
   - Show counts, structure label, and available deck-level actions.
   - Keep the existing Deck Planning page unchanged.

2. Move deck length controls into the embedded deck area.
   - Preserve skip/restore/insert semantics.
   - Keep restore actions and plan application explicit.

3. Move deck structure candidates and outline plan actions.
   - Reuse the current `deck-planning-workbench.ts` render/apply paths.
   - Keep plan comparison and apply controls inside the embedded section.

4. Move source-library controls only after deck actions fit cleanly.
   - Avoid crowding the default Slide Studio surface.
   - Keep source grounding status compact when closed.

5. Remove or demote the top-level Deck Planning navigation after parity.
   - The old page can become a deep link or compatibility route during the transition.
   - Remove duplicate controls once browser validation covers the embedded path.

6. Update documentation and status.
   - Update `STUDIO_STATUS.md`, `ROADMAP.md`, and browser-client fixture expectations when the navigation changes.

## Validation

Each slice should run:

- `npm run typecheck`
- `npm run validate:client-fixture`
- `npm run validate:browser:studio`

When deck application, outline derivation, source handling, or presentation creation handoff changes, also run:

- `npm test`
- `npm run validate:deck-plan-fixture`
- `npm run validate:browser:presentation`

Run `npm run quality:gate` before moving this ADR to implemented.

## Non-Goals

- Do not rewrite deck planning semantics.
- Do not remove the `deck-planning-workbench.ts` module boundary.
- Do not merge source records into a global library.
- Do not make deck plan application automatic.
- Do not redesign the whole Slide Studio layout in the first slice.
- Do not introduce a new frontend framework or state management library.

## Consequences

This should make deck restructuring feel like part of editing the active presentation instead of a separate mode. It should reduce context switching and make preview-driven plan review easier.

The main risk is crowding Slide Studio. The mitigation is to keep the deck-level area collapsed and summary-first by default, with plan details opened only when the user is actively restructuring the deck.

Another risk is duplicate behavior while both the old page and embedded area exist. The transition should reuse one workbench implementation and remove duplicate top-level controls once parity is validated.

## Open Questions

- Should the embedded area live near the slide rail, below the main preview, or in an existing side drawer?
- Should source-library controls move into Slide Studio immediately, or only after deck-length and outline-plan controls are proven compact enough?
- Should the old Deck Planning page remain as a power-user deep link after the top-level navigation is removed?
