# ADR 0020: Plugin System

## Status

Proposed implementation plan.

## Context

slideotter keeps growing useful capabilities: source retrieval, materials, layout libraries, LLM workflows, deck-length scaling, presentation modes, and proposed cloud and agentic APIs. Many future requests will be useful for some users but not central to the core authoring loop.

If every specialized workflow lands in core, the studio becomes harder to maintain and harder to understand. It also becomes harder for users to adapt slideotter to their own domains, providers, asset sources, validation policies, export needs, and internal workflows.

The project already has the right boundaries for a plugin model:

- server-controlled writes
- structured slide specs
- validated candidates
- preview-before-apply
- presentation-scoped sources and materials
- reusable layout/theme libraries
- DOM-first rendering and validation
- proposed hypermedia actions for headless and agentic usage
- implemented local user-data packaging and proposed cloud hosting boundaries

The next architectural step is to make extension points explicit so users can add capabilities without forcing those capabilities into the minimal core.

## Decision Direction

Add a plugin system that lets users author and install extensions while keeping slideotter core small.

The core should own the stable primitives: presentations, slide specs, materials, sources, candidates, validation, rendering, jobs, auth/storage boundaries, and action registration. Plugins should contribute optional capabilities through declared extension points rather than patching runtime internals.

Plugins should be able to add workflows, providers, importers, exporters, validators, slide-family support, layout packs, material sources, theme packs, and presentation actions. They should not bypass the write boundary, validation boundary, preview/apply model, or DOM renderer.

## Product Rules

- Core stays minimal and stable.
- Optional or domain-specific behavior should move to plugins when it can be expressed through a supported extension point.
- Plugins declare their capabilities in a manifest.
- Plugins are disabled by default unless installed, bundled, or explicitly enabled by the user or workspace.
- Plugins must not write files or cloud records directly; they request writes through core services.
- Plugin-generated content remains candidate data until accepted through normal apply actions.
- Plugin UI should be compact and scoped to relevant surfaces, not global chrome by default.
- Plugin APIs should work in both local and cloud deployments where the declared capability is supported.
- Plugin failures should degrade locally to a clear error without breaking unrelated studio workflows.

## Extension Points

Initial extension points should be explicit and narrow:

- **Workflow actions**: add candidate-producing or mechanical actions for slides, decks, materials, sources, or exports.
- **LLM/model providers**: add provider adapters while preserving structured-response validation.
- **Material providers**: import images, screenshots, charts, or other bounded assets into the presentation material library.
- **Source providers**: import notes, URLs, documents, snippets, or internal knowledge exports into presentation-scoped sources.
- **Validators**: add domain-specific checks that report through the existing validation severity model.
- **Exporters**: produce alternative artifacts such as image packs, speaker-note bundles, LMS packages, or cloud-published views.
- **Layout and theme packs**: contribute validated layout definitions, favorite layouts, theme presets, and sample previews.
- **Slide-family modules**: add new structured slide families only when the plugin also supplies schema, renderer integration, validation, fixtures, and migration rules.
- **Presentation-mode controls**: add bounded controls for graph/statechart presentation modes without embedding arbitrary scripts in slide content.

The first implementation should start with workflow actions, providers, validators, and packs. Slide-family modules should come later because they have the highest renderer and validation blast radius.

## Manifest Shape

Each plugin should declare its identity, compatibility, permissions, and contributions:

```json
{
  "id": "com.example.brand-kit",
  "name": "Example Brand Kit",
  "version": "1.0.0",
  "slideotter": {
    "apiVersion": "0.1"
  },
  "permissions": [
    "read:presentation",
    "write:candidates",
    "read:materials"
  ],
  "contributes": {
    "workflowActions": ["brand.applyTone"],
    "validators": ["brand.colorContrast"],
    "themePacks": ["example-brand"]
  }
}
```

The manifest should be validated before a plugin can be enabled. Unknown permissions, unknown extension points, unsupported API versions, or duplicate contribution ids should block installation or activation.

## Plugin Runtime

Prefer a declarative and process-isolated model before allowing arbitrary in-process code.

Supported plugin forms can grow in stages:

1. **Data-only plugins**
   Layout packs, theme packs, prompt templates, validation configuration, and static examples.

2. **Command plugins**
   Local plugins invoked as separate commands with JSON input/output and strict timeouts. They cannot mutate project files directly.

3. **Hosted plugin endpoints**
   Cloud or local HTTP endpoints that receive bounded requests and return structured candidates, diagnostics, or imported artifacts.

