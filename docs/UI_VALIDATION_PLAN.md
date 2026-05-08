# UI Validation Plan

This plan captures browser UI validation gaps that are worth addressing when there is focused time for test work. The current `npm run validate:browser` path already covers presentation creation, outline editing, source-backed regeneration, material attachment, deck length shrink/restore, flow target editing, and basic Studio layout checks. The items below are the next useful slices.

## Goal

Keep the most important authoring workflows covered through realistic browser interactions, especially places where the UI updates persisted presentation state or crosses a preview/apply boundary.

Prefer adding focused checks to existing browser workflow scripts when they are stable and deterministic. Use short temporary Playwright probes first when exploring a suspected gap, then fold the useful assertion into permanent validation.

## Priority 1: Flow Lifecycle Actions

Validate the full lifecycle for reusable presentation flows in the Outline drawer.

Coverage to add:

- Duplicate an existing flow.
- Set the duplicate active through the selector or card action.
- Reload or refresh state and confirm the active panel, selector, and active badge agree.
- Archive the active flow and verify another visible flow becomes active.
- Delete a non-active flow.
- Confirm archived and deleted flows do not appear in the active-flow selector.
- Confirm sources remain presentation-shared rather than flow-owned.

Expected outcome:

- Active flow state is unambiguous after every lifecycle action.
- The UI never leaves a stale active badge, stale selector value, or hidden/archived active id.

## Priority 2: Derived Deck Creation From A Flow

Validate `Derive deck` from a saved alternate flow.

Coverage to add:

- Create or duplicate a flow with non-default target length and density.
- Use `Derive deck`.
- Confirm the derived presentation becomes selectable and has the expected slide count.
- Confirm the derived deck has its own active flow seeded from the source flow.
- Confirm the original deck remains unchanged.
- Confirm copied deck context, theme, sources, and materials follow the selected copy options.

Expected outcome:

- A flow can produce a separate maintained deck version without mutating the source presentation.
- Lineage and copied shared context are inspectable and deterministic.

## Priority 3: Live Draft From Active Flow

Validate the end-to-end path from a saved active flow to live staged creation.

Coverage to add:

- Stage the active flow with `Live draft active`.
- Confirm creation fields inherit target length and density from the active flow.
- Approve/create from the staged outline.
- Confirm the new live deck has placeholders for every flow beat.
- Confirm the resulting presentation has an active flow with the same target length, density, and outline beat count.

Expected outcome:

- A user can maintain 5, 20, or 50 slide versions as flows and materialize one into a live deck without losing flow parameters.

## Priority 4: Outline JSON Editor

Validate the structured flow editor.

Coverage to add:

- Edit structured plan JSON through the `Edit structured plan` disclosure.
- Save valid JSON and confirm the flow summary updates.
- Confirm target count, density, active status, and proposal behavior still match the saved JSON.
- Try malformed JSON and confirm the UI shows a useful error without mutating persisted flow state.
- Try structurally invalid JSON and confirm server validation rejects it without mutating persisted state.

Expected outcome:

- Power-user JSON edits remain useful but cannot corrupt active flow state.

## Priority 5: Outline Creation Source And Material Paths

Deepen staged creation coverage for source and material propagation.

Coverage to add:

- Verify source URL/text sync between the Brief fields and Outline regeneration fields.
- Regenerate with sources/materials after changing source text.
- Confirm the source evidence panel updates.
- Confirm persisted presentation sources match the source material used during outline creation.
- Confirm starter image material or automatic image-search material survives into the created presentation and is available for drafting.

Expected outcome:

- Outline creation and regeneration use the source/material context users see in the UI.

## Priority 6: Deck Length UI Edge States

Validate less common length-scaling interactions.

Coverage to add:

- Invalid target values such as blank, zero, negative, and non-numeric input.
- Target equal to current deck length.
- Large target values.
- Semantic growth after an active-flow proposal exists.
- Restore behavior after a semantic growth/shrink cycle.

Expected outcome:

- The Length tab gives clear feedback, avoids no-op confusion, and keeps proposal state coherent.

## Priority 7: Refresh And Persistence Checks

Validate state consistency after browser reloads or explicit refreshes.

Coverage to add:

- Change active flow, reload, and confirm active panel/selector/card order remain consistent.
- Edit flow settings, reload, and confirm summary, details form values, and active flow state persist.
- Generate an outline, reload before approval, and confirm draft fields, outline dirty state, locks, and stage are restored.
- Approve an outline, reload during live drafting, and confirm content-run preview and Studio status are restored.

Expected outcome:

- Browser refresh does not produce UI drift or make users repeat already-saved work.

## Implementation Notes

- Keep permanent validation deterministic by using the existing mocked LLM paths in `scripts/presentation-workflow/`.
- Prefer checking server state through `/api/v1/state` after each browser action, then add one or two DOM assertions for visible UI consistency.
- Keep tests scoped to one clear behavior per added block so failures point to the broken workflow.
- Clean up temporary presentations after browser probes.
- Run at least `npm run validate:presentation-workflow` for staged creation and flow changes. Run `npm run validate:browser` before considering broader UI validation changes done.
