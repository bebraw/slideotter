# ADR 0019: Cloudflare Cloud Hosting

## Status

Accepted implementation plan; implementation in progress.

## Context

slideotter is currently a local browser studio with server-controlled writes, presentation-scoped storage, DOM-first rendering, and optional LLM providers. ADR 0006 defines the local packaged-app direction: installed code should be read-only and mutable user data should live under `~/.slideotter`.

That local-first model remains valuable. It keeps deck work private, supports local LM Studio usage, and lets the repository continue as a development fixture. At the same time, some workflows benefit from a hosted version:

- using slideotter without installing Node or Playwright locally
- accessing presentations from multiple devices
- sharing preview or presentation links
- running hosted generation workflows with managed provider configuration
- collaborating on decks without passing repository folders around
- offering a clearer product boundary between app code and user data

Cloudflare is a good hosting target because its platform maps well to slideotter's needs: edge-served static UI, server actions, object storage for presentation assets and exported artifacts, relational metadata for registries and workflow state, and queued/background work for generation and rendering jobs.

## Decision Direction

Add a Cloudflare-hosted deployment model for slideotter while preserving the local application model.

The hosted version should use Cloudflare as the primary runtime and storage platform. It should expose the same guarded authoring concepts as the local studio: structured slide specs, explicit workflow actions, preview-before-apply, server-controlled writes, source/material grounding, validation, and DOM-first rendering.

Cloud hosting should not turn slideotter into a freeform document editor or a general chatbot. The hosted app should remain a structured presentation workbench.

## Platform Shape

Use Cloudflare services for the hosted runtime:

- Workers with Static Assets for the browser client and application shell.
- Workers for API routes, workflow actions, auth/session handling, static-asset routing, and presentation metadata reads/writes.
- D1 for relational metadata such as users, workspaces, presentation registry rows, deck context summaries, workflow state, candidate metadata, and audit records.
- R2 for presentation files, materials, preview PNGs, exported PDFs, archives, source uploads, and larger generated artifacts.
- Durable Objects for per-presentation coordination when serialized writes, live preview sessions, or presentation-run state need single-writer behavior.
- Queues for long-running generation, export, validation, import, and cleanup tasks.
- Workers AI or external provider integrations only behind the same structured-generation boundaries used locally.

The exact service mix can change during implementation, but the hosted architecture should keep metadata, object artifacts, and runtime job state separated deliberately.

## Product Rules

- Local slideotter remains supported; cloud hosting is an additional deployment model.
- Hosted writes must remain server-controlled and scoped to an authenticated user or workspace.
- Presentation data should be workspace-scoped, not repository-scoped.
- Generated candidates remain proposals until applied.
- Export, validation, and generation jobs should be observable as job resources with status, progress, diagnostics, and failure details.
- Materials and source uploads must be stored as managed artifacts, not arbitrary remote URLs embedded directly in slide specs.
- Hosted provider secrets must be workspace-owned or platform-managed; they must not leak into deck files or client payloads.
- The cloud UI should preserve the same quiet authoring workflow as the local studio.
- Hosted decks should have explicit import/export paths so users can move between local and cloud workflows.

## Data Model

Cloud storage should mirror the local presentation model without requiring filesystem semantics:

```text
workspace
  presentations
    presentation metadata
    slide specs
    deck context
    sources
    material metadata
    layout/theme libraries
  artifacts
    material files
    preview PNGs
    exported PDFs
    archives
  jobs
    generation runs
    validation runs
    export runs
```

Recommended split:

- D1 stores normalized metadata, ordering, version indexes, job state, audit records, and small structured JSON fields.
- R2 stores canonical slide specs, larger versioned deck documents, binary assets, preview PNGs, export artifacts, and portable bundles.
- Durable Objects coordinate mutations that must be serialized for one presentation or one live presentation run.

Slide specs should stay structured JSON. The hosted app may store them as rows, versioned R2 objects, or both, but the public application model should still look like presentation-scoped slide specs.

## Rendering And Export

Cloud hosting must preserve the DOM-first decision from ADR 0015.

The browser client can render previews directly for authoring, but server-side export and validation need a hosted rendering strategy. The first implementation should evaluate:

- a browser-rendering worker service outside Workers when full Chromium is required
- Cloudflare Browser Rendering if it can support the needed PDF, screenshot, and validation workflows
- queue-backed export jobs that call a dedicated rendering service

