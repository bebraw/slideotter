# Deck Length Scaling Plan

Status: implemented in the browser studio. The plan remains as the durable product and maintenance reference for reversible deck length scaling.

This plan describes how to add a workflow that scales a presentation to a target page count without losing slides.

The key behavior is:

- scaling down marks slides as skipped
- skipped slides are omitted from the active deck and PDF
- skipped slides remain restorable later
- scaling up can restore skipped slides before generating new ones

## Product Goal

Authors often need the same presentation in multiple lengths:

- a short version for a quick meeting
- a medium version for a stakeholder review
- a longer version for a workshop or appendix-heavy session

The studio should make that adjustment explicit and reversible. The user should be able to ask for a target count, inspect the proposed keep/skip/restore plan, apply it, and later bring skipped slides back.

## Terminology

- **Active slide**: included in the current deck, previews, PDF, archive, and validation.
- **Skipped slide**: temporarily excluded from the current deck to hit a target length, but still part of the presentation.
- **Archived slide**: removed from the live authoring flow by a manual removal or deck-structure operation. Archived slides remain restorable through a maintenance workflow but are not treated as length-scaling candidates by default.

Use a separate `skipped` flag instead of reusing `archived`. Scaling is a reversible presentation-versioning operation, while archive/removal means the author intentionally took a slide out of the working sequence.

## Data Model

Add optional fields to structured slide specs:

```json
{
  "skipped": true,
  "skipReason": "Scaled to 10 slides",
  "skipMeta": {
    "operation": "scale-deck-length",
    "targetCount": 10,
    "previousIndex": 14,
    "skippedAt": "2026-04-24T12:00:00.000Z"
  }
}
```

Rules:

- `archived: true` still excludes a slide from normal deck output.
- `skipped: true` also excludes a slide from normal deck output.
- `includeArchived` should continue to mean "show removed slide files too".
- Add `includeSkipped` where callers need to inspect skipped slides.
- A slide can technically be both `archived` and `skipped`, but UI workflows should avoid creating that combination.
- Restoring a skipped slide clears `skipped`, `skipReason`, and `skipMeta`.

## Slide Ordering

Current active slides are reindexed when a slide is archived. Length scaling should avoid renumbering skipped slides destructively.

Proposed behavior:

1. Preserve each skipped slide's current `index` in `skipMeta.previousIndex`.
2. Mark the slide as `skipped: true`.
3. Reindex only active, non-skipped slides to a compact `1..N` sequence.
4. On restore, insert the skipped slide near `skipMeta.previousIndex` if available.
5. Reindex active slides after restore.

This keeps current active decks clean while preserving enough information for good restoration placement.

## Server API

Add endpoints:

```text
POST /api/deck/scale-length/plan
POST /api/deck/scale-length/apply
POST /api/slides/restore-skipped
```

### Plan Request

```json
{
  "targetCount": 10,
  "mode": "balanced",
  "includeSkippedForRestore": true
}
```

Modes:

- `balanced`: preserve the narrative arc and remove supporting detail first
- `semantic`: rank shrink candidates by narrative necessity and grow by restoring skipped slides before inserting new detail slides
- `front-loaded`: keep early context and conclusion, skip mid-deck detail first
- `appendix-first`: skip appendix/reference-like slides first
- `manual`: only calculate current count, skipped count, and selectable candidates

### Plan Response

```json
{
  "currentCount": 20,
  "targetCount": 10,
  "actions": [
    {
      "slideId": "slide-07",
      "title": "Readable JSON slides",
      "action": "skip",
      "reason": "Implementation detail can be omitted in a shorter walkthrough.",
      "confidence": "medium"
    }
  ],
  "restoreCandidates": [],
  "summary": "Skip 10 supporting slides and keep the intro, workflow, validation, and archive path."
}
```

### Apply Behavior

Applying a scale plan should:

1. validate that target slides still exist
2. mark selected skip actions as `skipped: true`
3. restore selected restore actions by clearing `skipped`
4. insert generated detail slide actions when semantic growth needs more space than restored skipped slides provide
5. compact active slide indices
6. update deck context with a length profile
7. rebuild previews
8. return updated state and a summary

Deck context can store:

```json
{
  "deck": {
    "lengthProfile": {
      "targetCount": 10,
      "activeCount": 10,
      "skippedCount": 10,
      "updatedAt": "2026-04-24T12:00:00.000Z"
    }
  }
}
```

