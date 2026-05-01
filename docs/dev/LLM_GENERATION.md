# LLM Generation Developer Guide

This guide maps the generation path for coding work. Product behavior is governed by ADR 0010, ADR 0011, ADR 0017, and ADR 0028: LLMs propose structured candidates, while local code validates, previews, and applies.

## Owns

- Provider calls, runtime LM Studio model selection, and structured response handling.
- Prompt builders, response schemas, and retry prompts.
- Source and material context projection for generation.
- Initial deck planning, outline refinement, single-slide drafting, slide variants, wording, and layout intent.

## Key Files

- `studio/server/services/llm/client.ts`: provider selection, request transport, structured JSON parsing, retry handling, and status reporting.
- `studio/server/services/llm/prompts.ts`: workflow prompts for wording, slide ideation, and redo layout.
- `studio/server/services/llm/schemas.ts`: structured response schemas for generated candidates.
- `studio/server/services/presentation-generation.ts`: staged creation, outline plans, single-slide drafting, local fallback materialization, and generation validation.
- `studio/server/services/operations.ts`: browser-triggered candidate workflows, previews, compare/apply boundaries, and layout operations.
- `studio/server/services/sources.ts`: presentation-scoped source storage and retrieval context.
- `studio/server/services/materials.ts`: presentation material metadata and generation material context.

## Invariants

- The model returns candidate data, not direct file writes.
- Local validation rejects unsupported slide specs before preview or apply.
- Visible slide copy must come from the prompt context or generated candidate, not hardcoded production examples.
- Source-grounded workflows should include enough evidence to review citations without sending unrelated source packs.
- Material context should be scoped to the workflow and target slide.
- Diagnostics should make provider status, retrieval context, and prompt budget regressions inspectable.

## Common Write Paths

- New or changed workflow prompt: update `llm/prompts.ts`, the matching schema in `llm/schemas.ts`, and any compare/apply copy in `operations.ts`.
- New provider behavior: update `llm/client.ts`, `.env.example` if configuration changes, and provider setup docs in `DEVELOPMENT.md`.
- New generation field: update the schema, local validation, preview materialization, and any fixture that asserts rejected placeholders or invalid slide specs.
- New source or material projection: update `sources.ts` or `materials.ts`, then verify diagnostics still show the included context.

## Validation

Run the narrowest useful checks first:

```bash
npm run typecheck
npm test
npm run validate:deck-plan-fixture
npm run validate:slide-spec-fixture
npm run validate:presentation-workflow
```

Run `npm run quality:gate` before finishing if generation changes can affect slide output, browser workflows, validation behavior, or rendered artifacts. See [`VALIDATION.md`](./VALIDATION.md) for the full command map.

## Traps

- Do not bypass the candidate apply boundary for convenience.
- Do not add fixed English examples to production generation paths; keep fallback copy isolated to local/mock fallback generation.
- Do not send full deck plans to every slide-level operation unless the workflow needs that context.
- Do not treat schema acceptance as enough; render or browser validation remains authoritative for layout-sensitive changes.
