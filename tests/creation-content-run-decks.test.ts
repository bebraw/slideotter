import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

const {
  buildPartialContentRunDeck,
  createLiveContentRunPlaceholderDeck
} = require("../studio/server/services/creation-content-run-decks.ts");

test("content run placeholder decks mirror approved outline slides", () => {
  const deck = createLiveContentRunPlaceholderDeck({
    slides: [
      {
        intent: "Open with the audience outcome.",
        keyMessage: "The deck starts with a clear promise.",
        role: "opening",
        sourceNeed: "Use the brief.",
        title: "Open",
        visualNeed: "Simple title slide."
      },
      {
        intent: "Close with one next action.",
        keyMessage: "Make the next step explicit.",
        role: "handoff",
        sourceNeed: "Use the final recommendation.",
        title: "Close",
        visualNeed: "Checklist."
      }
    ]
  });

  assert.deepEqual(Object.keys(deck.slideContexts), ["slide-01", "slide-02"]);
  assert.equal(deck.slideContexts["slide-01"].title, "Open");
  assert.equal(deck.slideSpecs[0].type, "cover");
  assert.equal(deck.slideSpecs[0].generationStatus, "pending");
  assert.equal(deck.slideSpecs[1].type, "summary");
  assert.equal(deck.slideSpecs[1].summary, "Make the next step explicit.");
});

test("partial content run decks preserve completed slides and skip unfinished slides", () => {
  const deck = buildPartialContentRunDeck({
    slides: [
      {
        slideContext: { title: "Generated intro" },
        slideSpec: {
          cards: [
            { body: "Explain the outcome.", id: "card-1", title: "Outcome" },
            { body: "Name the audience.", id: "card-2", title: "Audience" },
            { body: "Preview the flow.", id: "card-3", title: "Flow" }
          ],
          eyebrow: "Opening",
          note: "Use this as the opening frame.",
          summary: "A clear opening promise.",
          title: "Generated intro",
          type: "cover"
        },
        status: "complete"
      },
      { status: "failed" }
    ]
  }, {
    slides: [
      { keyMessage: "Intro message", title: "Intro" },
      { keyMessage: "Detail message", role: "concept", sourceNeed: "Use notes", title: "Detail", visualNeed: "Diagram" }
    ]
  });

  assert.equal(deck.slideSpecs[0].type, "cover");
  assert.equal(deck.slideSpecs[0].index, 1);
  assert.equal(deck.slideSpecs[1].type, "divider");
  assert.equal(deck.slideSpecs[1].skipped, true);
  assert.equal(deck.slideSpecs[1].skipReason, "Partial generation accepted before this slide was drafted.");
  assert.equal(deck.slideContexts["slide-01"].title, "Generated intro");
  assert.equal(deck.slideContexts["slide-02"].mustInclude, "Detail message");
});
