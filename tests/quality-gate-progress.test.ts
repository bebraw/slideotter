import assert from "node:assert/strict";
import test from "node:test";

import {
  fastQualityGateSteps,
  formatDuration,
  fullQualityGateSteps,
  runQualityGate,
  selectQualityGateSteps,
  startHeartbeat
} from "../scripts/run-quality-gate.ts";

test("selects fast and full quality gate phases", () => {
  assert.equal(selectQualityGateSteps(["--fast"]), fastQualityGateSteps);
  assert.equal(selectQualityGateSteps([]), fullQualityGateSteps);
  assert.equal(fastQualityGateSteps.length, 2);
  assert.equal(fullQualityGateSteps.length, 3);
});

test("runs every phase with visible transitions", async () => {
  const labels: string[] = [];
  const logs: string[] = [];
  let timestamp = 0;

  const exitCode = await runQualityGate({
    heartbeatMs: 60_000,
    log: (message) => logs.push(message),
    now: () => {
      timestamp += 1_000;
      return timestamp;
    },
    run: async (step) => {
      labels.push(step.label);
      return 0;
    },
    steps: fastQualityGateSteps
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(labels, ["lint, typecheck, and service coverage", "static and browser validation"]);
  assert.match(logs[0] || "", /1\/2 Starting lint, typecheck, and service coverage/);
  assert.match(logs.at(-1) || "", /Completed all 2 phases/);
});

test("stops after the first failing phase", async () => {
  const labels: string[] = [];

  const exitCode = await runQualityGate({
    heartbeatMs: 60_000,
    log: () => undefined,
    run: async (step) => {
      labels.push(step.label);
      return step.label === "static and browser validation" ? 7 : 0;
    },
    steps: fullQualityGateSteps
  });

  assert.equal(exitCode, 7);
  assert.deepEqual(labels, ["lint, typecheck, and service coverage", "static and browser validation"]);
});

test("formats elapsed quality gate time compactly", () => {
  assert.equal(formatDuration(29_999), "29s");
  assert.equal(formatDuration(90_000), "1m 30s");
});

test("reports elapsed time while a phase is still running", () => {
  const logs: string[] = [];
  const timer = setInterval(() => undefined, 60_000);
  timer.unref();
  let heartbeat: (() => void) | undefined;
  let clearedTimer: NodeJS.Timeout | undefined;

  const stopHeartbeat = startHeartbeat({
    clearIntervalFn: (value) => {
      clearedTimer = value;
    },
    heartbeatMs: 30_000,
    label: "browser validation",
    log: (message) => logs.push(message),
    now: () => 91_000,
    position: "2/3",
    setIntervalFn: (callback, delay) => {
      assert.equal(delay, 30_000);
      heartbeat = callback;
      return timer;
    },
    stepStartedAt: 1_000
  });

  assert.ok(heartbeat);
  heartbeat();
  stopHeartbeat();

  assert.equal(clearedTimer, timer);
  assert.deepEqual(logs, ["[quality:gate] 2/3 browser validation still running (1m 30s elapsed)."]);
});
