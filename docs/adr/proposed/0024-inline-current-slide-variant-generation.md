# ADR 0024: Inline Current Slide Variant Generation

## Status

Proposed implementation plan.

## Context

Slide Studio currently separates the selected slide editor from variant generation with tabs. The Current slide view holds the active preview, direct edits, selected slide context, and structured source. The Variant generation view holds workflow actions, candidate count, progress, candidate selection, compare, and apply.

That split keeps the UI organized, but it also separates generation from the object being edited. Authors have to switch away from the current slide surface to ask for alternatives, then switch mental context again to review candidates against the live slide. As Slide Studio gains more side controls such as Chat, Spec, Theme, and selection-scoped commands, the top-level tabs become less useful as a primary navigation model.

Variant generation is not a separate destination. It is an action taken on the current slide.

## Decision Direction

Integrate slide variant generation directly into the Current slide view.

The Current slide view should contain the active slide preview, direct edit controls, slide context, generation controls, candidate list, compare surface, and apply controls in one coherent workspace. Once this is implemented, the separate `Current slide` and `Variant generation` tabs can be removed.

This does not change the candidate lifecycle. Generated variants remain session-only proposals until the author explicitly applies one.

## Product Rules

- Variant generation should be visible from the Current slide view without switching tabs.
- Generation controls should stay near the current slide preview and selected slide context.
- Candidate review should use the same current-versus-candidate preview and diff model that exists today.
- Candidate lists should stay collapsed or compact when no candidates exist so the default view remains focused on the current slide.
- Running a generation action should not hide the current slide.
- Applying a candidate should remain explicit and server-controlled.
- Theme, layout, wording, structure, and family-changing candidates should keep their existing validation and apply boundaries.
- The UI should make it clear which slide a generation action targets, especially after navigation.
- Existing Chat, Spec, and future Theme side controls should remain side controls rather than top-level tabs.

## UI Shape

The Current slide view should become a single slide workbench:

- primary rendered slide preview
- direct structured edit controls
- selected slide context editor
- compact `Generate variants` section
- action selector for wording, structure, layout, theme, or other available slide actions
- candidate count control when relevant
- progress/status line while generation is running
- left-side variant rail with direct candidate selection when candidates exist
- compare panel that appears only when candidates exist
- explicit apply and discard/clear controls

The generation section should start behind a compact action so the default Current slide view remains focused on the selected slide. Once candidates exist, the left-side rail should switch from normal slide navigation to variant review. Candidate rows should use thumbnail-like cards so variant review feels like choosing between alternate versions of the current slide rather than leaving the workbench.

On narrow screens, the variant rail can collapse below the preview or into a bottom sheet. The active slide preview should remain visible during generation and review on every supported viewport.

## Resolved Interaction Direction

The initial implementation should answer the prior open questions this way:

- Generation starts behind a compact `Generate variants` action. After candidates are generated, the variant rail opens and remains visible until candidates are cleared or the author exits candidate review.
- Candidate rows live in a left-side rail on wide screens, replacing or sharing the space used by slide navigation while variant review is active. On narrow screens, candidates move below the preview or into a bottom sheet.
- Stale candidates clear on slide navigation for the first implementation. If the left rail replaces normal slide navigation, switching slides should be treated as an explicit exit from candidate review.
- Tab-specific focus behavior is replaced by one workbench order: slide rail or variant rail, active preview, generation controls, candidate review, compare/apply controls, then drawers. Any shortcut that previously opened the Variant generation tab should focus or open the inline variant rail.

## Tab Removal

After inline variant generation is implemented:

- remove the `Current slide` / `Variant generation` tab switcher
- remove tab-specific empty states and navigation state
- keep Chat and Spec as drawers or rails
- add Theme as a drawer or rail per ADR 0023
- keep any future auxiliary controls scoped as side controls unless they become primary workspace destinations

The resulting Slide Studio navigation model should be:

- selected slide selector
- main current-slide workbench
- optional side controls for Chat, Spec, Theme, and similar focused tools

## Server Behavior

No major server behavior should change. Existing operation endpoints can continue to produce session-only candidates, previews, diagnostics, and apply metadata.

The client should continue to send the selected slide id, action type, candidate count, relevant prompt/input fields, and any scope metadata such as selected text. The server remains responsible for:

- validating requested actions
- generating candidate slide specs or deck-theme patches
- rendering previews through the shared DOM runtime
- returning diagnostics and compare metadata
- applying selected candidates only through explicit apply endpoints

## Relationship To Existing ADRs

ADR 0002's pragmatic UI review direction supports keeping the active slide central and secondary controls inspectable.

ADR 0010's candidate-producing LLM workflow direction remains unchanged. Inline placement changes the user interaction model, not the generation contract.

ADR 0015's DOM-first rendering boundary remains unchanged. Current and candidate previews should still use the shared DOM runtime.

ADR 0022's selection-scoped chat command direction becomes easier to understand when selection, chat commands, and generated variants all target the visible current slide.

ADR 0023's post-creation theme control should use a side control, while slide-level variant generation should live inline in the current slide workbench.

## Validation

Add coverage for:

- Slide Studio opens to a single current-slide workbench without Current/Variant tabs
- generation controls are reachable from the Current slide view
- generating variants keeps the current slide preview visible
- candidate selection drives current-versus-candidate compare
- applying a candidate still requires explicit confirmation
- navigating to another slide clears or retargets inline candidate state predictably
- Chat and Spec drawers still work after tab removal
- keyboard focus order remains coherent without the tab switcher

## Migration Plan

1. Move generation controls into the Current slide view.
2. Keep the old tabs hidden behind a temporary compatibility flag only if needed during implementation.
3. Verify candidate generation, compare, apply, and clear flows from the unified workbench.
4. Remove tab state and tab-specific DOM after the inline flow is stable.
5. Update tests and demo copy that refer to the separate Variant generation tab.

## Non-Goals

- No change to candidate persistence rules.
- No direct model writes to slide files.
- No freeform visual editor.
- No removal of compare/apply review.
- No merging of deck-level planning into the current slide workbench.
- No requirement that Chat, Spec, or Theme become inline panels.
