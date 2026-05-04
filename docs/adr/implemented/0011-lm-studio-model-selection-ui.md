# ADR 0011: LM Studio Model Selection UI

## Status

Implemented.

## Context

The studio can use OpenAI, OpenRouter, or LM Studio for structured LLM generation. LM Studio is especially useful during local development because authors can swap loaded local models quickly while testing generation quality, latency, and schema-following behavior.

Today model selection is environment-driven. For LM Studio, the server reads `STUDIO_LLM_MODEL` or `LMSTUDIO_MODEL`, and provider checks can call the provider's `/models` endpoint. That works for scripted validation, but it is awkward during hands-on studio use:

- changing the local model requires editing environment variables or restarting with a different configuration
- the UI can show the configured model but cannot switch to another loaded LM Studio model
- debugging model fit across Gemma, Qwen, or other local models requires leaving the authoring loop
- a stale configured model can remain selected after LM Studio loads a different model

The studio should keep LLM generation mode simple: workflows use the configured LLM or block clearly. Model selection is a provider setting, not a return of local/auto/LLM generation modes.

## Decision Direction

Add a browser UI for selecting the active LM Studio model when the configured provider is `lmstudio`.

The UI should list models from LM Studio's OpenAI-compatible `/models` endpoint, show which model is currently active for studio generation, and let the user switch the active model without restarting the studio server.

The selected model should be stored as ignored runtime state, not written into deck source, ADRs, slide specs, or committed configuration. Environment variables remain the startup default. Runtime selection overrides the environment default for the current local studio until changed or cleared.

## Product Rules

- Show model selection only when `STUDIO_LLM_PROVIDER=lmstudio`.
- Keep OpenAI and OpenRouter model choice environment/config driven.
- Do not expose generation modes. The selector chooses the model used by LLM-backed workflows.
- Treat the model list as live provider state; refresh it from LM Studio rather than hardcoding known model names.
- Clearly show when the selected model is not currently listed by LM Studio.
- Keep provider checks and workflow diagnostics tied to the selected runtime model.
- Store the runtime selection in ignored studio runtime state so changing local models does not dirty git.
- Preserve the existing write boundary: client requests may update studio runtime settings, but not `.env` files or process-level shell configuration.

## UI Shape

The existing LLM status popover should gain an LM Studio-only model control:

- current provider and selected model line
- refresh models button
- select menu or combobox of loaded LM Studio models
- apply button when the selected value differs from the active runtime model
- clear override action to return to `STUDIO_LLM_MODEL` or `LMSTUDIO_MODEL`
- provider-check action that verifies the currently selected model

The control should stay compact. It belongs in diagnostics/status, not in every generation workflow.

## Server Shape

Add server-owned runtime LLM settings:

```json
{
  "llm": {
    "modelOverride": "loaded-local-model-id"
  }
}
```

The LLM client should resolve model in this order:

1. runtime `modelOverride`, when provider is `lmstudio`
2. `STUDIO_LLM_MODEL`
3. `LMSTUDIO_MODEL`
4. provider-specific defaults, when any exist

Add endpoints for the browser:

- `GET /api/v1/llm/models`
  Returns provider, configured model, runtime override, active model, model list, and any provider error.

- `POST /api/v1/llm/model`
  Sets or clears the LM Studio runtime model override. Rejects the request unless the active provider is `lmstudio`.

The setter should either require the chosen model to be present in the latest LM Studio model list, or allow saving with a warning only if LM Studio is temporarily unreachable. Prefer requiring a listed model for the first implementation.

## Validation

Model selection should be covered by:

- unit or service tests for model-resolution precedence
- API tests that reject model changes for non-LM Studio providers
- API tests that reject unknown model ids when LM Studio returns a model list
- browser workflow or focused UI validation that refreshes the list, selects a model, runs provider check, and verifies runtime state
- an LM Studio mock in browser validation so CI does not depend on a local model server

## Implementation Plan

1. Add ignored runtime LLM settings.
   Extend runtime state serialization with an optional `llm.modelOverride` value.

2. Route LM Studio model resolution through runtime settings.
   Keep environment variables as defaults and make runtime selection provider-scoped.

3. Add model list and model update endpoints.
   Reuse the existing provider `/models` helper and normalize model ids consistently.

4. Add the LLM status popover controls.
   Render the selector only for LM Studio. Keep the compact status line unchanged for other providers.

5. Wire provider check to the selected model.
   The check should report the selected model and fail clearly if LM Studio cannot serve it.

6. Add tests and browser smoke coverage.
   Mock LM Studio `/models` and `/chat/completions` responses so the selector is validated without requiring a developer's local LM Studio process.

## Approved Answers

- The selector should include only models exposed by LM Studio's OpenAI-compatible `/models` endpoint. The first implementation should show what LM Studio can actually serve now instead of modeling unloaded LM Studio-specific catalog state.
- Changing the selected model should update the active runtime setting only. Provider check remains an explicit action so switching models does not make the compact status control slow or noisy.
- Model choice should be remembered in ignored runtime state across local studio restarts, including user-data app mode under the runtime/settings state area. It must not be written to deck files, ADRs, committed config, `.env` files, or process-level shell configuration. Environment variables remain the default when no runtime override is set.
