# ADR 0046: Cloud LLM Provider Boundary

## Status

Implemented.

## Context

The local slideotter app can generate and revise presentations through configured LLM providers such as OpenAI, OpenRouter, and LM Studio. Local LM Studio is especially useful because it keeps generation on the user's machine and fits the local-first app model.

ADR 0019 adds a Cloudflare-hosted baseline with Workers, D1, R2, Queues, and a Browser Rendering proof. That baseline stores workspaces, presentations, slides, sources, materials, bundles, provider configuration, and job records. Cloud generation jobs now run through a Workers AI binding, store reviewable generation candidates in R2, and update persisted job diagnostics without directly mutating slide specs.

Cloud generation needs a stricter provider boundary than local generation:

- provider credentials may be workspace secrets, platform-managed secrets, or user-owned bring-your-own credentials
- cloud jobs may run without a browser session attached
- local LM Studio endpoints are not reachable or safe to call from Cloudflare Workers by default
- source and material grounding may contain private workspace data
- generation outputs must still become reviewed candidates or validated slide writes, not hidden direct mutations

## Decision Direction

The cloud version should not call a user's local LM Studio server directly.

The first production cloud LLM provider should be Cloudflare Workers AI behind a small provider adapter interface. Workers AI keeps the first hosted generation path inside the Cloudflare deployment boundary and avoids external provider secret management before it is necessary.

The adapter, job metadata, and policy model should remain provider-neutral so OpenAI, OpenRouter, or another hosted provider can be added later if Workers AI is insufficient for structured quality, model coverage, diagnostics, or customer requirements.

Cloud LLM generation may later use:

- workspace-configured bring-your-own provider credentials for hosted providers such as OpenAI or OpenRouter
- platform-managed provider credentials where the deployment operator owns the billing and policy boundary
- Cloudflare-native model services that satisfy the same structured generation, grounding, diagnostics, and validation constraints

All cloud providers should sit behind the same conceptual boundary as local generation: the model proposes structured plans or candidates, while server-owned code validates, materializes, previews, and applies changes.

The implemented cloud runtime advertises storage, import/export, rendering-proof, provider-configuration, and job-resource capabilities. Its first generation path stores Workers AI output as cloud generation candidates, not hidden direct mutations.

## Resolved Questions

- The first production cloud provider should be Cloudflare Workers AI behind a small provider adapter interface. The first implementation should not promise multi-provider production support, but the job, policy, and candidate model should avoid Workers AI-specific assumptions so OpenAI or OpenRouter can be added later.
- Bring-your-own provider credentials should initially be workspace-owner/admin configuration only. Individual personal provider credentials are deferred until there is a clearer product and policy model for billing, revocation, attribution, and mixed-user privacy expectations.
- Third-party model calls should allow only minimal deck context and explicitly selected source snippets by default. Full source documents, uploaded material bodies, image/media bytes, speaker notes, and broad material metadata require explicit workspace policy approval.
- Initial cloud generation should use Cloudflare Queues plus persisted job records, base versions, and optimistic concurrency. Durable Objects are deferred until collaborative editing requires per-presentation coordination, live cancellation, or stronger ordering semantics.

## Product Rules

- Local LM Studio remains local-only unless a separate secure remote-bridge ADR defines authentication, network access, privacy, and user consent.
- Cloud provider credentials are environment or workspace configuration, not portable presentation content.
- Provider secrets must not be stored in slide specs, bundles, generated candidates, source documents, material metadata, client payloads, or logs.
- Generated cloud outputs remain proposals until an authorized user applies them, except for explicitly approved deck-creation flows that write validated placeholder-backed progress.
- Cloud generation jobs must record provider identity, model identity when safe, base presentation or slide version, source/material grounding summary, and failure diagnostics.
- Cloud generation should honor workspace policy before sending source material or image metadata to any third-party provider.
- Provider choice should be visible enough for authors to understand where private material may be sent.
- Cloud generation must preserve the local write boundary: models do not execute runtime behavior, write arbitrary project files, or bypass validation.

## Provider Configuration Model

Start with workspace-scoped provider settings.

Useful fields:

```json
{
  "workspaceId": "workspace-id",
  "provider": "workers-ai",
  "model": "model-id",
  "credentialRef": "secret-ref",
  "allowedDataClasses": ["deck-context", "selected-source-snippets"],
  "enabledWorkflows": ["deck-outline", "slide-draft", "variant", "theme"],
  "createdBy": "user-id",
  "updatedAt": "2026-05-01T00:00:00Z"
}
```

