# ADR 0062: Dedicated Memory Workbench

## Status

Implemented baseline.

## Context

ADR 0061 introduced presentation-scoped hypermedia memory: typed claims, evidence, concepts, audience assumptions, style notes, decisions, review notes, dependent-slide links, search, and derived-slideset lineage. The implemented Studio surface is intentionally compact. It lets authors inspect and edit memory without making memory the dominant authoring mode.

That compact drawer is enough for the first baseline, but it is not enough for serious memory work. Once memory becomes part of how decks are planned, shortened, expanded, refined, and reused, authors need a dedicated view where they can understand and manipulate the knowledge layer directly:

- see which claims, concepts, evidence, and decisions exist
- see which slides depend on a memory item
- see which memory items lack evidence or are stale
- connect evidence, sources, slides, materials, and derived decks
- retire or revise items without losing provenance
- derive outline or slide candidates from selected memory
- compare alternative framings over the same knowledge

The important boundary still holds: memory is canonical knowledge, while slides are editorial projections. A dedicated view should make that relationship visible, not replace the guarded slide workflow.

## Decision Direction

Add a dedicated Memory workbench as a first-class Studio view.

The Memory workbench should visualize and manipulate presentation-scoped memory resources through the same server-owned, version-checked API model used elsewhere in slideotter. It should make claims, evidence, concepts, audience assumptions, style notes, decisions, review notes, dependent slides, and derived slidesets easier to inspect and maintain.

The first implementation should stay presentation-scoped. It should build on ADR 0061's existing memory store and `/api/v1` resources rather than introducing a second memory model. Cross-presentation or workspace-level memory can follow after the dedicated view proves useful for one deck.

The implemented baseline adds a dedicated Memory page, structured filters, summary counters, create and retire actions, selected-item detail, a grouped dependency map, memory maintenance warnings, derived-deck comparison summaries, and memory authoring findings in the presentation check report. The dependency map should read as a graph-like column view, not a freeform force-directed graph: authors need to trace `memory -> evidence -> slides -> derived decks` quickly and act on individual relationships. Deeper manipulation actions such as restore, merge, evidence suggestion, explicit slide-link editing, selected-memory outline derivation, affected-slide update proposals, and an optional node-link graph remain future slices.

## Product Rules

- Memory gets its own Studio view, separate from the compact drawer.
- The compact drawer remains useful for quick current-slide context.
- The dedicated view must use server-owned memory actions, not direct JSON file writes.
- Memory edits require base-version checks.
- Memory-derived deck or slide changes produce candidates or outline proposals before slide files change.
- Visual graph interactions must preserve typed resources and relationships.
- Retiring a memory item should not delete provenance or dependent-slide history.
- Evidence gaps, stale claims, and orphaned memory should be visible as maintenance states.
- Slide dependencies should be navigable from memory to slide preview and from slide to memory.
- The view should not become a general mind-mapping canvas or arbitrary graph database UI.

## Workbench Shape

The Memory workbench should have three coordinated surfaces:

1. A structured item browser.
   Filter by type, status, tag, confidence, evidence state, freshness, and dependent-slide count. Support create, edit, retire, restore, tag, and link actions.

2. A relationship visualization.
   Show typed links among memory items, sources, evidence, slides, materials, outline flows, and derived slidesets. The first visualization should be a structured dependency map with stable columns and direct actions; dependency tracing and gap finding matter more than decorative graph layout.

3. A detail and action panel.
   Show the selected item's summary, evidence, dependent slides, related items, version metadata, and available actions. Candidate-producing actions should include derive outline, derive slide, suggest evidence, suggest merge, and propose affected-slide updates.

The current slide preview can be available as a linked side panel or quick navigation target, but it should not dominate the memory view.

## Core Workflows

### Maintain Memory

Authors should be able to:

- create a claim, concept, style note, decision, audience assumption, or review note
- edit summaries, status, confidence, tags, and notes
- link evidence from presentation sources, excerpts, URLs, materials, or slides
- retire stale or rejected items while preserving dependency history
- merge duplicate memory items through a reviewed operation

### Trace Dependencies

Authors should be able to:

- select a claim and see dependent slides
- select a slide and see memory items it uses
- find slides that depend on stale or low-confidence memory
- find accepted claims without evidence
- find memory items that are not used by any slide or derived deck

### Generate From Memory

Memory-based generation should stay proposal-oriented:

- selected memory items can seed an outline candidate
- selected claims and evidence can seed a slide candidate
- stale memory can produce affected-slide update candidates
- style notes can seed theme or narration candidates
- accepted changes must still preview, compare, apply, and validate

### Curate Derived Decks

The workbench should make derived-slideset lineage visible:

- show which memory resources drove a derived outline or deck
- show target audience, length, density, and purpose
- compare sibling derived decks over the same knowledge
- create a new derived outline proposal from selected memory and constraints

## API And Storage

The workbench should reuse ADR 0061's presentation-scoped storage:

```txt
presentations/<id>/state/memory.json
```

The API should continue to expose memory as hypermedia resources:

