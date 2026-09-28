---
phase: 51-site-model-machine-editor
plan: 06
subsystem: ui
tags: [react, next-app-router, server-actions, builder]

requires:
  - phase: 51-site-model-machine-editor (plan 03)
    provides: src/actions/site.ts (listSopMachines, setSopMachines)
  - phase: 51-site-model-machine-editor (plan 05)
    provides: /admin/site route, SiteWorkspace.tsx (the sibling surface writing through the same setSopMachines action)
provides:
  - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx — Tools-menu row + portaled, grouped, searchable machine picker"
  - "BuilderStageShell.tsx ToolsMenu renders <BuilderMachinesButton sopId={sopId} /> after BuilderFlowEditButton"
  - tests/phase51/builder-machines-row.spec.ts fully live (0 test.fixme)
affects: [51-07]

tech-stack:
  added: []
  patterns:
    - "SOP<->machine linking from the builder side reuses the exact setSopMachines()/listSopMachines() actions the /admin/site editor calls — no bespoke insert path, so the two surfaces can never drift (D-12)"
    - "'Adjusting state during render' (not in an effect) to reset loading/error the instant the modal opens — mirrors PersonPanel.tsx's prevPersonId pattern, needed to satisfy eslint-plugin-react-hooks 7's set-state-in-effect rule"

key-files:
  created:
    - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx"
  modified:
    - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx"
    - tests/phase51/builder-machines-row.spec.ts

key-decisions:
  - "Dropped the mounted-guard state BuilderFlowButton.tsx uses before createPortal — open itself starts false and can only flip true from a post-hydration click, so the portal branch never evaluates document.body during SSR without a separate flag; this also sidesteps a pre-existing eslint-plugin-react-hooks 7 set-state-in-effect violation that BuilderFlowButton.tsx already carries (left untouched — out of this task's scope)"
  - "listSopMachines() is refetched every time the modal opens (not cached/fetched once at mount) — a cheap admin-only call, and it guarantees the picker never shows stale machines if the site map changed since last open"

requirements-completed: [SIT-04]

duration: 20min
completed: 2026-09-28
---

# Phase 51 Plan 06: Builder Machine Picker (Tools Menu) Summary

**A "Pick machines for this SOP" row in the builder's Tools menu opens a portaled modal that lists the org's machines grouped by department, filterable by name, and toggling a checkbox saves instantly through the exact `setSopMachines` action the `/admin/site` editor uses — so a SOP's machines are editable from either surface with zero drift.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-28T21:10:00+10:00
- **Completed:** 2026-09-28T21:30:00+10:00
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `BuilderMachinesButton.tsx`: menu row ("Pick machines for this SOP") + portaled modal (`data-testid="machines-picker"`, `role="dialog"`), copying `BuilderFlowButton.tsx`'s Escape-closes / backdrop-click-closes / `createPortal(document.body)` shell
- On open, calls `listSopMachines(sopId)`; renders machines grouped under department headings (alphabetical, "No department" last), each a checkbox `<label>` filtered by a case-insensitive `aria-label="Find a machine"` search input; groups with zero matches after filtering are hidden
- `toggleMachine(machineId)` optimistically flips `linkedIds`, calls `setSopMachines({ sopId, machineIds: next })`, reverts on `{ error }` and shows "Couldn't save — try again", adopts the server's returned `machineIds` on success and shows "Saved ✓" (`aria-live="polite"`)
- Empty state (org has no machines at all): "No machines on the site map yet." + a `Link` to `/admin/site` labelled "Open the site map"
- Wired `<BuilderMachinesButton sopId={sopId} />` into `BuilderStageShell.tsx`'s `ToolsMenu`, directly after `<BuilderFlowEditButton>` and before the delete-draft block
- Activated both describe blocks (`modal`, `tools menu`) in `builder-machines-row.spec.ts` — 7 live tests, 0 `test.fixme`

## Task Commits

Each task was committed atomically:

1. **Task 1: BuilderMachinesButton — menu row + portaled, grouped, searchable machine picker** — `3287b67` (feat)
2. **Task 2: Wire the row into ToolsMenu** — `1923bd3` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx` (213 lines) — menu row + modal
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` — import + one JSX line inside `ToolsMenu`
- `tests/phase51/builder-machines-row.spec.ts` — both describes fully activated

