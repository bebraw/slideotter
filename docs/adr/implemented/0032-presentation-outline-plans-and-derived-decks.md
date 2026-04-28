# ADR 0032: Presentation Outline Plans And Derived Decks

## Status

Implemented V1.

Implemented behavior includes presentation-scoped outline-plan storage, generation from existing decks, saving approved staged-creation outlines as plans, Deck Planning list/edit/duplicate/archive/delete actions, section-first comparison with slide-level detail, current-deck change candidates through the existing preview/apply boundary, derived decks with lineage, source/material copy choices, and live Slide Studio generation handoff from an outline plan.

Remaining polish includes field-level editing beyond the JSON editor and more precise source snippet/range attribution.

## Context

slideotter currently uses outlines primarily during new presentation creation. Authors generate and approve an outline before slide files are written. After that point, the outline becomes seed context rather than a durable planning artifact that can be revisited, compared, or reused.

That model is too narrow. Existing presentations often contain enough structure to infer multiple useful outlines:

- a short executive summary
- a longer workshop version
- a technical deep dive
- a sales narrative
- a teaching sequence
- a source-grounded evidence deck
- a reordered version for a different audience

At the same time, one approved outline can reasonably generate multiple presentations with different themes, target lengths, source scopes, detail levels, or audience assumptions.

This means a presentation should not have exactly one canonical outline. It should be able to have multiple reviewed outline plans, each representing a purposeful interpretation of the same content.

## Decision Direction

Add presentation outline plans as first-class, presentation-scoped artifacts.

An outline plan is a reviewed narrative plan that can be generated from an existing presentation, created during new deck creation, edited by the author, saved, compared, and used to derive new deck changes or new presentations.

Outline plans are not slide files and are not automatic writes. They are structured planning artifacts that require explicit approval before they create, reorder, skip, regenerate, or derive slides.

V1 should keep the model intentionally narrow:

- Outline plans are presentation-scoped. Cross-presentation sharing and a global outline library can follow after the presentation-scoped model proves useful.
- Plan comparison is section-first, with slide-level detail available inside each section.
- Plans store lightweight traceability pointers such as source ids, snippet ids or ranges, slide ids, and material ids rather than embedding full source payloads.
- Derived deck creation asks the author which context, sources, materials, and theme values to copy or reference. The default should copy selected deck context and theme values, reference existing source records where possible, and ask before copying bulky materials.
- V1 outline plans are linear. The schema should avoid blocking future graph-style or two-dimensional presentation paths, but branching paths are outside this ADR's first implementation slice.

## Product Rules

- A presentation may have multiple outline plans.
- An outline plan must carry purpose metadata such as target audience, target length, objective, tone, source scope, and intended use.
- Existing presentations can generate outline plan candidates from current slides, deck context, sources, and materials.
- New presentation creation can save its approved outline as an outline plan.
- An approved outline plan can derive a new presentation.
- An approved outline plan can propose changes to the current presentation, but those changes remain candidates until explicitly applied.
- Outline plans should be editable before use.
- Outline plans should preserve traceability to the source presentation and generation inputs when created from an existing deck.
- Deleting or editing an outline plan must not mutate existing slides by itself.
- A generated outline should be treated as an interpretation of the deck, not as canonical truth.

## Outline Plan Shape

The exact schema can evolve, but an outline plan should include:

```json
{
  "id": "outline-plan-id",
  "name": "Executive summary",
  "sourcePresentationId": "presentation-id",
  "purpose": "Five-minute executive overview",
  "audience": "Leadership team",
  "targetSlideCount": 6,
  "tone": "Direct and practical",
  "sourceScope": {
    "slides": ["slide-01", "slide-02"],
    "sources": ["source-01"],
    "materials": []
  },
  "traceability": [
    {
      "kind": "source-snippet",
      "sourceId": "source-01",
      "snippetId": "snippet-03"
    }
  ],
  "sections": [
    {
      "title": "Problem",
      "intent": "Establish the decision context",
      "slides": [
        {
          "workingTitle": "Why this matters now",
          "intent": "Frame urgency",
          "mustInclude": ["Current pain", "Decision deadline"],
          "layoutHint": "Simple title plus two evidence points"
        }
      ]
    }
  ]
}
```

