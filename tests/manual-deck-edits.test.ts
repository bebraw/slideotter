import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

const {
  createManualDividerSlideSpec,
  createManualPhotoGridSlideSpec,
  createManualQuoteSlideSpec,
  createManualSystemSlideSpec,
  renumberOutlineWithInsert,
  renumberOutlineWithoutIndex
} = require("../studio/server/services/manual-deck-edits.ts");

test("manual deck edit helpers renumber outlines", () => {
  assert.equal(
    renumberOutlineWithInsert("1. Open\n2. Close", "Proof", 2),
    "1. Open\n2. Proof\n3. Close"
  );
  assert.equal(
    renumberOutlineWithoutIndex("1. Open\n2. Proof\n3. Close", 2),
    "1. Open\n2. Close"
  );
});

test("manual deck edit helpers build simple slide specs", () => {
  const systemSlide = createManualSystemSlideSpec({
    summary: "Show the workflow boundary.",
    targetIndex: 3,
    title: "System boundary"
  });
  assert.equal(systemSlide.type, "content");
  assert.equal(systemSlide.index, 3);
  assert.equal(systemSlide.title, "System boundary");
  assert.equal(systemSlide.signals[0].id, "system-boundary-signal-1");

  assert.deepEqual(createManualDividerSlideSpec({
    targetIndex: 2,
    title: ""
  }), {
    index: 2,
    title: "Section break",
    type: "divider"
  });

  assert.deepEqual(createManualQuoteSlideSpec({
    quote: "",
    targetIndex: 4,
    title: "Pull quote"
  }), {
    index: 4,
    quote: "Add a sourced quote or authored pull quote here.",
    title: "Pull quote",
    type: "quote"
  });
});

test("manual photo grid helper requires multiple materials", () => {
  assert.throws(() => createManualPhotoGridSlideSpec({
    caption: "",
    materialIds: ["one"],
    targetIndex: 2,
    title: "Grid"
  }), /2-3 materials/);
});
