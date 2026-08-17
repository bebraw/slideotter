import { spawn } from "node:child_process";
import process from "node:process";

export type QualityGateStep = {
  args: string[];
  command: string;
  label: string;
};

export type QualityGateOptions = {
  heartbeatMs?: number;
  log?: (message: string) => void;
  now?: () => number;
  run?: (step: QualityGateStep) => Promise<number>;
  steps?: QualityGateStep[];
};

export type IntervalHandle = ReturnType<typeof setInterval>;
export type SetInterval = (callback: () => void, milliseconds: number) => IntervalHandle;
export type ClearInterval = (handle: IntervalHandle) => void;

export type HeartbeatOptions = {
  clearIntervalFn?: ClearInterval;
  heartbeatMs: number;
  label: string;
  log: (message: string) => void;
  now: () => number;
  position: string;
  setIntervalFn?: SetInterval;
  stepStartedAt: number;
};

const defaultHeartbeatMs = 30_000;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const sharedQualityGateSteps: QualityGateStep[] = [
  {
    args: ["scripts/run-parallel.mjs", "lint", "typecheck", "test:coverage"],
    command: process.execPath,
    label: "lint, typecheck, and service coverage"
  },
  {
    args: ["run", "validate"],
    command: npmCommand,
    label: "static and browser validation"
  }
];

export const fastQualityGateSteps: QualityGateStep[] = [...sharedQualityGateSteps];
export const fullQualityGateSteps: QualityGateStep[] = [
  ...sharedQualityGateSteps,
  {
    args: ["run", "validate:render"],
    command: npmCommand,
    label: "render baseline validation"
  }
];

export function selectQualityGateSteps(args: string[]): QualityGateStep[] {
  return args.includes("--fast") ? fastQualityGateSteps : fullQualityGateSteps;
}

export async function runQualityGate({
  heartbeatMs = defaultHeartbeatMs,
  log = console.log,
  now = Date.now,
  run = runCommand,
  steps = fullQualityGateSteps
}: QualityGateOptions = {}): Promise<number> {
  const gateStartedAt = now();

  for (const [index, step] of steps.entries()) {
    const position = `${index + 1}/${steps.length}`;
    const stepStartedAt = now();
    log(`[quality:gate] ${position} Starting ${step.label}.`);

    const stopHeartbeat = startHeartbeat({
      heartbeatMs,
      label: step.label,
      log,
      now,
      position,
      stepStartedAt
    });
    const exitCode = await run(step);
    stopHeartbeat();

    if (exitCode !== 0) {
      log(`[quality:gate] ${position} ${step.label} failed after ${formatDuration(now() - stepStartedAt)}.`);
      return exitCode;
    }

    log(`[quality:gate] ${position} Completed ${step.label} in ${formatDuration(now() - stepStartedAt)}.`);
  }

  log(`[quality:gate] Completed all ${steps.length} phases in ${formatDuration(now() - gateStartedAt)}.`);
  return 0;
}

export function startHeartbeat({
  clearIntervalFn = clearInterval,
  heartbeatMs,
  label,
  log,
  now,
  position,
  setIntervalFn = setInterval,
  stepStartedAt
}: HeartbeatOptions): () => void {
  const timer = setIntervalFn(() => {
    log(`[quality:gate] ${position} ${label} still running (${formatDuration(now() - stepStartedAt)} elapsed).`);
  }, heartbeatMs);
  timer.unref();

  return () => clearIntervalFn(timer);
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

function runCommand(step: QualityGateStep): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      env: process.env,
      stdio: "inherit"
    });

    child.once("error", (error) => {
      console.error(`[quality:gate] Could not start ${step.label}: ${error.message}`);
      resolve(1);
    });
    child.once("close", (code) => resolve(code ?? 1));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runQualityGate({
    steps: selectQualityGateSteps(process.argv.slice(2))
  });
}
