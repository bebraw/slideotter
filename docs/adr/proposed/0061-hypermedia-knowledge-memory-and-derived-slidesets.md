# ADR 0061: Hypermedia Knowledge Memory And Derived Slidesets

## Status

Proposed implementation plan.

## Context

Slideotter already treats presentations as structured, reviewable workspaces rather than one-shot generated files. The current studio has presentation-scoped deck context, sources, materials, outline flows, variants, derived decks, deck-length scaling, two-dimensional detours, validation, and a hypermedia `/api/v1` surface with links, actions, input schemas, audiences, and base-version checks.

That model works well for editing one active deck, but repeated authoring work often starts from a more durable body of knowledge than a single slideset:

- a set of claims and supporting evidence
- audience assumptions and speaker intent
- preferred tone, style, and visual language
- review feedback and editorial decisions
- examples, definitions, and reusable explanations
- prior talks, papers, courses, and derived decks

Different talks may use the same knowledge at different lengths or with different framing. A five-minute pitch, a twenty-minute conference talk, a forty-five-minute lecture, an executive briefing, a technical appendix, and a narrated self-study version can all be valid projections of the same underlying information.

Today those relationships are mostly implicit in prompts, slide specs, outline flows, or source snippets. That makes reuse possible but not inspectable. It also makes it harder for a local or headless agent to answer practical questions such as:

- Which slides depend on this claim?
- Which sources support this argument?
- What shorter version should preserve the central thesis?
- Which prior deck already used this framing?
- What style or audience assumptions should this derived deck inherit?

The existing hypermedia API from ADR 0013 is the right control surface for this problem. The missing piece is a durable knowledge-memory layer that exposes typed memory resources, provenance links, and allowed actions without replacing the existing presentation, slide, source, material, candidate, and validation model.

## Decision Direction

Add a hypermedia knowledge-memory layer above individual slidesets.

Knowledge resources should become canonical memory. Slides should remain editorial projections. Decks should remain ordered delivery forms. Variants should remain alternative framings. Deck lengths should be treated as compression levels over the same or related knowledge.

The first implementation should stay presentation-scoped and local-first. It should add typed memory resources under the existing presentation state boundary and expose them through `/api/v1` as hypermedia resources. Cross-presentation or workspace-level memory can follow after the presentation-scoped model proves useful.

This layer should not become a freeform graph editor or a hidden vector store. It should be an inspectable authoring substrate with typed resources, evidence, links, and explicit actions that generate proposals, update memory, retire stale items, or derive slidesets through the same preview, compare, apply, and validate workflow used elsewhere in Slideotter.

## Product Rules

- Knowledge resources are canonical; slidesets are projections.
- Slideset derivation must produce reviewable outline or slide candidates before writing deck files.
- Memory updates must go through server-controlled actions, not direct client or agent file mutation.
- Memory resources should link to evidence such as sources, slides, prior decks, assistant messages, validation findings, and user decisions.
- Memory resources should carry status and freshness metadata so stale or rejected claims are not silently reused.
- Generated slides should cite or preserve memory provenance in internal metadata before adding visible citations.
- Retrieval should use semantic or keyword search to find likely memory resources, then hypermedia links to navigate and act on canonical resources.
- Local models should receive compact, typed memory snippets instead of raw project history dumps.
- Cross-deck reuse should preserve the current guarded model: generate, inspect, compare, apply, validate.
- The core should avoid a general RDF/SPARQL dependency in the first slice; graph export or richer query support can come later if real workflows need it.

## Resource Model

Initial memory resources should be narrow and presentation-authoring specific:

- **Claim**: a reusable assertion, thesis point, or argument.
- **Evidence**: a source-backed support item that can link to source records, excerpts, URLs, or materials.
- **Concept**: a definition, explanation, or reusable teaching unit.
- **Audience assumption**: a belief about what the audience knows, cares about, or needs.
- **Style note**: tone, visual language, copy style, narration style, or deck-level presentation preference.
- **Decision**: an accepted editorial, structural, sourcing, or design choice.
- **Review note**: feedback attached to a slide, candidate, deck, claim, or validation finding.