The stored workspace configuration should reference secrets when a provider needs them, not contain raw secret values. Workers AI may use Cloudflare deployment bindings rather than workspace-owned secrets in the first implementation. For later external providers, secrets may be Worker secrets, Secrets Store bindings, or another explicit secret store. The exact storage can vary by deployment, but the application model should treat credentials as opaque references with narrow workflow permissions.

Platform-managed providers can use deployment-level credentials, but the workspace should still expose policy and model settings so users know which provider is active.

Bring-your-own external provider credentials are workspace-owner/admin settings in the first version. User-personal credentials are out of scope until the product has explicit rules for billing, audit trails, revocation, and privacy expectations when multiple collaborators share a workspace.

## Job Flow

Cloud generation should run as an explicit job resource:

1. An authorized client requests a generation workflow from a workspace or presentation resource.
2. The server validates permissions, provider availability, input shape, and base version.
3. The server stores a queued job with a provider configuration snapshot that excludes secret values.
4. Queue processing builds bounded prompt context from deck context, sources, materials, and workflow input.
5. The provider returns structured JSON that is parsed and validated by server-owned code.
6. The server stores candidates, drafts, or validated slide updates with provenance and diagnostics.
7. Clients observe job status through cloud API resources and review candidates before apply.

For staged deck creation, cloud generation may write placeholder-backed progress only when the flow has an explicit approved outline and the same partial-output rules as local Slide Studio live creation.

## Data And Privacy

Cloud generation should minimize prompt context by default.

- Send only the deck context and explicitly selected source snippets needed by the workflow by default.
- Keep full uploaded materials in R2 unless a workflow explicitly needs model-visible media.
- Require explicit workspace policy approval before sending full source documents, uploaded material bodies, image or media bytes, speaker notes, or broad material metadata to a third-party provider.
- Record retrieval summaries and prompt budgets without logging full private prompts by default.
- Let workspace policy disable source-grounded generation for third-party providers.
- Make provider diagnostics inspectable without turning private source text into routine logs.

## Relationship To Existing ADRs

ADR 0019 defines the Cloudflare hosting substrate and already keeps local LM Studio out of the first hosted slice.

ADR 0010 defines the broader direction that LLMs propose structured content while local code validates and materializes it. The cloud provider boundary should preserve that rule.

ADR 0017 defines source-grounded generation. Cloud generation should reuse the same presentation-scoped grounding concept while adding workspace policy and provider-data controls.

ADR 0028 defines token-efficient LLM generation and diagnostics. Cloud generation should keep workflow-scoped prompts, bounded source context, and provider diagnostics.

ADR 0030 defines the future collaboration model. Shared cloud generation jobs should be attributable, permissioned, and version-aware so collaborators can review who generated or applied content.

## Implemented Shape

1. Cloud provider configuration resources.
   - Represent provider, model, enabled workflows, and credential references at workspace scope.
   - Keep raw secrets outside D1/R2 presentation records.

2. Extended cloud job records.
   - Add provider snapshot metadata, base versions, progress, diagnostics, failure details, and result references.
   - Preserve the existing simple job collection shape while adding fields incrementally.

3. Queue worker generation path.
   - Start with low-risk candidate-producing workflows such as outline or single-slide draft.
   - Keep model calls behind a small provider adapter interface.
   - Implement Workers AI as the first production adapter while keeping provider metadata and validation paths provider-neutral.

4. Generated outputs stored as candidates.
   - Persist candidate specs or plan proposals as cloud resources.
   - Require explicit apply with optimistic concurrency for existing decks.

5. Provider policy controls.
   - Let workspaces restrict source text, material metadata, or model-visible media.
   - Default third-party provider calls to deck context and explicitly selected source snippets only.
   - Surface provider and policy information in the client before generation.

6. Cloud smoke coverage.
   - Test provider configuration validation without real secrets.
   - Test queue failure reporting with missing Workers AI bindings.
   - Test Workers AI candidate creation.

## Current Non-Goals

- No direct calls from Cloudflare Workers to a user's local LM Studio server.
- No cloud workflow that stores provider API keys in presentation files, bundles, or client-visible state.
- No user-personal bring-your-own provider credentials in the first cloud generation slice.
- No automatic use of all workspace sources in prompts.
- No default third-party transmission of full source documents, uploaded material bodies, image/media bytes, speaker notes, or broad material metadata.
- No model-executed file writes, runtime code execution, or unvalidated slide-spec mutation.
- No direct slide mutation from cloud model output; generated output remains a candidate resource until a separate apply flow validates and writes it.
