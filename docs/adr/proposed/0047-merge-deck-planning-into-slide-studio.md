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

Merge the Deck Planning product surface into Slide Studio through a dedicated Outline drawer.

Slide Studio should remain the first screen for active presentation work. Deck-level controls should be available from a new Outline drawer attached to Slide Studio, not from a separate top-level page. The user should be able to review the active slide/deck preview, open outline and structure planning beside it, generate or inspect deck plans, and apply deck-level changes without leaving the main editing workspace.

Keep the internal `deck-planning-workbench.ts` module boundary. The merge is a navigation and composition change, not a reason to mix deck planning logic into current-slide editing code.

## Product Rules

- Deck planning remains explicitly deck-level. Do not present it as current-slide editing.
- The default Slide Studio view should stay focused on the active slide, preview, and current action.
- The Outline drawer should own deck shape, outline, deck-length, structure-candidate, and source-planning concerns.
- Slide Studio should expose only a compact Outline entry point and status summary while the drawer is closed.
- Generated plans, deck-length proposals, outline changes, and structure diffs remain proposals until explicit apply.
- Applying a deck plan must preserve the existing review/compare boundary and stale-version safeguards.
- Source records remain presentation-scoped. This ADR does not create a global source library.
- Advanced details such as raw diffs, plan JSON, source retrieval, and diagnostics stay inspectable but secondary.
- The old top-level Deck Planning navigation should remain only until the Outline drawer reaches feature parity.

## Proposed UI Shape

Add an Outline drawer to Slide Studio.

The closed state should keep the main workspace quiet. A small entry point near the slide rail or workspace header should show:

- current slide count and skipped-slide count
- active outline or structure label when present
- primary actions for target length, generate plan, and inspect saved plans
- a concise source status summary when source notes exist

The open Outline drawer can expose:

- deck length controls
- deck structure candidate list
- outline plan library and plan actions
- source note list and add/delete controls
- plan comparison details and explicit apply controls

Candidate review should reuse the existing preview/compare patterns where practical so deck-level proposals feel consistent with slide variants.

## Implementation Plan

1. Add the Outline drawer shell and a compact Slide Studio entry point.
   - Show counts, structure label, and available deck-level actions.
   - Keep the existing Deck Planning page unchanged.

2. Move deck length controls into the Outline drawer.
   - Preserve skip/restore/insert semantics.
   - Keep restore actions and plan application explicit.

3. Move deck structure candidates and outline plan actions.
   - Reuse the current `deck-planning-workbench.ts` render/apply paths.
   - Keep plan comparison and apply controls inside the Outline drawer.

4. Move source-library controls after the drawer owns deck shape cleanly.
   - Avoid crowding the first Outline drawer slice.
   - Keep source grounding status compact when closed.

5. Remove the top-level Deck Planning navigation after drawer parity.
   - Keep the old page only as a temporary migration surface.
   - Redirect old routes to Slide Studio with the Outline drawer open once parity is validated.

6. Update documentation and status.
   - Update `STUDIO_STATUS.md`, `ROADMAP.md`, and browser-client fixture expectations when the navigation changes.

## Completion Criteria

This ADR is complete when:

- Slide Studio has a dedicated Outline drawer.
- The Outline drawer reaches feature parity with the current Deck Planning view for deck length, skipped-slide restore, structure candidates, outline plans, source notes, and proposal apply/review flows.
- The top-level Deck Planning navigation is removed.
- Any old Deck Planning route or deep link redirects to Slide Studio with the Outline drawer open.
- Browser validation covers the Outline drawer path for the migrated workflows.
- Documentation no longer describes Deck Planning as a separate primary workspace.

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
- Do not redesign the whole Slide Studio layout beyond the Outline drawer and its entry point in the first slice.
- Do not introduce a new frontend framework or state management library.

## Consequences

This should make deck restructuring feel like part of editing the active presentation instead of a separate mode. It should reduce context switching and make preview-driven plan review easier.

The main risk is drawer overload. The mitigation is to make the first slice structure-first, with source controls and advanced diagnostics moving in only after deck shape workflows fit cleanly.

Another risk is duplicate behavior while both the old page and Outline drawer exist. The transition should reuse one workbench implementation and remove the old Deck Planning view once parity is validated.

## Open Questions

- Should the embedded area live near the slide rail, below the main preview, or in an existing side drawer?
  - Answer: Add a dedicated Outline drawer as the first implementation slice. The drawer should own deck-level structure concerns: slide order, skipped/restored slides, outline plans, deck-length proposals, and structure diffs. Keep a small deck summary near the slide rail or workspace header only as an entry point/status indicator. The expanded workflow belongs in the Outline drawer so Slide Studio stays focused on active-slide editing while deck-level planning remains one click away.
- Should source-library controls move into Slide Studio immediately, or only after deck-length and outline-plan controls are proven compact enough?
  - Answer: Move source-library controls into the Outline drawer after the drawer owns deck shape. Source notes are part of outline and generation planning, but they should not be in the first slice unless needed for parity. Start with structure, deck length, and outline plans; then add source status and source controls once the drawer layout is stable.
- Should the old Deck Planning page remain as a power-user deep link after the top-level navigation is removed?
  - Answer: No. Keep it only as a temporary migration surface. Removing the old Deck Planning view after Outline drawer feature parity is a completion criterion for this ADR. Any old route should redirect to Slide Studio with the Outline drawer open.
