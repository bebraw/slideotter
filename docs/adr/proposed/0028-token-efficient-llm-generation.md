# ADR 0028: Token-Efficient LLM Generation

## Status

Proposed implementation plan.

## Context

slideotter uses LLMs for staged deck creation, outline refinement, slide drafting, wording variants, layout intent generation, and source-grounded generation. These workflows preserve the product boundary: the model proposes structured candidates while local code owns validation, preview, and explicit apply.

That boundary is correct, but several current prompt paths spend more tokens than the task requires. Slide-level workflows send pretty-printed deck context, selected slide context, and current slide specs. Incremental deck creation drafts one slide at a time but still repeats broad deck context on every slide request. Source and material context are bounded, but the same source pack and material list can be sent to operations that need only a small subset.

Token use affects cost, latency, local model reliability, and how often structured JSON responses truncate. Reducing prompt size should not weaken source grounding, slide quality, validation, or the explicit candidate boundary.

## Decision Direction

Make LLM prompt assembly token-aware and workflow-scoped.

Each LLM workflow should receive the smallest context that can preserve intent, language, structure, grounding, and reviewability. Prompt builders should summarize or project repository state into task-specific prompt context instead of embedding full objects by default.

The model should continue to return structured JSON through existing schemas, but schemas, prompts, source snippets, material metadata, and repeated deck context should be sized according to the operation.

## Product Rules

- Keep generation inspectable: diagnostics should show the effective prompt budgets and which context was included.
- Prefer deterministic local context projection over asking the model to ignore irrelevant fields.
- Preserve the current explicit apply boundary: smaller prompts must still produce candidates, not direct writes.
- Preserve source grounding: token reduction should improve retrieval precision rather than remove evidence from grounded workflows.
- Keep prompts language-neutral and topic-neutral. Optimization must not hardcode deck-specific examples or fixed English visible copy.
- Bias toward short, complete structured output over verbose rationales.
- Treat output token budget as part of workflow design, not a global constant.

## Prompt Context Boundary

Prompt builders should expose workflow-specific context shapes.

Slide variant and wording workflows usually need:

- deck language, audience, objective, tone, constraints, and compact theme summary
- selected slide role, intent, must-include notes, and local slide context
- current slide spec fields that are editable or required for structure preservation
- media attachment ids and short captions only when the workflow may affect media

Redo Layout usually needs:

- slide type, available fields, media presence, and current layout treatment
- compact content inventory instead of full visible copy
- compatible family and layout-library hints
- current slide context when it affects intent

Initial outline planning usually needs:

- brief fields
- compact retrieved source snippets
- compact material inventory
- locked outline slide summaries

Single-slide drafting from an approved outline usually needs:

- target slide detail
- compact whole-deck sequence map for narrative continuity
- previous and next slide summaries when available
- slide-specific source notes and retrieved snippets
- only materials that plausibly match the target slide

The full approved deck plan should not be repeated verbatim for every incremental slide unless a workflow explicitly needs it.

## Source And Material Budgets

Source retrieval should become adaptive:

- outline planning can use a small deck-level source pack
- slide drafting should prefer slide-specific snippets derived from the target slide intent, key message, and source notes
- variant workflows should include sources only when the action is evidence-sensitive
- diagnostics should record retrieved count, used count, omitted count, prompt chars, and source ids

Material context should also be scoped:

- send only material ids, titles, and short alt/caption summaries by default
- include creator, license, and source URL only when the workflow is generating visible references or attribution
- rank materials against the target slide before sending them
- avoid sending a fixed maximum material list to workflows that can only attach one or two assets

## Measurement

Add lightweight LLM request accounting around the structured-response boundary.

For each request, record:

- workflow name
- provider and model
- developer prompt character count
- user prompt character count
- schema character count
- source prompt character count
- material prompt character count
- requested maximum output tokens
- response character count when available
- retry count and retry reason

The studio should surface this in diagnostics without making token accounting the primary authoring surface. The goal is to make regressions visible and to guide future prompt changes with observed data.

## Implementation Slices

1. Add shared prompt-budget diagnostics to the LLM client and persist the latest request summary in runtime diagnostics.
2. Replace pretty-printed JSON in slide workflow prompts with compact JSON or task-specific context summaries.
3. Add workflow-specific context projection helpers for wording, slide variants, redo layout, outline planning, and single-slide drafting.
4. Replace repeated full-deck incremental drafting context with a compact sequence map plus target, previous, and next slide details.
5. Split source retrieval budgets by workflow and add slide-specific retrieval for incremental drafting.
6. Scope material prompts by workflow and target slide instead of always sending the first fixed material list.
7. Review output schemas for verbose fields that can become optional, locally generated, or shorter.

## Relationship To Existing ADRs

ADR 0010's LLM-planned candidate boundary still applies. Token-efficient prompts should produce structured plans and candidates; they should not give the model more authority over writes or runtime behavior.

ADR 0012's progressive generation direction benefits from smaller per-slide prompts because completed slide drafts can appear sooner and are less likely to fail from truncation.

ADR 0017's source-grounded generation remains the grounding contract. This ADR narrows how much source material enters each prompt; it does not remove source retrieval or citation constraints.

ADR 0024's inline current-slide variant generation should use compact current-slide context rather than broad deck state.

ADR 0025's assisted remediation should pass only the failed checks, affected slide fields, and relevant rendered findings rather than whole-deck context.

## Validation

Coverage should include:

- unit tests for context projection helpers to ensure required fields remain present
- prompt budget fixture tests for representative outline, single-slide drafting, wording, variant, and layout workflows
- regression tests that single-slide drafting does not include the full approved deck plan verbatim
- source retrieval tests for deck-level and slide-specific budgets
- material ranking tests that keep relevant image metadata while omitting unrelated materials
- structured generation fixture tests that still reject placeholders, invented citations, leaked schema labels, and truncated text
- browser diagnostics coverage for prompt budget display

## Non-Goals

- No removal of source grounding.
- No bypass of structured schemas, validation, preview, or explicit apply.
- No prompt compression that depends on hidden model memory.
- No global token budget that treats all workflows the same.
- No hardcoded deck-specific examples in production prompts.
- No optimization that makes generated output less inspectable.

## Resolved Questions

- Diagnostics should start with character counts. Character counts are provider-neutral, cheap, deterministic, and sufficient for local regression tracking. Tokenizer-backed estimates can be added later for workflows where provider-specific limits cause real failures or misleading diagnostics.
- Staged creation should set the first baseline budget target, specifically single-slide drafting after outline approval. It has the highest repeated-context cost, affects latency visibly, and has a clear target shape: compact sequence map plus target and neighbor slide context instead of the full approved plan.
- Prompt budgets should be fixed by workflow in code at first, with provider- or model-aware defaults only where needed. Users should see diagnostics, but should not manage token budgets unless real provider differences make fixed workflow budgets too brittle.
- Source retrieval should improve prompt-context projection before adding embeddings. Projection reduces prompt bloat immediately and clarifies what slide-specific retrieval queries need to contain. Embeddings should be added only after diagnostics show meaningful keyword retrieval misses.
- Schema shortening should begin with fields local code can preserve or synthesize without reducing review clarity: optional or capped rationale fields, local ids instead of repeated deck or theme metadata, locally generated review labels, omitted unchanged slide fields, and source or material ids whose full attribution is resolved locally.
