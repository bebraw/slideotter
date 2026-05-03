# Studio Client Feature Slice Plan

## Goal

Make `studio/client/` easier to navigate by grouping files by feature ownership while preserving the current app composition and lazy-loading behavior.

Status: completed on 2026-05-03.

## Principles

- Move one feature slice at a time and commit each move separately.
- Start with low-coupling slices that already have stable boundaries.
- Keep `studio/client/app.ts` as the composition root during the migration.
- Preserve existing code-split boundaries and update fixture checks with each move.
- Avoid moving the largest startup-bound workbenches until smaller slices prove the pattern.

## Target Shape

```text
studio/client/
  app.ts
  main.ts
  core/
  shell/
  preview/
  editor/
  creation/
  runtime/
  variants/
  planning/
  api/
  exports/
```

## Migration Order

1. `exports/`: move export artifact helpers.
2. `variants/`: move variant state, controls, and variant review workbench.
3. `api/`: move API explorer and hypermedia/workspace state helpers.
4. `runtime/`: move runtime payload/status and LLM status helpers.
5. `planning/`: move deck planning and deck context form helpers.
6. `preview/`: move DOM preview, slide preview, preview workbench, and slide renderer.
7. `shell/`: move navigation, drawers, command controls, and global events.
8. `editor/` and `creation/`: migrate last because these are the broadest startup paths.

## Completed Layout Notes

- `core/` owns shared state, DOM element lookup, URL state, file reading, and lazy workbench helpers.
- `creation/` owns presentation creation, presentation library, assistant, custom layout, and theme creation workbenches.
- `runtime/` owns runtime status, LLM status, workflows, validation report/settings, and check remediation state.
- `shell/` owns navigation, drawers, command controls, global events, export menu, preferences, app theme, and presentation mode controls.
- Root `studio/client/` now keeps only app entry/composition files, static assets, stylesheet entrypoint, and Vite environment declarations.

## Validation For Each Slice

- `rtk npm run typecheck:strict`
- `rtk npm run validate:client-fixture`
- `rtk npm run studio:client:build`
