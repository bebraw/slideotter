# ADR 0008: Two-Dimensional Presentations

## Status

Proposed implementation plan.

## Context

Linear decks force every supporting idea into the same sequence as the core narrative. That makes authors choose between two weak options:

- keep the main path tight and lose useful detail
- include every detail and make the live presentation too long or too rigid

slideotter already has semantic deck-planning ideas: slides have intent, deck growth can add related detail, skipped slides can be restored, and staged creation can reason about structure before materializing slides. Two-dimensional presentations extend that model by letting a deck contain optional deeper paths attached to core slides.

The presentation view proposed in ADR 0007 gives this a natural interaction model. The main presentation advances horizontally. Deeper material for the current topic lives vertically below the anchor slide and can be entered with up/down navigation when the presenter wants a detour.

## Decision

Support two-dimensional presentations as a structured deck model.

A two-dimensional presentation has:

- a primary horizontal path containing the core slides and ideas
- optional vertical detours attached to individual core slides
- deterministic navigation between core slides and detour slides
- the same DOM rendering path for all slides
- semantic metadata that explains why each detour exists and which core slide it supports

In presentation mode, horizontal navigation moves through the core path. Vertical navigation enters or exits deeper material for the current topic. The expected mental model is:

- right/left: continue or rewind the main story
- down: go deeper on this slide's topic
- up: return toward the core slide

Additional slides are assumed to live below the core path unless a future feature introduces other branch directions.

## Deck Model

The model should stay structured and explicit. A deck should not rely on filename ordering alone once it supports two-dimensional structure.

The first version can represent the structure with a deck-level navigation graph, for example:

```json
{
  "slides": [
    {
      "id": "slide-07",
      "path": ["core", 6]
    },
    {
      "id": "slide-07-detail-01",
      "path": ["core", 6, "detour", 0],
      "parentId": "slide-07",
      "detourLabel": "Implementation detail"
    }
  ]
}
```

The exact storage shape can change, but it should preserve these concepts:

- stable slide ids
- core-path order
- parent slide id for each detour
- detour order under the parent
- short semantic label or reason for each detour
- whether a slide participates in the default linear export path

Detours are still normal structured slides. They should use the same slide-spec schemas, material library, theme, renderer, validation, and export machinery as core slides.

## Presentation Navigation

Presentation mode should support two axes:

- `ArrowRight`, `PageDown`, and `Space` move to the next core slide by default
- `ArrowLeft` and `PageUp` move to the previous core slide by default
- `ArrowDown` enters the first detour under the current core slide, or advances deeper within the current detour stack
- `ArrowUp` moves back toward the parent core slide

When a presenter is inside a detour stack:

- right/left should move between adjacent core slides only after returning to the core path, unless the UI later introduces an explicit branch navigation model
- up should climb toward the parent slide
- down should continue through deeper slides if they exist

Navigation should clamp at boundaries. It should not wrap from the last core slide to the first or from the deepest detour back to the parent without an explicit key press.

## Studio Authoring Rules

The studio should make the main path and detours visibly distinct.

The first authoring slice can stay modest:

- show whether a slide is on the core path or a detour
- let authors add a detour slide under the current core slide
- let authors promote a detour slide into the core path
- let authors demote a core slide into a detour under a nearby core slide
- show detour labels in outline or deck-planning views

The authoring UI should avoid making the normal slide list unreadable. A compact tree, two-dimensional mini-map, or grouped outline is preferable to flattening all detours into the same list without context.

## Semantic Generation

Two-dimensional structure should build on slideotter's semantic planning behavior.

Generation and deck growth may propose detours when:

- the core story is already coherent
- the user asks for optional depth, appendix-like material, examples, implementation details, evidence, or alternate explanations
- a topic has clear supporting material that would slow the main path
- the presenter may need to adapt to different audiences or time constraints

Generation should keep the core path concise. It should not hide essential narrative steps in detours. A viewer who only follows the horizontal path should still understand the presentation.

## Export And Compatibility

The first implementation should keep existing PDF export behavior simple.

Recommended default:

- export the core path by default
- optionally include detours after their parent slide when an export option asks for the full deck

Browser presentation mode is the primary surface for two-dimensional navigation. PDF export does not need to preserve the two-dimensional interaction model in the first version.

Existing one-dimensional decks remain valid. A deck with no detours is simply a two-dimensional deck with only the core path.

## Validation

Validation should cover both structure and rendered output:

- every detour has a valid parent core slide
- core-path order is deterministic
- detour order under each parent is deterministic
- skipped slides do not create broken navigation edges
- presentation mode can navigate right/left across the core path
- presentation mode can navigate down/up for at least one detour stack
- rendered detour slides use the same text, media, geometry, and contrast checks as normal slides

## Non-Goals

- no arbitrary graph navigation in the first version
- no radial, zooming, or canvas-based presentation surface
- no nested detours beyond a simple vertical stack unless the schema explicitly proves it is needed
- no requirement for PDF export to preserve two-dimensional navigation
- no speaker notes or presenter console dependency
- no remote audience navigation or synchronized multi-device control

## Implementation Plan

1. Add deck-structure metadata.
   Introduce a deck-level model that can identify core slides and detour slides without relying only on filename order.

2. Update deck planning and outline views.
   Show the core path plus grouped detours. Keep the core narrative easy to scan.

3. Add manual detour creation.
   Let authors add a slide below the current core slide with a short label and intent.

4. Extend presentation mode navigation.
   Add up/down navigation for detour stacks while keeping left/right focused on the core story.

5. Teach semantic growth about detours.
   Let deck growth propose optional deeper slides below an existing core slide instead of always inserting into the main path.

6. Update export options.
   Keep core-only export as the default. Add an explicit full export option that includes detours after their parent slides.

7. Add fixtures.
   Add at least one deck fixture with a core path and one detour stack. Validate structure, presentation navigation, and export order.

## Open Questions

- Should the first schema allow only one vertical detour stack per core slide, or named multiple stacks under the same core slide?
- Should current slide position in presentation mode be represented as coordinates, such as `x=6&y=1`, in the URL?
- Should semantic deck growth prefer detours over core insertion when the target slide count grows beyond the approved outline?
- How should skipped slides interact with detours when a parent core slide is skipped?
