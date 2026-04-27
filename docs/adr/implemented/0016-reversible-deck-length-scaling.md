# ADR 0016: Reversible Deck Length Scaling

## Status

Implemented.

## Context

Authors often need the same presentation at different lengths. A short meeting version, a stakeholder review, and a workshop version may share the same underlying material while emphasizing different levels of detail.

Deleting slides to shorten a deck loses useful work. Archiving slides also carries the wrong product meaning: archive/removal means the author intentionally removed a slide from the working sequence, while length scaling is a reversible presentation-versioning operation.

The browser studio now supports deck-length scaling through Deck Planning, including deterministic and semantic plans that keep, skip, restore, or insert slides. The detailed implementation reference remains in `docs/DECK_LENGTH_SCALING_PLAN.md`; this ADR records the durable decision.

## Decision

Represent length scaling as reversible skip/restore state on slide specs.

Scaling down marks slides as `skipped` rather than deleting or archiving them. Skipped slides are omitted from normal active deck output, preview, presentation mode, PDF export, archive output, and default validation, but remain restorable through studio workflows.

Scaling up restores skipped slides before inserting new generated detail slides. When semantic growth needs more material than skipped slides can provide, generated insertion actions still produce structured slide specs and flow through the normal preview/apply boundary.

## Data Rules

- `archived: true` means the slide has been removed from normal authoring flow.
- `skipped: true` means the slide is temporarily excluded for length scaling.
- `skipReason` and `skipMeta` record why the slide was skipped and enough placement metadata to restore it well.
- `includeSkipped` should be explicit wherever a caller needs to inspect skipped slides.
- Active slide queries default to non-archived, non-skipped slides.
- Restoring a skipped slide clears skip metadata and reintroduces the slide into the active sequence.
- Active slide indices are compacted after skip or restore operations.

## Product Rules

- Length scaling is a deck-level decision under Deck Planning.
- The user reviews keep, skip, restore, and insert actions before apply.
- Scaling down should preserve narrative shape and remove supporting detail first.
- Scaling up should restore existing skipped material before generating new detail.
- Skipped slides should remain discoverable through restore controls without cluttering the default active slide selector.
- PDF export and archive snapshots include the active deck by default.

## Consequences

### Positive

- Authors can create shorter and longer versions without losing slide work.
- Skipped slides remain valid presentation assets instead of becoming detached files.
- Deck length changes stay reviewable and reversible.
- Semantic growth can reuse previous material before asking a model for more content.

### Negative

- Slide queries need to be explicit about skipped and archived behavior.
- Active slide indices need compaction and restoration logic.
- Validation needs default and maintenance modes so hidden skipped slides do not surprise authors but still remain healthy.

## Maintenance Notes

- Keep `skipped` separate from `archived`.
- Preserve enough `skipMeta` to restore near the original sequence position.
- Keep semantic insertion actions structured and review-before-apply.
- Keep `docs/DECK_LENGTH_SCALING_PLAN.md` as the detailed reference while it remains useful, but treat this ADR as the durable decision summary.
