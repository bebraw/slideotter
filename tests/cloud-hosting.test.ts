const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertCloudId,
  createCloudArtifactRef,
  createCloudJobRecord,
  createCloudObjectKey,
  createCloudPresentationStoragePlan,
  createCloudSlideRecord,
  createCloudWorkspaceRecord,
  presentationPrefix
} = require("../studio/server/services/cloud-hosting.ts");

test("cloud hosting ids and R2 prefixes are stable and workspace-scoped", () => {
  const workspace = createCloudWorkspaceRecord("team-alpha", "Team Alpha", "2026-05-01T00:00:00.000Z");
  assert.deepEqual(workspace, {
    createdAt: "2026-05-01T00:00:00.000Z",
    id: "team-alpha",
    name: "Team Alpha",
    updatedAt: "2026-05-01T00:00:00.000Z"
  });

  assert.equal(
    presentationPrefix("team-alpha", "quarterly-review"),
    "workspaces/team-alpha/presentations/quarterly-review"
  );

  const plan = createCloudPresentationStoragePlan({
    createdAt: "2026-05-01T00:00:00.000Z",
    presentationId: "quarterly-review",
    title: "Quarterly Review",
    workspaceId: "team-alpha"
  });

  assert.equal(plan.presentation.workspaceId, "team-alpha");
  assert.equal(plan.presentation.r2Prefix, "workspaces/team-alpha/presentations/quarterly-review");
  assert.equal(plan.manifestKey, "workspaces/team-alpha/presentations/quarterly-review/presentation.json");
  assert.equal(plan.deckContextKey, "workspaces/team-alpha/presentations/quarterly-review/state/deck-context.json");
  assert.equal(plan.sourcesKey, "workspaces/team-alpha/presentations/quarterly-review/state/sources.json");
  assert.equal(plan.slidesPrefix, "workspaces/team-alpha/presentations/quarterly-review/slides");
  assert.equal(plan.artifactsPrefix, "workspaces/team-alpha/presentations/quarterly-review/artifacts");
});

test("cloud slide and artifact records separate D1 metadata from R2 objects", () => {
  const slide = createCloudSlideRecord({
    orderIndex: 2,
    presentationId: "quarterly-review",
    slideId: "slide-03",
    title: "Pipeline",
    version: 4,
    workspaceId: "team-alpha"
  });

  assert.deepEqual(slide, {
    id: "slide-03",
    orderIndex: 2,
    presentationId: "quarterly-review",
    specObjectKey: "workspaces/team-alpha/presentations/quarterly-review/slides/slide-03.json",
    title: "Pipeline",
    version: 4,
    workspaceId: "team-alpha"
  });

  const artifact = createCloudArtifactRef({
    contentType: "application/pdf",
    fileName: "quarterly-review.pdf",
    kind: "export",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  });

  assert.equal(artifact.objectKey, "workspaces/team-alpha/presentations/quarterly-review/artifacts/export/quarterly-review.pdf");
  assert.equal(artifact.contentType, "application/pdf");
});

test("cloud jobs carry workspace, presentation, kind, and status metadata", () => {
  const job = createCloudJobRecord({
    createdAt: "2026-05-01T00:00:00.000Z",
    jobId: "export-01",
    kind: "export",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  });

  assert.deepEqual(job, {
    createdAt: "2026-05-01T00:00:00.000Z",
    id: "export-01",
    kind: "export",
    presentationId: "quarterly-review",
    status: "queued",
    updatedAt: "2026-05-01T00:00:00.000Z",
    workspaceId: "team-alpha"
  });
});

test("cloud hosting rejects unsafe ids and object key parts", () => {
  assert.throws(() => assertCloudId("../escape", "workspace id"), /Invalid workspace id/);
  assert.throws(() => createCloudObjectKey(["workspaces", "../escape"]), /Invalid cloud object key part/);
  assert.throws(() => createCloudArtifactRef({
    contentType: "image/png",
    fileName: "../secret.png",
    kind: "material",
    presentationId: "quarterly-review",
    workspaceId: "team-alpha"
  }), /Invalid cloud artifact file name/);
});
