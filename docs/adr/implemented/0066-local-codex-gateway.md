# ADR 0066: Local Codex Gateway

## Status

Implemented first manual local slice.

The repository includes a loopback-only OpenAI-compatible gateway that translates slideotter's structured chat-completion requests into local Codex runs. Developers start it through `npm run codex:gateway`; installed packages expose the same manual process as `slideotter codex-gateway`. Authors point the existing `openai-compatible` provider at its URL and supply the same high-entropy local bearer token to both processes. Electron-managed startup and an in-app Codex authentication or model-selection surface remain follow-up work.

## Context

slideotter already supports the OpenAI Responses API with a developer API key, OpenAI-compatible chat gateways, LM Studio, and OpenRouter. The direct OpenAI provider is useful and remains supported, but it always requires API credentials configured for slideotter.

Codex supports local authentication with either a ChatGPT subscription or an OpenAI API key. The local Codex SDK can be embedded in a server-side Node application, and Codex owns its authenticated session. A small local adapter therefore lets slideotter use a separately authenticated gateway Codex home without copying ChatGPT OAuth tokens or an OpenAI API key into the browser or slideotter configuration. See the official OpenAI documentation for [Codex authentication](https://learn.chatgpt.com/docs/auth), the [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk), and the deeper [App Server protocol](https://learn.chatgpt.com/docs/app-server).

Reusing the author's normal home or `~/.codex` directory would inherit personal configuration, instructions, MCP servers, skills from `~/.agents/skills`, plugins, rules, and hooks. Shared OS-keyring authentication could also make a nominally separate home silently reuse the normal Codex credential. Those behaviors are useful in an interactive coding agent but inappropriate in a narrowly scoped structured-generation gateway. Authentication and process-home storage must therefore be isolated from the normal user and Codex homes.

This is a local application capability. A Cloudflare Worker cannot launch a process on the author's machine or read the author's local Codex authentication state.

## Decision

Add a manually started local Codex gateway behind slideotter's existing OpenAI-compatible provider contract.

The first implementation:

- starts through `npm run codex:gateway` from source or `slideotter codex-gateway` from an installed package
- loads the same runtime `.env` and `.env.local` files as the local Studio server
- binds only to `127.0.0.1`, using port `4174` unless `CODEX_GATEWAY_PORT` is configured
- requires `CODEX_GATEWAY_TOKEN` and accepts the secret only through the environment
- requires an explicit `CODEX_GATEWAY_CODEX_HOME` dedicated to the gateway, containing a regular file-backed `auth.json`
- requires one allowlisted model through `CODEX_GATEWAY_MODEL` or the non-secret `--model` option
- accepts non-streaming `POST /v1/chat/completions` requests with a bearer token
- exposes authenticated `GET /health` and `GET /v1/models` endpoints for local verification
- maps `messages` into a Codex prompt and `response_format.json_schema` into Codex structured output
- returns an OpenAI-compatible completion envelope so the existing slideotter provider client does not need a Codex-specific workflow path
- applies `CODEX_GATEWAY_REASONING_EFFORT` (`medium` by default), `CODEX_GATEWAY_TIMEOUT_MS` (`300000` by default), and `CODEX_GATEWAY_MAX_CONCURRENCY` (`1` by default) as process-owned limits

The gateway delegates upstream authentication to the local Codex installation. Authors authenticate the dedicated home with `CODEX_HOME=<gateway-home> codex -c 'cli_auth_credentials_store="file"' login` using ChatGPT subscription access or API-key-backed usage. The launcher requires `<gateway-home>/auth.json` to be a regular file, and the SDK child pins `cli_auth_credentials_store="file"` so it cannot fall back to a shared OS keyring. slideotter stores neither upstream credential type, and the gateway bearer token authenticates only the local HTTP hop; it is not an OpenAI credential.

Keep the direct `STUDIO_LLM_PROVIDER=openai` path unchanged. The local Codex gateway is an additional opt-in route through `STUDIO_LLM_PROVIDER=openai-compatible`, not a replacement for the OpenAI API, LM Studio, OpenRouter, or local deterministic rules.

## Request And Generation Boundary

The data flow is:

```text
Studio browser
  -> slideotter server
  -> loopback Codex gateway
  -> local Codex SDK and Codex-owned authentication
  -> OpenAI
```

The browser does not connect to Codex directly. The slideotter server continues to build bounded workflow context, choose the JSON Schema, parse the response, run visible-text and shape guards, construct candidates, and own every apply or write decision.

The gateway is a protocol adapter, not a general Codex agent surface. It does not accept arbitrary Codex command-line arguments, working directories, shell commands, approval policies, or sandbox modes from HTTP callers. Each generation request uses a fresh Codex SDK thread in a gateway-created empty temporary working directory with read-only sandboxing, approvals disabled, and executable/network tool features disabled. The gateway writes a private project-root marker into that directory and configures it as Codex's only project marker, anchoring project discovery to the request directory rather than a `TMPDIR` ancestor. The directory is cleaned up after the request.

A fresh thread and a removed temporary directory do not imply an ephemeral Codex session. The gateway forces `history.persistence=none` and does not add its own conversation store, but the TypeScript SDK path used by this slice does not expose the CLI's `--ephemeral` option. Codex session metadata therefore remains in `CODEX_GATEWAY_CODEX_HOME`; that directory is isolated but persists across requests. If a future SDK exposes an ephemeral option, or the integration moves to the App Server protocol, the implementation should make that privacy choice explicit rather than claiming per-run ephemerality.

The OpenAI-compatible request includes `max_tokens`, but the Codex TypeScript SDK does not expose an exact output-token limit. The gateway validates `max_tokens` as a positive safe integer, defaults it to 2,600, and adds the requested budget to the prompt. That instruction is not an exact upstream token or cost cap. A separate deterministic response limit rejects final responses larger than the smaller of 262,144 bytes or `max_tokens * 16` bytes.

## Local Security Boundary

The gateway must remain local and narrowly scoped:

- bind to the fixed loopback host `127.0.0.1`; do not add a public bind option
- require the exact bearer token for every endpoint
- require the exact HTTP `Host` header for the active loopback listener
- emit no permissive CORS headers and reject every request carrying an `Origin` header
- bound request-body size (1 MiB by default), concurrent generations, and execution time
- stop or abort the Codex run when the request times out or the gateway closes
- disable Codex history persistence while acknowledging that SDK-created session metadata may remain
- force file-backed Codex authentication and require a regular `<gateway-home>/auth.json`; do not use a shared OS keyring
- force the child `HOME`, `USERPROFILE`, and `CODEX_HOME` to the required `CODEX_GATEWAY_CODEX_HOME`; do not inherit the real home, XDG config/data paths, or normal `~/.codex` home
- reject a gateway Codex home containing `config.toml`, `requirements.toml`, `AGENTS.md`, `AGENTS.override.md`, `.agents/`, `plugins/`, `rules/`, `hooks/`, or custom skills; allow only Codex-owned `skills/.system` beneath its `skills/` directory
- pass Codex only an explicit environment allowlist needed for the synthetic home plus proxy, certificate, locale, and temporary-directory settings; do not forward the full Studio environment or slideotter provider keys
- pin project-root discovery to a marker created in each temporary request directory so repository instructions and skills cannot be discovered through `TMPDIR` ancestors
- keep secrets out of command-line arguments, startup output, errors, and logs
- allow only the configured model and require each request model to match it; never translate model input into arbitrary process arguments
- validate the requested output budget and reject responses over the derived byte limit
- return normalized errors without exposing Codex credentials or local filesystem details

The bearer token should be high entropy, stay local, and be passed to slideotter through `OPENAI_COMPATIBLE_API_KEY`. Rotate it if it is exposed. Startup output may show the listener URL and model, but it must redact the token.

These controls protect the local transport and limit what a malicious local webpage or process can ask the gateway to do. They do not turn the gateway into a multi-user security boundary. It must not be exposed to a LAN, public hostname, reverse proxy, or hosted deployment.

The isolation boundary removes personal and repository customization; it does not claim that Codex runs without skills or administrator configuration. Codex-owned `skills/.system` content in the gateway home, vendor-bundled skills, and machine-admin skills, configuration, and MCP definitions under `/etc/codex` remain trusted residual inputs. The gateway disables the executable and network tool features it controls.

## Startup And Configuration UX

The first slice intentionally keeps lifecycle ownership explicit:

1. Create a dedicated gateway Codex home, such as `~/.slideotter/codex-gateway`, and authenticate it with `CODEX_HOME="$HOME/.slideotter/codex-gateway" codex -c 'cli_auth_credentials_store="file"' login`.
2. Confirm that the home contains a regular `auth.json`. Keep it free of `config.toml`, `requirements.toml`, `AGENTS.md`, `AGENTS.override.md`, `.agents`, plugins, rules, hooks, and custom skills; if `skills/` exists, its only child may be Codex-owned `.system/`.
3. Generate a high-entropy local bearer token.
4. Configure `CODEX_GATEWAY_CODEX_HOME`, `CODEX_GATEWAY_TOKEN`, `CODEX_GATEWAY_MODEL`, and any optional gateway settings beside the matching `OPENAI_COMPATIBLE_*` Studio settings in `.env.local`.
5. Start `npm run codex:gateway` from source or `slideotter codex-gateway` from an installed package. If a non-default or ephemeral port was requested, set `OPENAI_COMPATIBLE_BASE_URL` to its printed loopback URL before starting Studio.
6. Start or restart Studio, then use `Check LLM provider` before generation.

The gateway prints an actionable startup summary and fails clearly when required configuration is missing or the port is unavailable. Codex startup and authentication failures surface as normalized provider errors when a generation request is attempted.

The next desktop-oriented slice may let Electron start and stop the gateway with the application, allocate the port and token internally, detect Codex authentication state, and configure the server process without asking the author to copy environment values. That future UX must keep the same loopback, token, renderer-isolation, and server-owned generation boundaries. It should use Codex-owned login flows rather than importing or exposing ChatGPT tokens.

## Consequences

- Local authors can use models available through their Codex login while preserving slideotter's structured generation and apply contracts.
- ChatGPT and API-key authentication retain different billing, workspace-policy, retention, and availability semantics. The gateway reports provider failures but does not reinterpret those account rules.
- Model availability and rate limits come from the active Codex account. A configured model can fail when that account does not offer it.
- Authors must perform a separate file-backed login for the dedicated gateway home. The synthetic child home and request-root marker keep personal and repository Codex configuration, `~/.agents/skills`, and custom extensions from affecting slideotter generation.
- Vendor-bundled and machine-admin Codex skills, configuration, and MCP definitions remain trusted inputs rather than being fully disabled.
- Codex session metadata may accumulate in the dedicated home even though prompt history persistence is disabled; this first SDK integration is not ephemeral per request.
- `max_tokens` provides a validated prompt budget plus a deterministic response-byte ceiling, not a guaranteed upstream token or cost limit.
- Manual startup adds a second local process and configuration step in the first slice.
- Reusing the OpenAI-compatible adapter keeps the implementation small, but the gateway translates chat roles into a Codex prompt rather than providing identical OpenAI Responses API semantics.
- Hosted slideotter continues to use the cloud provider boundary from ADR 0046; it cannot reuse this local gateway.
- `@openai/codex-sdk` adds a substantial platform-native Codex binary to standard local package installs. If package or Electron footprint becomes material, future work may make gateway support an optional installation.

## Relationship To Existing ADRs

ADR 0006 owns installed-code and user-data boundaries. The gateway must not place credentials in the application bundle or presentation data.

ADR 0010 requires LLMs to return structured plans and candidates while slideotter owns validation and writes. The gateway preserves that boundary.

ADR 0028 requires bounded workflow prompts and inspectable generation diagnostics. Codex-backed requests reuse the same prompt construction and schema path.

ADR 0033 keeps the Electron renderer isolated and the local Node server responsible for provider calls. A future Electron lifecycle integration must start the gateway from the main/server side, never from the renderer.

ADR 0046 defines hosted LLM provider policy. The local Codex gateway does not change that cloud boundary and is not a hosted provider option.

## Validation

Cover the gateway with deterministic tests that do not call OpenAI:

- startup rejects a missing token, missing or non-file `auth.json`, unsafe dedicated Codex home, and non-loopback configuration
- health and model discovery have the documented authentication behavior
- missing, malformed, and incorrect bearer tokens are rejected
- invalid `Host`, CORS preflight, oversized bodies, unsupported streaming, and malformed schema requests fail safely
- concurrency and timeout limits produce normalized errors
- invalid `max_tokens` and oversized Codex responses fail safely
- the Codex child receives file-backed auth and the synthetic dedicated home but not the real home/XDG paths, personal/repository Codex or `.agents` customization, custom gateway-home skills, or slideotter provider keys
- the request directory marker anchors project discovery, while vendor-bundled and machine-admin Codex inputs remain explicitly trusted
- structured messages and JSON Schema map to the expected Codex SDK call
- a successful Codex result maps to the OpenAI-compatible response envelope
- temporary working directories are removed after success and failure
- startup and errors never print the bearer token
- the existing OpenAI-compatible slideotter provider can complete a mocked structured-generation request through the gateway
- package smoke resolves the platform-native Codex binary used by the SDK

Real-provider validation is optional and local because it depends on the author's Codex authentication, model access, usage limits, and network connectivity.
