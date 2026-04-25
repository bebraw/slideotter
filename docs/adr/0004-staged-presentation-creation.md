# ADR 0004: Staged Presentation Creation

## Status

Accepted for staged creation implementation.

## Context

The current new-presentation flow asks for deck brief, target length, generation mode, font, palette, theme brief, sources, starter image, and image search in one form before the user has seen enough feedback to know which choices matter. That makes creation feel heavy and front-loaded. It also couples theme exploration to deck creation even though theme work has its own preview loop and should often happen before or after content planning.

The studio already has clear boundaries that can support a staged flow:

- presentation registry and active runtime selection
- deck context, sources, materials, and theme stored with the presentation
- structured initial slide generation
- slide, structure, wording, theme, and layout candidates that remain proposals until applied
- DOM preview and validation as the shared feedback surface

## Decision Direction

Split presentation creation into separate, resumable stages. Each stage should have one primary decision, a preview or summary, and an explicit continue/apply action.

1. Brief
   Capture the minimum viable deck intent: title, audience, objective, tone, target slide count, language, and hard constraints. Keep sources and visual styling out of the first step unless the user deliberately opens them. For broad fields such as constraints, opinions, sourcing, and style, prefer a compact `?` help affordance with concrete examples over permanent explanatory copy in the form.

2. Structure
   Generate or draft a proposed outline before generating full slide specs. Show editable deck thesis, narrative arc, slide titles, and slide-level intent/source/visual guidance so the user can correct wording in place before approval. Let users attach source notes to specific outline beats when evidence belongs to one slide or section rather than the whole deck, and keep a compact source outline visible for fast review. The user must approve the outline before content materialization; approval starts slide drafting from the locked outline snapshot so the Outline -> Slide Studio transition matches the Brief -> Outline generation pattern. The user can keep regenerating or editing the outline before approval if the generated structure does not read right.
   Outline regeneration is lock-aware. Users can mark good outline slides to keep, regenerate the unlocked outline around them, or regenerate one slide at a time when only one beat is weak. Locked slides keep their position and wording during full regeneration.
   Generation uses a snapshot of the brief. Brief, source, and sourcing controls are locked while generation is running. If the user changes generation-relevant inputs after an outline exists, the outline is marked stale, approval is cleared, and slide creation stays disabled until the outline is regenerated.

3. Content Draft
   Materialize structured slide specs automatically after outline approval, drafting one approved outline slide at a time. Per-slide drafting gives the user a clearer sense of progress and lets the server persist partial slide specs as each one succeeds instead of losing the whole deck when a later slide fails. When drafting completes, move the author into the flow's Theme stage so the generated slides can be styled against real content before deeper slide editing. Keep the generated deck editable through the existing slide and deck workflows.

4. Theme
   Move visual theme creation into its own workbench after content has been generated. Theme exploration is most useful against real draft slides. It should preview theme candidates against a live DOM-rendered slide before applying them to deck context. The first implementation stays inside the staged creation flow: authors can choose a saved favorite, try local theme variants against one generated slide, adjust the active palette/font, apply the theme to the generated deck, or save the adjusted theme as a reusable favorite.

5. Materials And Sources
   Treat sources, uploaded images, image search, and sourcing style as optional enrichments inside the Brief and Structure stages instead of a separate creation tab. The flow should make it clear when generation used saved sources or materials. Sourcing should be configurable, including compact numbered references that point to reference details at the end of the deck.
   If an outline used no source snippets, the outline review stage should offer local source, image, and image-search inputs so the user can add material and regenerate without moving to another stage.

## Theme Workbench

Theme creation should become a separate system rather than another field group in the creation form.

- Start from current deck theme, a text brief, or a small set of palette/font presets.
- Preview candidates on several slide families, not only the selected slide.
- Support "apply to deck", "save as candidate", and "discard" actions.
- Let users save favorite themes and reuse themes from earlier decks.
- Enforce WCAG-oriented contrast guardrails in theme normalization: text-like colors should meet AA contrast against the slide background, and progress fill should remain distinguishable from its track.
- Keep theme candidates session-only until applied, matching existing variant behavior.
- Do not require theme work before content exists in the first implementation; add a standalone theme playground later if usage shows the need.

## Staged UX Sketch

The first screen should still be the actual creation tool, not a marketing page.

- Left rail or compact stepper: Brief, Structure, Theme.
- Treat the stepper as a flow indicator with locked future stages, not as free tab navigation.
- Main panel: only the fields and controls for the active stage.
- Right or lower preview: outline summary, representative slide preview, or theme preview depending on stage.
- Primary action changes by stage: "Generate outline", "Approve and create slides", "Apply theme".
- Secondary actions stay explicit: regenerate, edit manually, back, skip for now.

## Implementation Plan

1. Introduce a presentation-creation draft model.
   Store in ignored runtime state with safe defaults for title, language, target length, sourcing style, approved outline, and theme. The draft should survive server restarts without dirtying git. Do not write a presentation folder until the user creates the deck.

2. Split the current create form into a Brief stage.
   Keep existing server create behavior behind the final create action so the first UI slice can reuse the current endpoint.

3. Add an outline-only generation endpoint.
   Return deck-level structure candidates without writing slide files. Reuse existing deck-plan candidate rendering where possible.

4. Add automatic content drafting after outline approval.
   Materialize slides from the approved outline and existing brief immediately after approval. Draft slides sequentially from the locked outline snapshot, publish per-slide progress, and write the accumulated slide set after each successful slide so partial work is recoverable. This replaces the current immediate "create and generate everything" path while avoiding a second confirmation step after the outline has already been accepted.

5. Extract Theme into a workbench.
   Reuse visual theme candidate generation and compare/apply behavior, but make previews multi-slide and accessible outside the selected-slide variant tab.

6. Integrate optional sources and materials into outline enrichment.
   Let the user add source text, slide-specific source notes, uploaded images, and image search hints from the outline review stage before approval creates the deck.

7. Add lock-aware outline refinement.
   Let authors keep strong outline slides during full regeneration and regenerate one weak outline slide without discarding the rest of the structure. Field-level regeneration can build on the same mechanism later if slide-level refinement still leaves too much manual cleanup.

8. Add browser workflow coverage.
   Validate that a user can create a deck through the staged path, skip theme, add a source, preview an outline, materialize slides, and clean up the deck.

## Open Questions

- Resolved: outline approval is required, with a path back to outline definition before slide creation.
- Resolved: first implementation does theme work after content generation, with saved favorites for reuse.
- Resolved: source grounding should be configurable, with compact references as the default space-saving mode.
- Resolved: staged creation drafts should survive server restarts in ignored runtime state.
