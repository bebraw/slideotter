# ADR 0055: Agent Command Mode

## Status

Implemented.

## Context

slideotter already supports built-in LLM workflows through configured providers such as LM Studio, OpenAI-compatible APIs, OpenRouter, and cloud provider policy. That works well for repeatable Studio workflows, local models, cloud jobs, and non-code users.

Open Slide demonstrates a different operating model: the slide framework ships agent-facing commands/skills that users can invoke from tools such as Codex, Claude Code, Cursor, or Gemini CLI. The agent uses the user's existing agent subscription or model access, so the slide tool does not need to manage a separate API key for every advanced model path.

That model is attractive for slideotter, but it should not copy Open Slide's direct source-editing approach. slideotter's value depends on guarded workflows: structured slide specs, source/material provenance, server-owned writes, validation, candidate review, and explicit apply.

The question is how to let external coding agents help with advanced-model deck work without weakening the slideotter Studio boundary.

## Decision

Add an optional agent-command mode beside the built-in Studio LLM mode.

Agent-command mode should package a small set of agent-readable commands/skills that help external agents operate slideotter through existing CLI commands, local APIs, and structured workflow boundaries. These commands should use the user's agent/model access for reasoning, but should not bypass slideotter's review/apply model.

The first implementation ships as a repository-local skill pack, not a new runtime subsystem:

- a concise `slideotter-agent-commands` skill under `skills/`
- command descriptions for common agent tasks
- references to existing local commands and API boundaries
- strict rules against direct deck mutation except through approved services or explicit user-requested file edits

The skill pack can later be exported into agent-specific command formats such as `.claude/commands`, `.agents/skills`, Codex skills, or plugin-managed command bundles.

## Operating Model

slideotter should support two complementary paths:

| Mode | Who owns model access | Best for | Boundary |
| --- | --- | --- | --- |
| Built-in Studio LLM mode | slideotter provider config | repeatable in-app workflows, local models, cloud jobs, non-code users | server-owned structured generation |
| Agent-command mode | user's coding agent | advanced model use, interactive expert help, repository-local iteration | agent invokes slideotter commands/API and produces reviewable artifacts |

Agent-command mode is not a replacement for Studio. It is an advanced authoring adapter for users who already work with an external agent.

## Product Rules

- Agent commands must preserve server-owned writes and explicit apply boundaries.
- Commands should create or inspect outlines, materials, candidates, validation reports, exports, and archives.
- Commands must not silently rewrite slide specs when a candidate/review path exists.
- Commands may edit docs, ADRs, tests, and implementation files normally when the user asks for project coding work.
- Commands should prefer local hypermedia/API actions over hardcoded internal service calls when the server is running.
- Commands should prefer existing package scripts over ad hoc shell logic.
- Commands must not require slideotter-specific OpenAI/OpenRouter keys; they rely on the user's external agent where advanced reasoning is needed.
- Commands should keep non-code users on the Studio path. Agent-command mode is optional.

## Initial Command Set

The first skill pack should define these command intentions:

- **Create deck**: collect brief/source/material context, use Studio staged creation when available, and keep outline approval explicit.
- **Improve slide**: create or request a candidate for the current slide; do not overwrite accepted slide state without review.
- **Apply review comments**: translate comments into scoped candidate changes or mechanical fixes.
- **Find logo**: use ADR 0054's SVGL provider flow; import only after user approval.
- **Validate deck**: run checks, summarize failures, and point to repairable issues.
- **Repair checks**: create remediation candidates for supported validation issues.
- **Export deck**: run existing PDF/PPTX/archive commands and report artifacts.
- **Explain deck state**: inspect presentation context, sources, materials, and current workflow state.

These are command intentions, not necessarily separate executables on day one. The first implementation can be a skill that instructs the agent how to carry them out safely.

## Boundaries

### Allowed Outputs

Agent-command mode may produce:

- staged creation drafts
- approved-outline suggestions
- imported materials with provenance
- variant candidates
- validation reports
- repair candidates
- exported artifacts
- documentation updates

### Disallowed Shortcuts

Agent-command mode should not:

- write arbitrary generated slide specs directly when candidate APIs exist
- hotlink remote assets into slides
- import logos or other remote materials without explicit user choice
- call provider secrets outside slideotter's configured provider boundary
- skip validation after presentation or runtime changes
- use static HTML/React/Vue as a parallel canonical deck model

## Implementation Plan

1. Add a repo-local `skills/slideotter-agent-commands/SKILL.md`.
2. Keep the skill concise and command-oriented.
3. Include only stable command recipes and validation expectations in the skill body.
4. Add minimal `agents/openai.yaml` metadata for discoverability.
5. Add documentation/index references so maintainers know the skill exists.
6. Add a lightweight validation fixture that checks the skill names the core guardrails.
7. Later, generate agent-specific slash-command files from the same source if real usage proves the need.

## Consequences

- Users with access to stronger external agents can use that model quality without adding another slideotter API key.
- slideotter remains the owner of deck state, material provenance, validation, and apply boundaries.
- The first slice is low-risk because it is instructional packaging, not arbitrary plugin execution.
- A later plugin/command runtime can reuse the same command taxonomy.
- Documentation must stay clear that agent-command mode is optional and advanced.

## Alternatives Considered

### Only Built-In LLM Providers

This keeps product behavior simpler, but it forces every advanced model path through slideotter provider configuration. It also misses the practical workflow where users already have high-quality coding-agent access.

### Let Agents Edit Slide Files Directly

This is the Open Slide-style source-code model. It does not fit slideotter's structured workflow because it bypasses candidates, validation, source/material metadata, and apply boundaries.

### Build A Full Command Runtime Immediately

A dedicated runtime could expose slash commands, permissions, and structured outputs, but that is too much surface before real usage validates the command taxonomy. A skill pack is enough for the first slice.

## Open Questions

- Which agent surfaces should be first-class: Codex skills, Claude commands, Cursor rules, or a neutral `.agents` format?
- Should agent commands call local HTTP APIs only, or may they import server service modules for offline operation?
- How should command output be represented in the Studio timeline?
- Which commands should become hypermedia actions versus skill-only recipes?
- Should cloud workspaces advertise agent-command affordances differently from local app mode?

## Practical Recommendation

Start with the repo-local skill pack and keep it boring. If users repeatedly invoke the same workflows, graduate those recipes into generated agent-specific command files or plugin-contributed actions. Do not introduce a second deck mutation path.
