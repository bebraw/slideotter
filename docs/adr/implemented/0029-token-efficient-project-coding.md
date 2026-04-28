# ADR 0029: Token-Efficient Project Coding

## Status

Implemented.

## Context

slideotter is increasingly maintained through agent-assisted coding sessions. The repository already has strong workflow rules, ADRs, validation scripts, and a DOM-first architecture, but coding agents still spend significant context on orientation: finding the right subsystem, rereading broad status documents, loading large service files, and parsing broad command output.

This is a different problem from ADR 0028. ADR 0028 optimizes the tokens spent by slideotter's product LLM workflows while generating decks and candidates. This ADR optimizes the tokens spent by maintainers and coding agents while changing the project itself.

The goal is not to hide complexity or make the repository artificially terse. The goal is to make project structure, invariants, commands, and change boundaries easier to discover with less repeated reading.

## Decision Direction

Make the repository easier to code in with bounded, task-specific context.

Durable project knowledge should be layered so maintainers and agents can read the smallest useful document first, then follow links only when needed. Large implementation files should expose clear module boundaries and concise local invariants. Validation should support targeted iteration in addition to the full quality gate.

The repository should continue to favor explicit documentation and validation over implicit convention, but the documentation should avoid repeating the same broad background in every file.

## Documentation Rules

- Keep `ROADMAP.md` focused on current direction and next practical slices.
- Keep `STUDIO_STATUS.md` focused on the live implementation snapshot and current gaps.
- Keep ADRs focused on durable decisions, boundaries, validation expectations, non-goals, and open questions.
- Keep architecture docs focused on system maps, storage, rendering, validation, and extension points.
- Prefer cross-links over repeated long explanations.
- When a subsystem becomes costly to rediscover, add a short developer entrypoint doc instead of expanding general-purpose docs.
- Keep generated artifacts, baseline outputs, and archive material out of ordinary coding context unless a task explicitly concerns them.

## Developer Entrypoints

Add a compact root-level `DEVELOPMENT.md` as the first general developer entrypoint after the LLM generation guide. It should be a small map for humans and agents: where code lives, how to run common workflows, how to choose validation, and where to find deeper subsystem docs.

Add compact developer guides for high-churn or high-complexity subsystems. Each guide should be short enough to skim before coding and should answer:

- what this subsystem owns
- key files and entrypoints
- core invariants
- common write paths
- targeted validation commands
- common failure modes or traps

Initial candidates:

- `docs/dev/LLM_GENERATION.md` for prompt builders, schemas, providers, source retrieval, material context, and generation repair
- `docs/dev/VALIDATION.md` for quality-gate composition and targeted validation commands
- `docs/dev/RENDERING.md` for the shared DOM renderer, preview, export, baselines, and render validation
- `docs/dev/STUDIO_WORKFLOWS.md` for browser workflow actions, API routes, candidate review, and apply boundaries
- `docs/dev/PRESENTATION_STORAGE.md` for presentation folders, state files, registry/runtime state, and write-boundary rules

These entrypoints should not become parallel architecture documents. They are maps into the codebase.

## Code Organization Rules

Large files are acceptable when they preserve locality, but they should not force unrelated tasks to load unrelated code. When a file grows into multiple distinct responsibilities, prefer a conservative split along existing behavior boundaries.

Good split candidates include:

- presentation generation planning, single-slide drafting, materialization, and repair helpers
- studio operations for slide variants, deck planning, layout work, and validation actions
- browser app code for state management, rendering, event binding, API calls, and workflow-specific UI
- LLM prompt context projection, schemas, provider transport, and diagnostics

Splits should be justified by reduced coupling and clearer ownership. Do not introduce abstractions only to reduce line count.

## Local Invariants

Complex modules should include short local orientation comments or module headers when that saves repeated rediscovery. Add lightweight module headers before splitting large service files so future extraction can follow named responsibility boundaries. These comments should state durable invariants, not narrate implementation mechanics.

Useful invariants include:

- LLMs propose structured candidates; local code validates, previews, and applies.
- The shared DOM runtime is the only supported rendering path.
- Presentation writes go through the server-controlled write boundary.
- Generated visible copy must remain language-neutral and prompt-provided.
- Deck-level narrative changes should update shared deck context.
- Rendered PDF or browser output is authoritative for layout validation.

Avoid long comments that duplicate ADRs. Link to the relevant ADR or developer entrypoint when a boundary needs more context.