4. **In-process modules**
   Consider only after the extension contracts are stable and the security model is clear.

The first implementation should avoid arbitrary in-process plugin execution. Command or endpoint plugins are slower but keep fault isolation, permission checks, and local/cloud parity easier.

## Permissions And Sandboxing

Plugins should use capability permissions rather than implicit trust.

Example permissions:

- `read:presentation`
- `read:slide`
- `read:materials`
- `read:sources`
- `write:candidates`
- `write:materials`
- `write:sources`
- `run:validation`
- `run:export`
- `network:provider`
- `secrets:plugin`

Permissions should be shown during installation or workspace enablement. Local and cloud runtimes may enforce permissions differently, but the manifest model should be shared.

Plugins should never receive provider secrets, source material, or private deck data unless their permissions and invocation context require it.

## API And Action Model

ADR 0013's hypermedia API direction should be the public surface for plugin-contributed actions.

When a plugin contributes an action, the core should decide whether that action is available for the current resource state. API responses can advertise plugin actions alongside core actions, but each action should still include method, href, input schema, effect, and plugin id.

This keeps headless and agentic clients from needing plugin-specific route knowledge. They can follow advertised actions while the server owns permissions, validation, and state transitions.

## Local And Cloud Packaging

Plugins must work with both proposed deployment models:

- In the local packaged app, user-installed plugins live under the user data root such as `~/.slideotter/plugins/`.
- In cloud hosting, workspace-enabled plugins live in workspace configuration and may refer to hosted endpoints, marketplace packages, or platform-managed plugin bundles.
- Bundled core plugins can ship with the app for common optional features without becoming always-on core behavior.
- Plugin configuration and secrets are environment-specific and should not be embedded in portable deck bundles by default.

Import/export should preserve plugin-authored deck data only when it is valid without the plugin or when the bundle declares the plugin dependency clearly.

## Minimal Core Boundary

The core should keep only capabilities that are necessary for the baseline workbench:

- presentation registry and storage abstraction
- slide spec schemas for core families
- material and source registries
- candidate lifecycle
- preview/apply boundary
- DOM rendering and validation
- job/progress model
- auth/workspace/write boundaries where applicable
- plugin discovery, permission checks, and action registration

Everything else should be tested against a simple question: can this be a plugin without weakening validation, usability, or the core authoring loop? If yes, prefer the plugin path.

## Validation

Coverage should include:

- manifest schema validation
- plugin id and contribution id collision checks
- permission enforcement for each extension point
- plugin action registration and availability in hypermedia responses
- command or endpoint timeout and failure handling
- candidate validation for plugin-generated output
- material/source write-boundary checks for plugin imports
- disabled-plugin behavior for decks that reference plugin-authored data
- local and cloud compatibility tests for shared manifest semantics

## Implementation Plan

1. Define plugin manifest and capability schema.
   Start with workflow actions, validators, material/source providers, layout packs, and theme packs.

2. Add plugin registry storage.
   Store installed/enabled plugins in local user data or cloud workspace configuration.

3. Add action registration.
   Let plugins contribute bounded actions that appear through the same action metadata model as core workflows.

4. Add data-only plugin support.
   Load layout/theme packs and static validators before executable plugin forms.

5. Add command plugin execution.
   Invoke plugins out of process with JSON input/output, permission-filtered context, timeouts, and structured diagnostics.

6. Add plugin candidate handling.
   Route plugin output through existing candidate validation, preview, compare, and apply flows.

7. Add plugin packaging and import/export rules.
   Make plugin dependencies visible when decks use plugin-authored schema, layout, or metadata.

8. Add cloud plugin endpoint support later.
   Reuse the same manifest and permission model for hosted plugin endpoints.

## Non-Goals

- No arbitrary mutation of presentation files by plugins.
- No arbitrary client-side script injection into the studio UI.
- No plugin-authored JavaScript inside slide content.
- No bypass of preview-before-apply.
- No unvalidated slide-family or layout schema injection.
- No marketplace requirement in the first implementation.
- No promise that every local command plugin can run in cloud.

## Open Questions

- Should the first executable plugin form be command-based, HTTP endpoint-based, or both?
- Should plugin UI contributions be limited to action panels at first?
- How should deck bundles declare optional versus required plugin dependencies?
- Should there be a signed plugin package format before broader sharing?
- Which current core workflows should be extracted into bundled plugins first?
