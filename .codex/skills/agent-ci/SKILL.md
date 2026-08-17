---
name: agent-ci
description: Run the repository's GitHub Actions workflow locally with Local CI, structured progress, and pause-on-failure. Use for workflow-sensitive changes or explicit CI readiness checks.
---

# Local CI

Use the repository-pinned `run-local-ci` package. It is the current upstream name for the tool previously published as Agent CI.

## Run

Docker must be running. Stream the command through RTK's passthrough mode so NDJSON progress remains visible:

```bash
rtk proxy npm run ci:local
```

The package script selects `.github/workflows/ci.yml`, uses quiet rendering, emits structured progress with `--json`, and pauses a failed runner for repair.

## Read progress

JSON mode writes one schema-v1 event per line. Handle these lifecycle events directly:

- `run.start`
- `job.start` and `job.finish`
- `step.start` and `step.finish`
- `run.paused`, including `runner` and `retry_cmd`
- `run.finish`
- `diagnostic`

If the foreground command exits `77`, the workflow is paused rather than finished. Read the preceding `run.paused` event, fix the failure, and follow its `retry_cmd` for the named runner.

## Retry

```bash
rtk proxy npm run ci:local:retry -- --name <runner-name>
```

A bare retry reruns only the failed step.

Retry from a specific step only when the fix requires rerunning earlier setup:

```bash
rtk proxy npm run ci:local:retry -- --name <runner-name> --from-step <N>
```

Retry from the start only when workflow state itself must be rebuilt:

```bash
rtk proxy npm run ci:local:retry -- --name <runner-name> --from-start
```

Repeat the repair-and-retry loop until `run.finish` reports `passed`.

## Local configuration

Copy `.env.local-ci.example` to the ignored `.env.local-ci` file for machine-local overrides. Prefer `LOCAL_CI_*` variables; the legacy `AGENT_CI_*` aliases are transitional compatibility only.

## Guardrails

- Use this workflow for changes to CI, package metadata, dependency installation, or local-CI configuration, and when the user requests full CI readiness.
- Use focused repository checks while iterating, then run the local workflow once the slice is ready.
- Do not parse quiet-mode prose when JSON events provide the state explicitly.
- Do not push merely to trigger remote CI when this local workflow can exercise the same file.