## Command And Validation Rules

Coding workflows should produce concise command output by default.

- Use the repository's `rtk` command prefix for routine shell commands.
- Prefer `rg` and targeted file reads over broad directory dumps.
- Keep validation scripts able to run in focused slices.
- Document the narrowest useful validation command beside each subsystem.
- Keep the full quality gate as the final confidence check, but do not require every inner-loop edit to run every browser and render check.
- When broad validation fails for unrelated known reasons, record the exact command, failure location, and retry result in the work summary.

Targeted validation commands should remain repo-level scripts rather than ad hoc personal commands when they become commonly useful.

Document targeted validation in both `DEVELOPMENT.md` and `docs/dev/VALIDATION.md`, with different depth. `DEVELOPMENT.md` should contain the short command map and link onward. `docs/dev/VALIDATION.md` should contain the detailed matrix of changed area to narrowest useful validation command, including when the full quality gate remains required.

## Agent Workflow Boundary

Agent-friendly structure should not weaken project discipline.

Agents should still:

- read the relevant instructions before editing
- avoid reverting unrelated worktree changes
- rebuild or validate outputs when presentation or runtime behavior changes
- update roadmap, status, architecture docs, or ADRs when durable behavior changes
- keep edits scoped to the subsystem and request

The repository should help agents find these requirements quickly instead of relying on large repeated context.

## Implementation Slices

1. Add `docs/dev/` and a first `LLM_GENERATION.md` entrypoint because prompt and generation work is high-churn and token-heavy.
2. Add compact root-level `DEVELOPMENT.md` as the human and agent starting point for coding in the repository.
3. Add `docs/dev/VALIDATION.md` with the full quality gate, focused validation commands, and known output expectations.
4. Add concise module headers to the largest generation, operation, rendering, and validation service files when those headers clarify ownership.
5. Split one high-churn large service only after a real change shows a stable boundary.
6. Add or refine package scripts for targeted validation when existing scripts are hard to discover.
7. Review `ROADMAP.md`, `STUDIO_STATUS.md`, and architecture docs for repeated background that can be replaced with links.
8. Add lightweight checks that prevent generated output directories from being included in normal documentation or search examples.
9. Add a simple scripted Markdown link check before expanding `docs/dev/` into a larger documentation tree.

## Relationship To Existing ADRs

ADR 0010 keeps the product-side LLM boundary explicit. This ADR applies the same discipline to coding assistance: agents may accelerate implementation, but local code, tests, validation, and reviewable commits remain authoritative.

ADR 0015's DOM-first rendering decision should remain easy to discover from rendering entrypoints and module headers.

ADR 0017's source-grounded generation and ADR 0028's token-efficient LLM generation should be referenced from the LLM developer entrypoint so prompt work starts from the right constraints.

ADR 0025's assisted remediation and future agentic workflows should reuse the same documentation and validation boundaries instead of creating hidden maintenance paths.

## Validation

Coverage should include:

- documentation link checks where practical
- a lightweight docs index or README check for `docs/dev/`
- tests or fixtures for any new targeted validation scripts
- review that generated artifacts and baselines are excluded from ordinary search examples
- smoke validation that package scripts referenced by developer docs exist
- periodic review of large files before splitting them, using observed change patterns rather than line count alone

The first docs-link check should stay simple: validate relative Markdown links and referenced repo files before adding heavier documentation linting.

## Non-Goals

- No removal of durable project instructions.
- No replacement for the full quality gate.
- No broad refactor solely to reduce file length.
- No generated summaries that become unreviewed source of truth.
- No hidden agent-only workflow that bypasses local validation or write boundaries.
- No duplication of architecture docs inside every developer entrypoint.

## Accepted Decisions

- Add a compact root-level `DEVELOPMENT.md` first after the LLM generation entrypoint.
- Put targeted validation documentation in both `DEVELOPMENT.md` and `docs/dev/VALIDATION.md`; keep `DEVELOPMENT.md` brief and `docs/dev/VALIDATION.md` detailed.
- Add lightweight module headers before splitting large service files.
- Add a simple scripted docs-link check before expanding `docs/dev/` into a larger documentation tree.
- Prune repeated `ROADMAP.md` and `STUDIO_STATUS.md` background whenever making a meaningful status or roadmap update, with deliberate cleanup before milestones, releases, or large architecture changes.
