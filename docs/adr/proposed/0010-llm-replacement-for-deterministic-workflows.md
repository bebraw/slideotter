# ADR 0010: Replace Deterministic Studio Workflows With LLM Plans

## Status

Proposed implementation plan.

## Context

The studio now treats LLM-backed generation as the primary generation path. Initial presentation generation, slide ideation, and Redo Layout require a configured LLM and return structured plans or intent metadata that local code validates and materializes.

Several useful workflows are still deterministic:

- Drill Wording creates fixed direct, condensed, and operator rewrites from local string transforms.
- Ideate Theme creates fixed visual directions from deck context and local palette helpers.
- Ideate Structure creates fixed family-changing candidates from local heuristics.
- Ideate Deck Structure creates fixed deck-plan candidates from the saved brief and current slide list.
- Deck length scaling still has deterministic modes, with semantic LLM ranking only where the workflow already needs judgment.

These deterministic flows were useful as safe scaffolding. They made the workflow review/apply loop testable before model calls were reliable. They are now also a product limitation. They repeat known patterns, cannot respond deeply to the user's specific request, and preserve hidden English starter phrasing in places where the generation path should stay language-neutral and deck-specific.

The replacement should not let the model write arbitrary files or runtime code. The product boundary remains: the LLM proposes structured JSON, local code validates it, previews it, and applies only one approved candidate.

## Decision Direction

Replace deterministic authoring workflows with LLM-planned structured candidates, while keeping local validators, materializers, and preview/apply boundaries authoritative.

LLM workflows should return intent or candidate JSON, not executable behavior. Local code should continue to:

- validate every candidate against known slide, theme, layout, deck-plan, or wording schemas
- materialize specs through existing server-controlled helpers
- render previews before apply
- keep generated candidates session-only until the user applies one
- preserve source grounding and diagnostics
- fail clearly when no configured LLM is available

Deterministic code can remain only in three roles:

- test fixtures and smoke mocks
- validation, normalization, and materialization of LLM plans
- explicit non-generative actions such as applying a saved layout or restoring a skipped slide

## Target Replacements

### Drill Wording

Replace fixed local wording passes with LLM wording candidates.

The model should receive the current slide spec, selected text when present, deck language, tone, audience, slide intent, and hard design constraints. It should return multiple bounded rewrite candidates that preserve the slide family and field structure unless the user explicitly asks for a structural change.

Local validation should reject:

- added unsupported claims
- changed slide family
- overlong visible lines
- leaked schema labels
- language drift away from the requested deck language

### Ideate Theme

Replace fixed palette/theme directions with LLM visual-treatment candidates.

The model should return theme intent plus normalized theme values, not CSS. Local code should keep contrast normalization and preview the candidate against a representative multi-slide sample before apply.

Local validation should reject:

- inaccessible text/background contrast
- progress fill too close to its track
- missing required theme tokens
- one-note palettes that collapse the deck into a single hue family

### Ideate Structure

Replace heuristic family-changing candidates with LLM structure intents.

The model should choose a target slide family, preserved fields, dropped fields, new emphasis, and rationale. Local code should materialize the actual slide spec from supported families, mirroring the current Redo Layout intent-only approach.

Local validation should reject:

- target families the renderer does not support
- unsupported media assumptions
- family changes that drop required content without saying why
- generated visible copy that fails slide-scale text rules

### Ideate Deck Structure

Replace fixed deck-plan candidates with LLM deck-structure plans.

The model should operate over the saved brief, outline, source snippets, slide roles, current skipped/restored state, and target length. It should return deck-level changes as an explicit plan: keep, skip, restore, insert, replace, retitle, or patch shared deck context.

Local validation should reject:

- plans that delete files directly
- plans that bypass preview/apply
- inserted slides without valid structured specs or enough outline intent
- deck-context patches that conflict with user-edited brief fields

### Deck Length

Keep deterministic deck length controls for exact mechanical actions, but move judgment-heavy choices toward LLM ranking and planning.

Examples:

- "restore all skipped slides" can remain deterministic.
- "make this deck five slides shorter without losing the argument" should use an LLM plan.
- "grow this into a 20-minute talk" should use an LLM plan that inserts structured detail slides and updates deck context when needed.

## Product Rules

- The UI should not expose generation mode switches.
- If a workflow needs judgment, use the configured LLM or block with a clear configuration error.
- If a workflow is a mechanical library or state action, keep it deterministic and label it as apply/reuse/restore rather than generation.
- Generated visible copy must come from the model response or user-provided content, not hardcoded English production helpers.
- Local fallback copy is allowed only in tests, smoke mocks, and explicit mock/demo fixtures.
- Every replacement must keep the existing compare-before-apply model.

## Implementation Plan

1. Add LLM schemas for wording candidates.
   Start with same-family rewrites so the blast radius is small. Require per-field visible text plus rationale and preserved-field metadata.

2. Replace Drill Wording with the wording schema.
   Keep the current UI and candidate review surface. Remove local string transforms once the LLM path has tests and browser workflow coverage.

3. Add LLM schemas for theme candidates.
   Return structured theme tokens plus a short visual-treatment rationale. Reuse existing contrast normalization and theme preview rendering.

4. Replace Ideate Theme.
   Keep saved favorite themes as deterministic library actions. Make new theme generation LLM-only.

5. Add LLM schemas for structure intents.
   Align the shape with Redo Layout's intent-only family-changing candidates so local code still materializes valid specs.

6. Replace Ideate Structure.
   Keep local family materializers and validators. Remove hardcoded structure candidate lists.

7. Add LLM schemas for deck-structure plans.
   Represent keep/skip/restore/insert/replace/retitle/context-patch actions explicitly. Insert and replace actions should carry outline intent, source grounding, role, and constraints rather than fully materialized slide specs. Validate the plan before rendering candidate review.

8. Replace Ideate Deck Structure and semantic deck growth.
   Keep exact mechanical deck-length actions deterministic. Use LLM plans for narrative judgment, then materialize inserted or replacement slide specs through a second slide-drafting call after the plan is approved.

9. Update diagnostics and workflow validation.
   Extend LM Studio smoke mocks for each new schema, and keep provider progress events visible in the diagnostics panel.

10. Remove stale deterministic scaffolding after each replacement ships.
    A deterministic helper should survive only if it validates, materializes, normalizes, or applies a user-approved plan.

## Resolved Questions

- Wording generation should treat selected text as the hard edit target when present. Full-slide rewrites are allowed only when no selection exists or when the user explicitly asks for slide-scoped revision.
- Theme generation should return visual tokens as the primary candidate. It may include a separate deck-context patch when the visual direction changes tone, audience posture, constraints, or theme brief, but applying that patch must remain explicit.
- Deck-structure planning should return outline-level intents first. Inserted or replacement slides should be materialized by a second slide-drafting call using the approved intent, source grounding, and deck constraints.
- Deck-structure retitles and replacements need grounding proportional to semantic change. Clarity-only retitles can ground against the current slide and deck role; new or changed claims require cited source snippets, outline notes, or deck brief fields.