The cloud architecture should not add a second slide renderer just because Workers have runtime limits. If export cannot run fully at the edge, use a job-backed renderer that still opens the same DOM preview document.

Cloudflare Browser Rendering is the first rendering path to prove. If it cannot reliably support slide PDF export, screenshots, and DOM validation against the existing preview document, the fallback is a queue-backed dedicated renderer that still opens the same DOM route.

## Auth And Sharing

The hosted version needs explicit identity and sharing boundaries:

- users belong to workspaces
- presentations belong to workspaces
- presentation links can be private, workspace-visible, or explicitly shared
- public presentation links should expose only rendered presentation/preview surfaces, not authoring APIs
- write APIs require authenticated sessions and workspace authorization
- destructive actions should be logged or versioned enough to recover user mistakes

The first implementation can stay single-user or single-workspace if that reduces scope, but the storage model should not block workspaces later.

Collaboration should start with workspace sharing, version history, and optimistic concurrency before live co-editing. Live presence and real-time sessions should build on versioned writes instead of replacing them.

## Local And Cloud Interop

Cloud hosting should build on the local packaging direction instead of replacing it.

Expected interop paths:

- import a local presentation folder or portable archive into a cloud workspace
- export a cloud presentation as a local presentation bundle
- preserve materials, sources, layout definitions, theme settings, deck context, and slide specs during import/export
- treat provider configuration and secrets as environment-specific, not portable deck content
- preserve generated archive PDFs as artifacts when explicitly included

Local and cloud may use different physical storage, but they should share the same logical presentation model and validation expectations.

Local LM Studio workflows remain local-only for cloud decks in the first hosted slice. Hosted generation should use workspace-configured bring-your-own provider credentials or platform-managed providers behind the same structured-generation boundary. Cloud jobs should not route through a user's local LM Studio process until there is an explicit, secure remote-bridge design.

## API Direction

ADR 0013's hypermedia API direction should apply to the hosted model.

Hosted clients and agents should start from workspace or presentation resources, follow advertised actions, and let the server expose valid transitions. This matters more in cloud because external clients, automation, and share links are more likely.

The hosted API should include stable resources for:

- workspaces
- presentations
- slides
- materials
- sources
- candidates
- jobs
- exports
- validation reports
- presentation sessions

## Security And Privacy

Cloud hosting raises security requirements that are less urgent in local-only mode:

- validate and sanitize all uploaded files
- keep private decks and materials out of public caches
- sign or gate artifact URLs when needed
- isolate workspace data in every query and object key
- keep provider secrets encrypted or delegated to platform secret storage
- avoid sending source material to third-party model providers unless the workspace configuration allows it
- record which provider was used for generated content when useful for auditability
- rate-limit expensive generation, rendering, and export endpoints

## Implementation Plan

1. Define a cloud runtime boundary.
   Separate local filesystem services from logical presentation, material, source, workflow, and artifact interfaces.

2. Add cloud storage adapters.
   Implement D1/R2-backed adapters behind the same logical service contracts used by local storage.

3. Package the client for Workers Static Assets.
   Keep the browser app independent from filesystem assumptions and deploy the built Vite client as part of the Worker application rather than adding a separate Pages deployment target.

4. Add authenticated workspace and presentation resources.
   Start with one workspace per user if needed, but keep workspace ids in storage and route boundaries.

5. Move long-running work to jobs.
   Represent generation, export, validation, and import as queue-backed jobs with persisted status.

6. Solve hosted DOM rendering.
   Use the same DOM preview document through an approved browser-rendering path.

7. Add import/export bundles.
   Make local-to-cloud and cloud-to-local movement explicit and testable.

8. Add cloud smoke validation.
   Cover create presentation, upload material, generate candidate, apply candidate, run validation, export PDF, and open a presentation link.

## Non-Goals

- No replacement of the local app model from ADR 0006.
- No real-time multi-cursor editor in the first cloud slice.
- No arbitrary remote media URLs in slide specs.
- No cloud-only slide schema fork.
- No second renderer for cloud export.
- No public authoring APIs without authentication and workspace authorization.

## Open Questions

- What is the smallest useful hosted rendering proof that exercises PDF export, screenshot output, and DOM validation without committing to the long-term renderer deployment shape?
- Which write operations need Durable Object serialization in the first hosted slice, and which can start with optimistic D1/R2 version checks?
