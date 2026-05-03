import assert from "node:assert/strict";
import test from "node:test";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const {
  importContentRunArtifacts,
  replaceMaterialUrlsInSlideSpec
} = require("../studio/server/services/content-run-artifacts.ts");

type JsonRecord = Record<string, unknown>;

const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0KAAAAFklEQVR42mN8z8DwnwEJMDGgAcQBAH3kAweoKjmtAAAAAElFTkSuQmCC";

test("content run artifacts replace generated material references", async () => {
  const createdSources: unknown[] = [];
  const materialUrlById = await importContentRunArtifacts({
    materials: [
      { dataUrl: tinyPngDataUrl, fileName: "local.png", id: "local", title: "Local image" },
      { id: "remote", title: "Remote image", url: "https://example.com/remote.png" },
      { id: "broken", title: "Broken image", url: "https://example.com/broken.png" }
    ],
    sourceText: "Source text"
  }, {
    createMaterialFromDataUrl: (material: JsonRecord) => ({
      ...material,
      url: `/materials/${material.id}.png`
    }),
    createMaterialFromRemoteImage: async (material: JsonRecord) => {
      if (material.id === "broken") {
        throw new Error("remote unavailable");
      }
      return {
        ...material,
        url: `/materials/${material.id}.png`
      };
    },
    createSource: async (source: JsonRecord) => {
      createdSources.push(source);
      return source;
    }
  });

  assert.equal(materialUrlById.get("local"), "/materials/local.png");
  assert.equal(materialUrlById.get("remote"), "/materials/remote.png");
  assert.equal(materialUrlById.has("broken"), false);
  assert.deepEqual(createdSources, [{ text: "Source text", title: "Starter sources" }]);

  assert.deepEqual(replaceMaterialUrlsInSlideSpec({
    media: { id: "local", src: "placeholder" },
    mediaItems: [
      { id: "remote", src: "placeholder" },
      { id: "missing", src: "placeholder" }
    ],
    type: "photoGrid"
  }, materialUrlById), {
    media: { id: "local", src: "/materials/local.png" },
    mediaItems: [
      { id: "remote", src: "/materials/remote.png" },
      { id: "missing", src: "placeholder" }
    ],
    type: "photoGrid"
  });
});
