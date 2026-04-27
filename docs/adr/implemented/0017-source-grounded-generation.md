# ADR 0017: Source-Grounded Generation

## Status

Implemented.

## Context

Presentation generation needs to be grounded in author-provided material without turning slideotter into a heavy research system. The studio already stores deck context, source notes, URLs, excerpts, and materials per presentation, and generation can use that data to draft more relevant slides.

The current source grounding path is intentionally lightweight: sources are presentation-scoped, retrieval is keyword-based, prompt packs are bounded, and diagnostics stay inspectable but secondary.

The detailed working roadmap remains in `docs/SOURCE_GROUNDING_ROADMAP.md`; this ADR captures the implemented product and architecture boundary.

## Decision

Use presentation-scoped, inspectable source grounding for generation.

Text sources live with the active presentation. Generation builds a bounded retrieval query from deck and slide context, retrieves matching source chunks through deterministic scoring, and injects selected snippets into local or LLM generation. Retrieved source metadata is returned with generation diagnostics so authors can inspect what the model or local generator saw.

Image materials and imported image-search results can also participate in generation through bounded material metadata. Generated slides may attach known presentation materials by id, and server-side materialization validates those references before writing slide specs.

## Product Rules

- Sources belong to the active presentation.
- New presentation generation uses that presentation's starter sources and must not silently borrow sources from another active deck.
- Source controls should remain compact and secondary to the authoring workflow.
- Retrieval diagnostics should be available but collapsed by default.
- Prompt source packs should be bounded by snippet count and excerpt size.
- URL fetches should enforce content size, acceptable content types, private-network rejection, and text normalization.
- Image search is explicit create-time material import, not open-ended automatic web research.
- Imported image metadata should preserve provider, creator, license, license URL, and source URL when available.

## Retrieval Rules

- Use keyword retrieval until real decks show that embeddings are necessary.
- Apply stable scoring with useful title, URL, and query-field weighting.
- Suppress duplicate chunks.
- Prefer transparent truncation over hidden prompt bloat.
- Report how many sources and snippets were used by a generation.

## Consequences

### Positive

- Generated decks can use user-provided evidence without a complex research stack.
- Source use remains debuggable through diagnostics.
- Source and material writes stay inside presentation-scoped storage.
- The prompt budget remains predictable for weak local models.

### Negative

- Keyword retrieval can miss semantically relevant material.
- Diagnostics add implementation detail that must stay secondary in the UI.
- Visible citation behavior remains a later design problem rather than fully solved grounding.

## Maintenance Notes

- Add embeddings only after real decks show keyword retrieval misses that matter.
- Keep visible citations conservative until slide layout and language rules can support them.
- Keep automatic web access narrow and explicit.
- Continue validating material references server-side before generated slides are accepted.