- memory collection
- memory item
- memory evidence
- dependent slides
- memory search
- derived slidesets

Additional actions likely needed by the dedicated workbench:

- `merge-memory-items`
- `restore-memory-item`
- `link-memory-to-slide`
- `unlink-memory-from-slide`
- `suggest-memory-evidence`
- `suggest-memory-maintenance`
- `derive-outline-from-selected-memory`
- `derive-slide-from-selected-memory`
- `propose-dependent-slide-updates`

Actions that change memory should be version-checked writes. Actions that change slides or decks should return candidates or outline proposals unless the user explicitly applies a reviewed result.

## UI Implementation Notes

The Memory workbench should be a separate browser-client module rather than adding more behavior to `app.ts` or the compact memory drawer.

Recommended module boundary:

```txt
studio/client/memory-workbench.ts
```

Supporting pure view-model modules should handle filtering, graph node construction, dependency summaries, and action availability so behavior can be tested without mounting the full Studio UI.

The visualization starts as a typed dependency map before any graph-layout library. It should prefer predictable columns, grouped relationships, stable dependency paths, and direct jump/select actions over a complex force-directed graph. A node-link graph can be added later as an optional alternate view only after explicit links are strong enough that the graph will not overstate inferred relationships.

## Relationship To Existing ADRs

ADR 0061 provides the implemented memory resource model, storage, API shape, retrieval, and derived-slideset lineage. This ADR adds a dedicated Studio workbench on top of that baseline.

ADR 0013 provides the hypermedia API conventions. Memory workbench actions should continue to use advertised links, input schemas, audiences, and base-version tokens.

ADR 0017 provides source-grounded generation. Evidence linking should preserve source and material provenance rather than duplicating large content into memory.

ADR 0022 provides selection-scoped commands. Current-slide selections can later become memory links or review notes, but the memory workbench should not depend on fragile pixel coordinates.

ADR 0025 provides assisted check remediation. Memory maintenance suggestions should behave like remediation: explain the issue, produce a reviewed candidate or write action, and keep the user in control.

ADR 0032 provides outline flows and derived decks. The Memory workbench should make those relationships inspectable and should create new derived outlines through the same proposal path.

ADR 0050 provides visible-text quarantine. Memory-derived slide, outline, theme, or narration candidates must still pass visible-text checks.

ADR 0055 provides agent-command mode. Agent workflows should call memory actions and candidate-producing endpoints instead of editing `memory.json` directly.

## Validation

Coverage should include:

- memory item browser filters by type, status, tag, confidence, evidence state, and dependency count
- version-checked memory edits reject stale writes
- retire and restore preserve evidence and dependency metadata
- dependency summaries link memory items to dependent slides and derived decks
- evidence-link actions preserve source and material provenance
- graph/view-model tests produce stable nodes and edges from memory resources
- selected-memory generation returns candidates or outline proposals, not direct slide writes
- stale-memory update proposals revalidate affected slides before apply
- browser validation covers create/edit/retire/link/search/derive flows in the dedicated view

## Non-Goals

- No workspace-level or cross-presentation memory in the first dedicated view.
- No replacement of slide specs with graph data.
- No arbitrary graph editor that can create unsupported relationship types.
- No direct slide mutation from memory visualization gestures.
- No force-directed graph dependency as the default view while grouped dependency columns solve the first workflows.
- No hidden vector-store-only memory that authors cannot inspect or repair.

## Resolved Design Answers

- Start with a grouped dependency map, not a node-link graph. Use grouped columns such as `memory item -> evidence -> slides -> derived decks` because they are easier to scan, validate, and act on during authoring. A node-link graph can come later only if real memory work shows that grouped paths cannot explain relationships well enough.
- Surface memory maintenance warnings in the deck check console as a separate authoring/workflow category. Examples include accepted claims without evidence, stale memory used by active slides, retired memory still linked to a slide, and orphaned high-confidence memory. The Memory workbench remains the repair surface for those issues.
- Use both explicit persisted slide-to-memory links and derived metadata. Explicit links record intentional author or generation use. Inferred links can come from generation metadata, candidate provenance, and slide notes where available. The UI should label them distinctly as `linked` or `inferred`.
- Use deterministic evidence suggestion before LLM synthesis. Start with keyword, tag, source-title, material, slide-text, and existing-evidence matching. Call the LLM only when the user asks for evidence suggestions or when deterministic candidates need ranking or explanation. The LLM returns suggestions; it does not write links directly.
- Show derived-deck comparison in both the Memory workbench and the Outline drawer, with different jobs. The Memory workbench compares knowledge coverage: claims used, evidence coverage, omitted concepts, audience assumptions, and style notes. The Outline drawer compares delivery structure: section order, slide count, density, pacing, and narrative arc.

## UX Follow-Up

The implemented view should keep creation secondary to inspection and repair. The create form can live behind a disclosure, while the relationship map and maintenance warnings carry the visual weight of the page.

Dependency rows should be actionable: selecting a memory item, jumping to linked slides where possible, and opening repair context for warnings should be available directly from the map or warning rows. This keeps the view manipulative instead of becoming a static report.