## Decisions Made

- No separate `mounted` state before `createPortal` (unlike `BuilderFlowButton.tsx`) — `open` already starts `false` and only becomes `true` from a click after hydration, so the extra flag was redundant, and keeping it would have carried forward a pre-existing `eslint-plugin-react-hooks` 7 `set-state-in-effect` violation into new code
- The loading/error reset on open uses the "adjust state during render" idiom (a `prevOpen` comparison) already established in `PersonPanel.tsx`, rather than setting state synchronously inside the fetch `useEffect` body, to stay clean under the same lint rule

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `eslint-plugin-react-hooks` 7's `set-state-in-effect` rule flagged the copied `mounted`-guard pattern and the fetch-on-open effect's initial `setLoading`/`setLoadError` calls**
- **Found during:** Task 1 eslint sweep
- **Issue:** The plan's instruction to copy `BuilderFlowButton.tsx`'s shell verbatim (including its `useEffect(() => setMounted(true), [])` mounted guard) reproduces a lint error that file already carries pre-existing (out of scope to fix there — untouched by this plan). Writing new code with the same pattern would have shipped a fresh instance of a lint failure rather than a pre-existing one, and a second effect (data fetch on open) synchronously called `setLoading(true)`/`setLoadError(null)` as its first statements, also flagged.
- **Fix:** Dropped the `mounted` state entirely (redundant — `open` alone gates the portal and starts `false`); moved the loading/error reset into the "adjust state during render" idiom (`prevOpen` comparison), matching the established `PersonPanel.tsx` pattern in this codebase, leaving only the async `.then()` callback's `setLoading(false)`/data-setting calls inside the effect.
- **Files modified:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx`
- **Verification:** `npx eslint` on the file — 0 errors, 0 warnings; all 7 `builder-machines-row.spec.ts` tests still pass (none assert on `mounted`); `npx tsc --noEmit` exits 0.
- **Committed in:** `3287b67` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking lint issue, source-code only — no behavioural or test-contract change)
**Impact on plan:** No scope creep; source-contract assertions in the plan (`createPortal(`, `document.body`, `role="menuitem"`, `'Escape'`) don't reference `mounted`, so nothing needed to change in the activated test.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None.

## Next Phase Readiness

- 51-07 (deployed eval) can script against the Tools menu → "Pick machines for this SOP" row → `[data-testid="machines-picker"]` modal, exactly as it scripts against `/admin/site`'s own machine panel
- No blockers for 51-07

---
*Phase: 51-site-model-machine-editor*
*Completed: 2026-09-28*

## Self-Check: PASSED

- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx` — FOUND
- Commit `3287b67` — FOUND in `git log --oneline`
- Commit `1923bd3` — FOUND in `git log --oneline`
- `grep -c "setSopMachines(" "src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx"` = 3 (>= 1) — CONFIRMED
- `grep -c "createAdminClient" "src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx"` = 0 — CONFIRMED
- `grep -c "<BuilderMachinesButton sopId={sopId} />" "src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx"` = 1 — CONFIRMED
- `grep -c "test.fixme" tests/phase51/builder-machines-row.spec.ts` = 0 — CONFIRMED
- `wc -l "src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx"` = 213 (>= 90 min_lines) — CONFIRMED
- `npx playwright test --project=phase51 tests/phase51/builder-machines-row.spec.ts` — 7/7 passed — CONFIRMED
- `npx playwright test --project=phase51` (full project) — 80 passed, 1 skipped, 0 failed — CONFIRMED
- `npx playwright test --project=phase33 --project=phase26` — 153 passed, 2 skipped, 0 failed — CONFIRMED
- `npx playwright test --project=phase15-stubs tests/lint/design-tokens.spec.ts tests/lint/no-undefined-css-tokens.spec.ts tests/lint/no-bulk-verify-ui.spec.ts` — 10/10 passed — CONFIRMED
- `npx tsc --noEmit` exits 0 — CONFIRMED
- `npx eslint` on all new/modified source files — 0 errors, 0 warnings — CONFIRMED