A memory item should include:

```json
{
  "id": "claim-hypermedia-memory",
  "type": "claim",
  "summary": "Persistent agent memory should be an inspectable hypermedia space of typed memories, evidence, and affordances.",
  "status": "accepted",
  "confidence": "medium",
  "createdAt": "2026-06-11T00:00:00.000Z",
  "updatedAt": "2026-06-11T00:00:00.000Z",
  "tags": ["agents", "hypermedia", "memory"],
  "evidence": [
    {
      "rel": "source",
      "href": "/api/v1/sources/source-123"
    }
  ],
  "usedBy": [
    {
      "rel": "slide",
      "href": "/api/v1/presentations/future-frontend/slides/slide-12"
    }
  ]
}
```

The public resource should add hypermedia links and actions:

```json
{
  "resource": "memoryItem",
  "id": "claim-hypermedia-memory",
  "state": {
    "type": "claim",
    "status": "accepted",
    "baseVersion": "..."
  },
  "links": {
    "self": { "href": "/api/v1/presentations/future-frontend/memory/claim-hypermedia-memory" },
    "presentation": { "href": "/api/v1/presentations/future-frontend" },
    "evidence": { "href": "/api/v1/presentations/future-frontend/memory/claim-hypermedia-memory/evidence" },
    "dependentSlides": { "href": "/api/v1/presentations/future-frontend/memory/claim-hypermedia-memory/dependent-slides" }
  },
  "actions": [
    {
      "id": "derive-slide-from-memory",
      "method": "POST",
      "href": "/api/v1/presentations/future-frontend/memory/claim-hypermedia-memory/derive-slide",
      "effect": "candidate",
      "scope": "memory",
      "input": "deriveSlideFromMemoryRequest"
    },
    {
      "id": "retire-memory-item",
      "method": "POST",
      "href": "/api/v1/presentations/future-frontend/memory/claim-hypermedia-memory/retire",
      "effect": "write",
      "scope": "memory",
      "input": "memoryStatusUpdateRequest"
    }
  ]
}
```

## Derived Slidesets

Derived slidesets should be explicit resources, not just copied decks.

An outline flow or derived deck should record:

- source presentation or memory collection
- selected claims, concepts, sources, materials, and style notes
- target length and information density
- audience and purpose
- inherited theme or visual language
- generation base versions
- lineage to prior decks or flows

Useful derivation actions:

- create a shorter version from selected memory resources
- create a longer teaching version with definitions and examples
- create an executive version with claims but fewer implementation details
- create a technical version that preserves evidence and caveats
- derive a narrated self-study version from an existing deck plus speaker notes
- derive a deck from claims in one presentation and sources from another
- find existing slides that already cover a claim or concept

Derived decks should continue to use the staged outline and live drafting model from ADR 0004, ADR 0031, and ADR 0032. The derivation action should create or update an outline proposal first; slide files should only be written after explicit approval.

## Retrieval And Local Models

Memory retrieval should combine search and hypermedia navigation.

Search answers "what might be relevant?" Hypermedia answers "what is this resource, what is it linked to, and what actions are valid now?"

The first slice can use the same lightweight keyword retrieval style already used for presentation sources. Later slices can add embeddings or ranking controls if real decks show retrieval misses.

Prompt construction should treat memory as another bounded context provider:

```txt
deck context
source snippets
material metadata
memory snippets
target slide or outline intent
```

Local models should receive compact summaries, statuses, tags, and provenance links rather than long raw histories. A deterministic routing layer can choose likely memory resources before the model sees them, keeping local-model navigation small and reliable.

## Relationship To Existing ADRs

ADR 0013 provides the hypermedia API model. Memory resources should use the same `resource`, `state`, `links`, `actions`, input-schema, audience, and base-version conventions.

ADR 0017 provides source-grounded generation. Memory should link to sources and retrieve bounded evidence snippets rather than replacing source records.

ADR 0028 provides token-efficient generation. Memory prompts should stay scoped, measured, and compact.

ADR 0032 provides reusable outline flows and derived decks. Hypermedia memory should make those derivations traceable to claims, evidence, concepts, style notes, and audience assumptions.

