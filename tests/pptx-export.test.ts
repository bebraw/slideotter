import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { getOutputConfig } = require("../studio/server/services/output-config.ts");
const { _test } = require("../studio/server/services/pptx-export.ts");

type PreviewState = {
  generatedAt: string;
  metadata: {
    author: string;
    company: string;
    subject: string;
  };
  slides: Array<{
    id: string;
    index: number;
    title: string;
  }>;
  title: string;
};

const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMhL9QAAAABJRU5ErkJggg==";

function readZipEntryNames(fileName: string): string[] {
  const buffer = fs.readFileSync(fileName);
  let endOfCentralDirectoryOffset = -1;

  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      endOfCentralDirectoryOffset = index;
      break;
    }
  }

  assert.notEqual(endOfCentralDirectoryOffset, -1, "PPTX should include a zip central directory");

  const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  let offset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);
  const names: string[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, "Expected central directory file header");
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    names.push(buffer.subarray(nameStart, nameEnd).toString("utf8"));
    offset = nameEnd + extraLength + commentLength;
  }

  return names;
}

test("PPTX export writes one image slide with traceability notes", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "slideotter-pptx-"));
  const imageFile = path.join(tempDir, "slide.png");
  const pptxFile = path.join(getOutputConfig().outputDir, "pptx-export-test.pptx");
  const previewState: PreviewState = {
    generatedAt: "2026-05-01T12:00:00.000Z",
    metadata: {
      author: "Test Author",
      company: "Test Company",
      subject: "Test Subject"
    },
    slides: [
      {
        id: "slide-test-01",
        index: 1,
        title: "Traceable test slide"
      }
    ],
    title: "PPTX Export Test"
  };

  fs.writeFileSync(imageFile, Buffer.from(tinyPngBase64, "base64"));
  fs.rmSync(pptxFile, { force: true });

  const result = await _test.writePptxFromRenderedSlides({
    imageFiles: [imageFile],
    imageScale: 2,
    pptxFile,
    presentationId: "pptx-test",
    previewState
  });

  assert.equal(result.pptxFile, path.resolve(pptxFile));
  assert.equal(result.diagnostics.slideCount, 1);
  assert.equal(result.diagnostics.imageResolution, "1920x1080");
  assert.ok(fs.statSync(result.pptxFile).size > 0, "PPTX output should be non-empty");

  const entryNames = readZipEntryNames(result.pptxFile);
  assert.ok(entryNames.includes("ppt/slides/slide1.xml"), "PPTX should include one slide XML file");
  assert.ok(entryNames.some((name) => /^ppt\/media\/image[-\d]+\.png$/u.test(name)), "PPTX should include the rendered slide image");
  assert.ok(entryNames.includes("ppt/notesSlides/notesSlide1.xml"), "PPTX should include traceability speaker notes");

  const notes = _test.buildSlideNotes({
    exportedAt: previewState.generatedAt,
    presentationId: "pptx-test",
    slide: previewState.slides[0]
  });
  assert.match(notes, /Presentation: pptx-test/u);
  assert.match(notes, /Slide: slide-test-01/u);
});
