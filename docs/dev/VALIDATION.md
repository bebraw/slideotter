# Validation Developer Guide

Use the narrowest validation command that can catch the class of change during iteration. Run `npm run quality:gate` before considering work done when behavior, rendering, presentation output, or shared validation changed.

## Command Map

| Changed area | Start with | Also run when relevant |
| --- | --- | --- |
| Markdown docs and local links | `npm run validate:docs` | `npm run typecheck` if scripts changed |
| TypeScript types or shared service signatures | `npm run typecheck` | `npm test` |
| Unit-covered server behavior | `npm test` | `npm run test:coverage` |
| LLM prompts, schemas, generated slide shape, or deck plans | `npm run validate:deck-plan-fixture` | `npm run validate:slide-spec-fixture`, `npm run validate:presentation-workflow` |
| Slide spec schema or supported slide families | `npm run validate:slide-spec-fixture` | `npm run validate:geometry`, `npm run validate:text` |
| DOM layout, slide rendering, or CSS | `npm run validate:geometry` | `npm run validate:text`, `npm run validate:render` |
| Media handling, captions, source lines, or material attachment | `npm run validate:media-fixture` | `npm run validate:slide-media-fixture` |
| Browser studio workflows | `npm run validate:browser` | `npm run validate:presentation-workflow` |
| Layout library behavior | `npm run validate:studio-layout` | `npm run validate:geometry` |
| Output paths, active presentation paths, or artifact config | `npm run validate:output-config` | `npm run build` |
| Diagrams under `slides/assets/diagrams/` | `npm run validate:diagrams` | `npm run build` |
| Intentional visual output changes | `npm run baseline:render` | `npm run quality:gate` |

## Gate Composition

- `npm run validate:static`: diagrams, slide fixtures, geometry, text, media fixtures, deck-plan fixtures, and output config.
- `npm run validate`: static validation plus browser workflow validation.
- `npm run quality:gate:fast`: typecheck, service coverage, and `npm run validate`.
- `npm run quality:gate`: fast gate plus render-baseline validation.

## Output Rules

- Keep routine validation output concise.
- When a broad command fails for an unrelated known reason, record the exact command, failure location, and retry result in the work summary.
- If visible slide output changes intentionally, refresh `studio/baseline/<presentation-id>/` with `npm run baseline:render` before rerunning the full gate.
- Validate layout from rendered browser or PDF output, not only from source coordinates.