ADR 0050 provides visible-text quarantine. Memory-derived generation must still pass through leak and visible-text quality checks before preview or apply.

ADR 0055 provides agent-command mode. Agent workflows should use advertised memory actions rather than editing memory JSON or slide files directly.

ADR 0020 can later let plugins contribute memory resource types, external knowledge importers, or domain-specific validators after the core memory contract stabilizes.

## Storage

The first local implementation should store presentation-scoped memory under:

```txt
presentations/<id>/state/memory.json
```

The store should remain small and structured:

```json
{
  "items": [],
  "links": [],
  "derivedSets": []
}
```

Large source text, image files, generated artifacts, and full assistant conversations should stay in their existing stores. Memory resources should link to them rather than duplicating large content.

Cross-presentation memory can later live in the user data root or cloud workspace state. Portable deck bundles should include only memory items needed to understand or regenerate that deck unless the user explicitly exports a larger knowledge pack.

## API Shape

Add stable relation names:

- presentation: `memory`, `claims`, `concepts`, `styleNotes`, `derivedSlidesets`
- memory collection: `self`, `presentation`, `items`, `search`, `derivedSlidesets`
- memory item: `self`, `presentation`, `evidence`, `dependentSlides`, `derivedSlidesets`, `related`
- derived slideset: `self`, `sourceMemory`, `sourcePresentation`, `outline`, `preview`, `result`

Initial actions:

- `create-memory-item`
- `update-memory-item`
- `retire-memory-item`
- `link-memory-evidence`
- `search-memory`
- `derive-outline-from-memory`
- `derive-slide-from-memory`
- `find-dependent-slides`
- `create-derived-slideset`

Action availability should be state-aware. For example, a retired memory item should not advertise derivation actions by default, and stale base versions should be rejected like other write/apply actions.

## Validation

Coverage should include:

- memory store schema normalization
- hypermedia resource shape for memory collections and memory items
- base-version enforcement on memory writes
- stale, retired, and rejected memory status behavior
- evidence links to sources, slides, materials, candidates, and derived decks
- bounded memory retrieval for deck planning and slide generation
- derived outline proposals that preserve target length, audience, and selected memory provenance
- derived deck lineage metadata
- generated slide candidates that carry memory provenance through preview, compare, apply, and validation
- prompt-leak and visible-text quarantine coverage for memory-derived generation

## Implementation Plan

1. Add presentation-scoped memory storage.
   Create normalization, read, write, and version helpers for `state/memory.json`.

2. Add hypermedia memory resources.
   Expose memory collection, memory item, and derived-slideset resources through `/api/v1`.

3. Add manual memory authoring actions.
   Let users create, update, retire, and link memory items without generation.

4. Add memory retrieval to deck planning and slide workflows.
   Keep retrieval bounded and inspectable in diagnostics.

5. Add derived outline actions.
   Generate outline proposals from selected memory items, target length, density, audience, and style notes.

6. Add derived deck lineage.
   Persist source memory ids, base versions, and derivation settings with new flows and decks.

7. Add dependency inspection.
   Show which slides, decks, and candidates use a memory item before editing or retiring it.

8. Consider cross-presentation memory.
   Promote reusable items to user-level or workspace-level memory only after presentation-scoped workflows are useful.

## Non-Goals

- No general-purpose personal memory system in the first slice.
- No RDF, SPARQL, or ontology dependency in core.
- No automatic silent deck rewrites when memory changes.
- No direct agent writes to memory or slide files.
- No unbounded raw chat-history injection into prompts.
- No visual graph editor before the typed resource and action model proves useful.

## Open Questions

- Should the first UI surface live in the Outline drawer, Debug drawer, or a new compact Memory drawer?
- Which memory types are essential for the first slice: claims, evidence, style notes, or audience assumptions?
- Should memory search start keyword-only like sources, or should embeddings be added at the same time?
- How much memory should be included in portable deck exports by default?
- Should cross-presentation memory be user-global, workspace-scoped, or explicitly packaged as reusable knowledge packs?
