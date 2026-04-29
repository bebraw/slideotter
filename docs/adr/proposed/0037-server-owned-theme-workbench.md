# ADR 0037: Server-Owned Theme Workbench

## Status

Proposed implementation plan.

## Context

The browser client still owns several theme behaviors that belong closer to generation and validation:

- `studio/client/app.ts` contains hardcoded theme candidate palettes for the creation theme picker.
- The client has a deterministic `generateThemeFromBriefText` fallback even though `/api/themes/generate` already uses LLM generation with a server fallback.
- Theme controls, candidate selection, saved-theme rendering, and deck-context persistence are interleaved with presentation creation and general studio event binding.

This creates two risks:

- Client and server theme behavior can drift, especially around fallback colors, font tokens, and contrast normalization.
- `app.ts` remains a large owner of product logic that should be a thin browser workbench over server APIs.

The studio should keep the browser-native TypeScript client, but theme generation and normalization should be server-owned.

## Decision Direction

Move theme generation, fallback, and candidate-set construction to the server. The browser should own only theme input state, candidate display, preview selection, and explicit apply/save actions.

The authoritative theme path should be:

1. Client sends theme brief, current theme, and deck context to a server endpoint.
2. Server asks the configured LLM for normalized theme tokens when available.
3. Server applies deterministic fallback only when the LLM is unavailable or invalid.
4. Server returns normalized candidate objects with stable ids, labels, notes, source metadata, and visual theme tokens.
5. Client previews and applies those returned candidates without constructing its own palettes.

## Target Shape

Add a focused theme module split:

- `studio/server/services/theme-generation.ts`: continue to own single-theme brief generation and fallback normalization.
- `studio/server/services/theme-candidates.ts`: construct theme candidate lists by using LLM generation when available, deterministic fallback otherwise, and existing `normalizeVisualTheme` rules.
- `studio/server/index.ts`: expose a `/api/themes/candidates` endpoint.
- `studio/client/theme-workbench.ts`: own theme UI rendering, candidate selection, theme brief actions, and saved-theme click handling.
- `studio/client/app.ts`: compose the theme workbench and provide only shared dependencies such as `state`, `elements`, `request`, `renderCreationThemeStage`, and persistence hooks until the broader presentation creation module exists.

The theme module should not change deck write boundaries. Applying a theme still persists through existing server APIs and remains explicit.

## Required Refactors

1. Remove client-side deterministic theme generation.
   The client should not use `generateThemeFromBriefText`. If `/api/themes/generate` fails, surface the server error instead of silently inventing browser-side fallback tokens.

2. Move static theme candidate palettes out of `app.ts`.
   Either produce candidates through a new server endpoint immediately or move the interim list into a small server/client module with one owner. The end state is server-owned candidate generation.

3. Add server theme candidate generation.
   The server should return the current theme plus generated or fallback candidates. Candidate themes must be normalized and contrast-safe by the same rules used by saved deck themes.

4. Extract browser theme workbench behavior.
   Rendering saved themes, theme favorites, candidate cards, candidate preview, theme brief generation, and candidate click handling should move into a feature module.

5. Keep preview-before-apply behavior.
   Selecting a candidate should preview it in the theme workbench. Persisting to deck context should remain explicit where the current workflow requires it.

## Product And Architecture Rules

- Theme generation is LLM-first on the server.
- Deterministic fallback is server-owned and used only for unavailable or invalid LLM output.
- Client-side theme code may format controls and render swatches, but must not invent theme tokens.
- All persistent theme writes continue through server APIs.
- Generated theme candidates remain proposals until selected and applied.
- Theme tokens must remain normalized to supported colors and font families.

## First Implementation Slice

1. Delete the browser `generateThemeFromBriefText` fallback.
2. Update `generateThemeFromBrief()` to rely on `/api/themes/generate`.
3. Keep the existing server fallback behavior in `theme-generation.ts`.
4. Add or update tests/fixtures so client-side fallback does not return.

This removes duplicate generation behavior without changing the visible theme workbench yet.

## Follow-Up Slices

1. Add `/api/themes/candidates` backed by server-side candidate generation.
2. Replace `getCreationThemeVariants()` with fetched candidate state.
3. Extract `theme-workbench.ts`.
4. Move ADR 0037 to implemented after `app.ts` no longer owns theme candidate construction or browser-side theme generation fallback.

## Validation

Each slice should run:

- `npm run typecheck`
- `npm run validate:client-fixture`
- relevant server tests for theme generation/candidates
- `npm run validate:browser` when client script loading or theme UI behavior changes

Run `npm run quality:gate` before marking the ADR implemented.

## Open Questions

- Should `/api/themes/candidates` return one LLM candidate per request plus deterministic alternatives, or ask the LLM for a full candidate set?
- Should generated theme candidates be persisted in draft state, or treated as ephemeral browser session proposals until selected?
- Should saved favorite themes be exposed through the same candidate model so the browser renders one theme list surface?
