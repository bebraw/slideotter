# ADR 0001: Studio Deck-Plan And Validation Controls

## Status

Implemented

## Date

2026-04-23

## Context

The browser studio now supports deck-plan candidates that can patch shared deck context as well as slide files, and the DOM-first validation path is strong enough that the next questions are mostly product-control decisions rather than renderer architecture decisions.

These decisions need a durable home because they affect workflow behavior, UI shape, and validation policy across multiple implementation slices.

## Decision

### Deck-plan shared setting apply

- deck plans should keep auto-applying shared deck settings by default when those changes are part of the candidate
- each candidate should also expose a per-candidate toggle so the user can choose not to apply shared deck settings for that one action
- there is no global studio preference for this yet; revisit that only if repeated usage shows a real need

### Which plan families may patch shared context

- do not hard-limit shared deck patches to a small fixed subset of plan families
- let the user decide per candidate
- this means more plan modes may grow shared deck patches over time as long as the per-candidate control stays clear

### Validation severity

- validation severity should be configurable per rule, not only per rule-group
- each rule should be able to run as either `warning` or `error`

### Media validation depth

- media-heavy validation should support two modes:
  - `fast pass`: cheaper heuristic checks
  - `complete pass`: heavier checks that take longer
- the UI should clearly tell the user that complete pass is slower and more expensive than the fast pass

### Screenshot legibility direction

- start with fast measurable heuristics
- leave room for a heavier complete pass later, including richer analysis if needed

## Consequences

### Positive

- deck-plan apply stays convenient by default instead of forcing extra clicks for the common case
- users keep control when they want slide-file changes without the shared deck patch
- validation policy becomes adaptable to different deck styles and tolerance levels
- media validation can improve without making every normal validation run slow

### Negative

- per-candidate controls add UI and payload complexity
- per-rule severity introduces more saved configuration state and more validation-surface complexity
- complete-pass validation will need careful messaging so users understand the tradeoff

## Implementation Notes

The next implementation slices should add:

1. a per-candidate control for whether shared deck settings apply
2. persisted per-rule validation severity in deck context
3. fast vs complete media validation modes with explicit user-facing wording

These decisions should be reflected in:

- `ROADMAP.md` for next-focus planning
- `STUDIO_STATUS.md` for the live implementation gap list
- studio planning and validation UI once implemented
