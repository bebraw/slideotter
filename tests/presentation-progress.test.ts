const assert = require("node:assert/strict");
const test = require("node:test");

const {
  renderPresentationDocument
} = require("../studio/client/preview/slide-dom.ts");

function slideEntry(id: string, presentationX: number, presentationY: number) {
  return {
    id,
    index: presentationX,
    presentationX,
    presentationY,
    slideSpec: {
      eyebrow: presentationY > 0 ? "Detour" : "Core",
      summary: "Progress should be scoped to the current slide set.",
      title: id,
      type: "content"
    }
  };
}

test("presentation progress scopes core slides and detours separately", () => {
  const documentHtml = renderPresentationDocument({
    slides: [
      slideEntry("slide-01", 1, 0),
      slideEntry("slide-02", 2, 0),
      slideEntry("slide-02a", 2, 1),
      slideEntry("slide-02b", 2, 2),
      slideEntry("slide-03", 3, 0),
      slideEntry("slide-04", 4, 0)
    ],
    title: "Two-dimensional progress"
  });

  const progressMatches: RegExpMatchArray[] = Array.from(documentHtml.matchAll(/dom-slide__badge-fill" style="width:([0-9.]+)%;/g));
  const progressWidths = progressMatches
    .map((match) => Number(match[1]));

  assert.deepEqual(progressWidths, [25, 50, 50, 100, 75, 100]);
  assert.match(documentHtml, /aria-label="Slide 2 of 4"/);
  assert.match(documentHtml, /aria-label="Slide 1 of 2"/);
});