Plans should prefer intent, required content, evidence pointers, and layout hints over fully drafted visible slide copy. Slide text still belongs to generated or edited slide specs.

Traceability should be pointer-based. An outline plan can refer to source snippets, slide ids, or material ids that influenced a section or slide intent, but it should not duplicate source documents or large excerpts into the plan JSON.

## Derived Decks

Derived decks are new presentations created from an approved outline plan.

Creating a derived deck should:

- copy or reference the approved outline plan
- record the source presentation id
- copy selected deck context, sources, materials, and theme values according to user choice
- generate slides through the normal server-owned generation path
- use Slide Studio live generation from ADR 0031
- keep the original presentation unchanged

Derived decks should make lineage visible enough that authors understand where the deck came from, but lineage metadata should not leak into slide-visible content unless explicitly requested.

## Current Deck Changes

An outline plan can also drive current-presentation changes, but only through candidates.

Examples:

- scale the current deck to a new target length
- reorder sections
- insert missing transition slides
- split one dense slide into several slides
- collapse several slides into a summary slide
- propose a different narrative path for the same material

These changes should use the existing preview, compare, and apply boundary. The plan can generate candidates; it must not directly rewrite the deck.

## UI Shape

Outline plans should live near Deck Planning and staged creation, not inside individual slide editing.

Expected surfaces:

- **Generate outline from current deck** action
- outline plan list for the active presentation
- plan metadata fields for audience, target length, objective, tone, and source scope
- editable section and slide-intent outline
- section-first comparison between current slide order and proposed plan, with slide-level detail available inside each section
- actions to derive a new presentation, propose changes to current deck, duplicate a plan, archive a plan, or delete a plan

The UI should avoid implying there is one true outline. Labels should use "Plan", "Outline plan", or a user-supplied plan name rather than "The outline".

## Relationship To Existing ADRs

ADR 0004's staged creation flow already depends on outline approval. This ADR generalizes outlines into reusable planning artifacts.

ADR 0016's reversible deck-length scaling can use outline plans as a richer semantic input for keep, skip, restore, and insert decisions.

ADR 0017's source-grounded generation remains relevant because generated outline plans should cite or reference the source snippets that shaped the plan when possible.

ADR 0028's token-efficient generation direction applies strongly: outline generation from an existing deck should use compact slide inventories, deck context summaries, and scoped source packs rather than full rendered slide text by default.

ADR 0031's live Slide Studio creation gives derived decks a coherent generation surface after an outline plan is approved.

## Server Behavior

The server should own:

- outline plan storage under the active presentation
- outline candidate generation from slides, context, sources, and materials
- validation of outline plan shape
- derivation of new presentations from approved plans
- current-deck candidate generation from approved plans
- lineage metadata and source-scope preservation
- apply boundaries for any deck mutation

Outline plans should be stored as structured JSON, not markdown blobs.

## Validation

Add coverage for:

- generating an outline plan from an existing presentation
- saving multiple outline plans for one presentation
- editing plan metadata and slide intent fields
- deriving a new presentation without mutating the source presentation
- proposing current-deck changes from a plan without direct writes
- preserving source presentation lineage on derived decks
- keeping outline plan storage presentation-scoped
- rejecting malformed plans before they can generate or apply changes
- ensuring prompt assembly uses compact deck inventories rather than unbounded full-slide payloads

## Migration Plan

1. Define the outline plan schema and storage location.
2. Save new-creation approved outlines as outline plans.
3. Add outline-plan listing and editing in Deck Planning.
4. Add generation of outline plan candidates from the current deck.
5. Add derived-deck creation from an approved outline plan.
6. Add current-deck candidate generation from an approved outline plan.
7. Connect plan-driven derived deck generation to ADR 0031's live Slide Studio handoff.

## Non-Goals

- No automatic canonical outline for every presentation.
- No direct slide writes from generated outline text.
- No replacement of slide specs as the source content model.
- No requirement that every deck change begin from an outline plan.
- No hidden mutation of source presentations when derived decks are created.
- No global outline library before presentation-scoped plans prove useful.
- No branching or graph-style outline paths in V1.
