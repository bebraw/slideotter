# Source Grounding Roadmap

This document tracks the next practical steps for combining Slideotter's deterministic generation rules with source-grounded retrieval.

## Current Behavior

- Sources are stored per presentation in `presentations/<id>/state/sources.json`.
- Deck Planning can add pasted text, notes, or URLs as presentation sources.
- Generation builds a lightweight retrieval query from deck fields and retrieves matching source chunks through keyword scoring.
- Retrieved chunks are injected into initial or regenerated deck generation. Local generation can use them directly, and LLM generation receives them as grounded context.
- Retrieved source metadata is returned by generation but is not yet surfaced clearly in the UI.

## Product Goals

- Keep the deterministic generation rules as the shape and quality guardrails for deck output.
- Let sources improve factual grounding without turning the tool into a heavy research system too early.
- Make source usage inspectable so users can understand whether generation missed a source or retrieval failed to select it.
- Keep source controls secondary and compact so the main authoring workflow stays clean.

## Implementation Roadmap

1. **Generation Diagnostics Visibility**
   - Show the snippets retrieved for the last generation in the debug/diagnostics area.
   - Include source title, URL when present, chunk index, and a short excerpt.
   - Keep this hidden by default so normal users are not forced to think about retrieval internals.

2. **New Presentation Source Semantics**
   - Status: implemented.
   - The create form has a compact "starter sources" field.
   - New presentation generation uses those starter sources and does not silently borrow the previously active deck's sources.
   - Starter sources are saved into the new presentation after creation.

3. **Workflow Coverage**
   - Status: implemented for the current source flow.
   - Browser workflow validation creates a deck with starter sources, verifies retrieval diagnostics, adds a source from Deck Planning, and confirms persistence.
   - Service/API coverage covers source create, delete, retrieval, and write-boundary behavior.

4. **Retrieval Quality**
   - Status: first hardening pass implemented.
   - Add title and URL boosts, query-field weighting, duplicate chunk suppression, and stable scoring.
   - Keep embeddings or vector storage as a later option once real decks show keyword retrieval misses.

5. **Citation Discipline**
   - Store retrieved snippet metadata on generation results.
   - Later, allow slides or speaker notes to reference source titles and URLs when a visible claim depends on source material.
   - Avoid visible citation clutter until the slide language and layout rules are ready for it.

6. **URL Fetch Hardening**
   - Status: first hardening pass implemented.
   - Enforce content-size limits, acceptable content types, and safer URL handling.
   - Reject local/private-network URLs before fetching.
   - Keep fetched text normalized and bounded so prompts remain predictable.

7. **Token Budget Controls**
   - Cap retrieved snippets and excerpt sizes deliberately.
   - Report how many snippets and sources were used by a generation.
   - Prefer transparent truncation over hidden prompt bloat.

## Non-Goals For Now

- No vector database until keyword retrieval proves insufficient.
- No automatic web search as part of generation.
- No mandatory citations on every generated slide.
- No source management system beyond presentation-scoped notes, excerpts, and URLs.

## Follow-Up Notes

- Tune retrieval against real generated decks before adding heavier retrieval infrastructure.
- Decide where source-backed claims should surface: diagnostics only, speaker notes, resource panels, or visible slide copy.
- Keep the single starter-source field until real usage shows that multiple titled starter sources are needed during creation.
- Consider embeddings or vector search only after keyword retrieval misses useful material in real decks.
- Add a short user-facing "ground a deck with sources" section to `docs/GETTING_STARTED.md` once the workflow has had more practical use.
