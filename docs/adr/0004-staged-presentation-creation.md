# ADR 0004: Staged Presentation Creation

## Status

Proposed.

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
   Capture the minimum viable deck intent: title, audience, objective, tone, target slide count, language, and hard constraints. Keep sources and visual styling out of the first step unless the user deliberately opens them.

2. Structure
   Generate or draft a proposed outline before generating full slide specs. Show slide titles, roles, and one-line intent per slide. Let the user accept, edit, reorder, remove, or ask for another outline. This stage should use deck-level candidates rather than immediately writing a complete slide set.

3. Content Draft
   Materialize structured slide specs from the accepted outline. Show a compact deck preview and the first slide in Slide Studio. Keep the generated deck editable through the existing slide and deck workflows.

4. Theme
   Move visual theme creation into its own workbench. The workbench can be entered during creation, from Deck Planning, or from Slide Studio. It should preview theme candidates against representative slides before applying them to deck context.

5. Materials And Sources
   Treat sources, uploaded images, and image search as optional enrichments that can be added before structure generation or after content draft. The flow should make it clear when generation used saved sources or materials.

## Theme Workbench

Theme creation should become a separate system rather than another field group in the creation form.

- Start from current deck theme, a text brief, or a small set of palette/font presets.
- Preview candidates on several slide families, not only the selected slide.
- Support "apply to deck", "save as candidate", and "discard" actions.
- Keep theme candidates session-only until applied, matching existing variant behavior.
- Eventually allow creating a theme before a presentation exists by storing a temporary theme draft in ignored runtime state, then applying it during presentation creation.

## Staged UX Sketch

The first screen should still be the actual creation tool, not a marketing page.

- Left rail or compact stepper: Brief, Structure, Content, Theme, Sources.
- Main panel: only the fields and controls for the active stage.
- Right or lower preview: outline summary, representative slide preview, or theme preview depending on stage.
- Primary action changes by stage: "Generate outline", "Accept outline", "Create slides", "Apply theme".
- Secondary actions stay explicit: regenerate, edit manually, back, skip for now.

## Implementation Plan

1. Introduce a presentation-creation draft model.
   Store in ignored runtime state first, with safe defaults for title, language, target length, and theme. Do not write a presentation folder until the user creates the deck.

2. Split the current create form into a Brief stage.
   Keep existing server create behavior behind the final create action so the first UI slice can reuse the current endpoint.

3. Add an outline-only generation endpoint.
   Return deck-level structure candidates without writing slide files. Reuse existing deck-plan candidate rendering where possible.

4. Add a Content Draft stage.
   Materialize slides from the accepted outline and existing brief. This replaces the current immediate "create and generate everything" path.

5. Extract Theme into a workbench.
   Reuse visual theme candidate generation and compare/apply behavior, but make previews multi-slide and accessible outside the selected-slide variant tab.

6. Move optional sources and materials into their own enrichment stage.
   Let the user add them before outline generation, before content drafting, or after the deck exists.

7. Add browser workflow coverage.
   Validate that a user can create a deck through the staged path, skip theme, add a source, preview an outline, materialize slides, and clean up the deck.

## Open Questions

- Should outline approval be required, or should "Create slides" be available immediately after one outline is generated?
- Should theme work be available before any presentation exists, or only after a draft deck exists?
- Should source-grounded outline generation visibly cite source snippets before slide materialization?
- Should a staged creation draft survive server restarts, or is browser/session runtime enough at first?
