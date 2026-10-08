# Phase 63 baseline (untouched tree, 2026-10-08)

Taken by 63-01 before any product code moved (HEAD `a75776c7` plus the harness files of this plan only).

## Bundle gate (`npm run build` postbuild, exit 0)

| Route | Measured | Baseline | Delta | Tolerance |
|---|---|---|---|---|
| `/sops/[sopId]/page` | 795 KB | 795 KB | 0 KB | +/-2 KB |
| `/page` | 836 KB | 834 KB | +2 KB | +/-2 KB |

- `/page` already sits at the tolerance edge (+2). Any plan that grows the root route's shared chunks fails the gate; measure with `npm run build` in the plan that mounts a lazy module (CLAUDE.md 2026-10-06).
- Not charged (other-route segment chunks): `app/page-*`, `app/(auth)/layout-*` on the detail route; `app/(protected)/layout-*`, `app/(auth)/layout-*` on `/page`.
- Focus editor is its own lazy chunk (`static/chunks/2344.*.js`), not charged to the detail route.
- Isolation OK: source-viewer (pdfjs + mammoth), Konva; marker self-validation OK.
- `.bundle-baseline.json` is untouched (never re-captured).

## Failing on the untouched tree

`npx playwright test --project=phase52 --project=phase57 --project=phase58 --project=phase59 --project=phase60 --reporter=list` (one run, no re-run):

- 724 passed, 25 skipped, **0 failed**.
- The 25 skipped are the self-skipping live-DB probes (no `PHASE*_LIVE`) -- not failures.
- No `verifyOtp` / rate-limit failures (environment class, CLAUDE.md 2026-09-28): none occurred.

So the failing-spec baseline for these five projects is empty. Any red in these projects after a later plan is a regression, not an inherited failure.

## Referencing test files (repoint inventory)

See `tests/phase63/repoint-inventory.spec.ts` (`INVENTORY`): 69 files, each classed retire / repoint with an owning plan.
