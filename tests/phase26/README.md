# Phase 26 -- surviving specs

The block-model builder this directory once tested was retired in Phase 58 (58-16).
What stays:

- `spine-regression.spec.ts` -- publish gate 400s on unticked steps, no bulk-verify affordance in `src/`, completions append-only.
- `verify-gate.spec.ts` -- the real publish route against `scripts/verify-gate-check.tsx`.
- `konva-worker-isolation.spec.ts` -- Konva stays out of the worker bundle.

Registered as the `phase26` project (`/tests\/phase26\/.*\.(spec|test)\.ts$/`); a new spec here needs no config edit.
List: `npx playwright test --list --project=phase26`.