## Planning Heuristics

Start deterministic. Do not require an LLM for the first version.

Signals for keeping slides:

- cover and closing summary
- slides with high-level workflow or decision content
- slides referenced in deck context as required
- slides with `mustInclude` slide context
- slides near the beginning or end of the current deck

Signals for skipping slides:

- slides whose title or summary suggests implementation detail
- repeated operational detail
- appendix/reference/resource slides
- slides with low context density
- slides that are already marked optional in slide context

Later, LLM-backed planning can explain tradeoffs and suggest more audience-aware plans, but it should still return the same structured plan shape.

## UI Placement

Add this under the Slide Studio Outline drawer rather than current-slide editing controls.

Reasoning:

- scaling length is a deck-level decision
- it affects narrative structure, not one slide at a time
- the result should be reviewed like deck-plan candidates

Suggested UI:

- `Target slides` numeric input
- mode segmented control
- `Plan length` button
- plan summary with keep/skip/restore counts
- candidate list grouped by action
- preview strip for resulting active deck
- `Apply length plan`
- `Restore skipped slides` drawer or filter

The Slide Studio selector should show a subtle skipped count, but skipped slides should not clutter the default active slide selector.

## Restore Workflow

Provide a dedicated restore surface:

- show skipped slides with title, previous index, skipped date, and reason
- allow restoring one slide
- allow restoring all skipped slides
- allow restoring to original position or end of deck

Restoring should rebuild previews and update the length profile.

## Semantic Scaling

Status: implemented for the browser studio.

Semantic scaling keeps the reversible skip/restore model, but uses slide meaning more directly:

- Shrinking asks the configured LLM to rank active slides by narrative necessity when available, then falls back to deterministic scoring if the provider is unavailable or the plan is invalid.
- Growing restores skipped slides first. If the target is still larger than the active deck, it inserts structured detail slides that add examples, tradeoffs, evidence, or walkthrough depth.
- Generated insertion actions carry complete structured slide specs and still require the normal explicit apply step.
- Deterministic local insertions remain available as an offline fallback, so scaling up can still add useful detail without an LLM.

## Validation And Build Behavior

Default behavior:

- `getSlides()` returns active, non-archived, non-skipped slides.
- PDF export omits skipped slides.
- preview thumbnails omit skipped slides.
- validation omits skipped slides unless a maintenance mode explicitly includes them.
- render baselines follow the active deck length.

Maintenance behavior:

- Add a validator that checks skipped slides still have valid slide specs.
- Report skipped slides in debug/status surfaces so users know content is hidden.
- Make archive output include only active slides by default.

## Implementation Slices

1. Add slide filtering support for `skipped` and `includeSkipped`. Done.
2. Add helpers to mark slides skipped, restore skipped slides, and compact active indices. Done.
3. Add deterministic scale-plan generation. Done.
4. Add Outline drawer UI for target count, mode, review, apply, and restore. Done.
5. Add service and browser workflow coverage for reversible skip/restore behavior. Done.
4. Add scale-plan apply endpoint.
5. Add Outline drawer UI for target count and plan review.
6. Add restore skipped slides UI.
7. Add tests for skip/restore/index behavior.
8. Add browser workflow coverage for planning, applying, and restoring.
9. Update docs and the demo deck once the workflow is stable.

## Test Coverage

Unit/service tests:

- scaling down marks slides as skipped, not archived
- active slides compact to the target count
- skipped slides can be restored
- restored slides rejoin the active sequence near their previous index
- archived slides are not used as length-scaling candidates by default
- build/export reads only active non-skipped slides

Browser workflow tests:

- plan a shorter deck
- inspect the proposed skipped slides
- apply the plan
- confirm preview count changes
- restore a skipped slide
- confirm preview count increases

Fixture tests:

- deck plan fixture should reject placeholder scale reasons
- active demo deck should not accidentally contain skipped slides unless the test explicitly creates them

## Open Questions

- Should skipped slides appear in the presentation selector's first-slide thumbnail if slide 1 is skipped?
- Should there be named length profiles, such as `short`, `standard`, and `workshop`, instead of one mutable skipped state?
- Should archive support an option to include skipped slides as appendix pages?
- Should skipped slides be visible in `/deck-preview` behind a query parameter for review?
- Should scaling up first restore skipped slides, generate new slides, or ask the user which strategy to use?
