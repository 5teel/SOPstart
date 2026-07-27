---
phase: 36-refresher-cadence-version-currency
plan: 09
subsystem: ui
tags: [version-currency, refresher-cadence, trn-03, admin-ui, versions-page]

# Dependency graph
requires:
  - phase: 36-06
    provides: getVersionCompletionBreakdown(sopId) action + VersionCompletionBreakdown interface (TRN-03 read)
  - phase: 36-03
    provides: setRefresherInterval(sopId, months) server action (REF-01/REF-02)
provides:
  - Per-version completion breakdown panel on the versions page (worker counts + expandable worker lists, current-version-aware outdated note)
  - Refresher-interval control (set/clear) on the versions page, wired to setRefresherInterval
  - VersionRecord.refresher_interval_months surfaced from getVersionHistory's existing sops select
  - version-breakdown-panel.spec.ts fully live (no skip guards)
affects: [36-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TRN-03 lands entirely inside the existing versions page — zero new admin routes, per CONTEXT's least-new-surface preference; the refresher-interval control sits in the same action-button row as Upload/Clone rather than a new panel"
    - "loadVersions() lifted out of the effect into a useCallback so both the mount effect and the refresher save/clear handlers can re-run it to reflect persisted state"
    - "Completion breakdown keyed by breakdown.versions[].sopId matched against each rendered ver.id — no remapping through canonical/current sop id, consistent with 36-06's per-version (not per-lineage) grouping"

key-files:
  created: []
  modified:
    - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
    - src/actions/versioning.ts
    - tests/phase36/version-breakdown-panel.spec.ts

key-decisions:
  - "Refresher interval input uses local state (refresherInput) synced from currentSop.refresher_interval_months via a useEffect, not a controlled derivation — needed because the value must remain editable mid-typing while still reflecting a freshly-saved value after loadVersions() re-runs"
  - "Save button disables only on savingRefresher (in-flight); the plan's threat model / T-36-09 note about never gating the control on competency/refresher-due/version-currency state is now mechanically enforced by a spec assertion scanning every disabled={} expression on the page"
  - "Outdated-version note only renders for non-current versions with completionCount > 0, using the page's existing isCurrent derivation (superseded_by === null && status === 'published'), not the breakdown's own isCurrent flag — keeps a single source of truth for 'current' on this page"

requirements-completed: [TRN-03, REF-01]

# Metrics
duration: ~20min
completed: 2026-07-27
---

# Phase 36 Plan 09: TRN-03 Completion Breakdown Panel + Refresher-Interval Control Summary

**Versions page now shows, per version, how many workers completed it (with an expandable worker list and an amber "trained on an outdated version" note for stragglers), and admins can set/clear the SOP's refresher interval from the same page — zero new admin routes added.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 (all auto)
- **Files modified:** 3 (page.tsx, versioning.ts, version-breakdown-panel.spec.ts)

## Accomplishments
- `loadVersions()` (lifted to a `useCallback` so it's reusable) now also calls `getVersionCompletionBreakdown(sopId)`; failures render as a message (`breakdownError`), never a silent empty panel
- Each version row renders a completion-count line (explicit zero state: "No completions on this version"), an `aria-expanded` toggle revealing the distinct-worker list (name + completion date), and — for non-current versions with completions — an amber `--accent-voice` "trained on an outdated version" note; framed as coaching only, no write/force-re-walk affordance added
- Refresher-interval control (`number` input, `min=1 max=120`, Save + "Turn off") added to the action-button row, wired to `await setRefresherInterval(currentSop.id, months)` with `null` for the clear path; on success `loadVersions()` re-runs so the input reflects the persisted value; helper copy states the D-01/D-02 distinction (worker re-walk cadence, separate from the document review cycle, off = no prompts) in plain language
- `getVersionHistory`'s `sops` select and `VersionRecord` widened with `refresher_interval_months` — a two-line additive change to the page's existing data source, no second fetch
- `tests/phase36/version-breakdown-panel.spec.ts` fully de-skipped (0 `test.skip`); 3 new panel-side assertions added: the `setRefresherInterval` handler is wired (`await setRefresherInterval(` present, not just imported), the completion summary + `aria-expanded` control render, and no `disabled={}` expression on the page references a competency/refresher-due/version-currency field

## Task Commits

1. **Task 1: TRN-03 completion-breakdown panel** + **Task 2: Refresher-interval control** - `f10ef70` (feat) — combined into one commit; see Deviations
2. **Task 3: Activate the TRN-03 panel assertions live** - `e0d07f5` (test)

## Files Created/Modified
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` - completion breakdown panel + refresher-interval control wired in
- `src/actions/versioning.ts` - `refresher_interval_months` added to `getVersionHistory` select + `VersionRecord`
- `tests/phase36/version-breakdown-panel.spec.ts` - guards removed, 3 new panel-wiring assertions added

## Decisions Made
- Combined Tasks 1 and 2 into a single commit: both edit `page.tsx` and the breakdown-panel UI and refresher-control UI are interleaved in the same render tree (version rows vs. action-button row), so splitting the diff by task would have required hunk-level surgery with no functional benefit. Task 2's `versioning.ts` change rode along in the same commit since it's a two-line prerequisite for the control to read a persisted value. Same commit-boundary trade-off documented in 36-06's summary.
- Kept the page's existing `isCurrent` derivation as the single source of truth for "current" rather than introducing the breakdown's own per-entry `isCurrent` flag, avoiding two competing definitions on one page.

## Deviations from Plan

### Process note (not a code deviation)
Tasks 1 and 2 both modify `page.tsx` and were implemented together before the first commit checkpoint (same class of process note as 36-06). Task 1's and Task 2's code and tests are both fully present and verified; only the commit boundary doesn't map 1:1 to the plan's task list. No functional impact — see "Decisions Made" above.

### Auto-fixed Issues
**1. [Rule 1 - Bug] `setRefresherInterval` result narrowing used `.success` truthiness instead of `'error' in result`**
- **Found during:** Task 2, `npx tsc --noEmit`
- **Issue:** `setRefresherInterval` returns `{ success: true } | { error: string }` (no `success: false` branch); checking `!result.success` doesn't type-narrow to the error variant, so `result.error` failed to compile
- **Fix:** Changed both `handleSaveRefresher` and `handleClearRefresher` to branch on `'error' in result`
- **Files modified:** `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `f10ef70` (part of Task 1+2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug), plus 1 process note (commit-boundary only, no functional impact)
**Impact on plan:** No scope creep — the type-narrowing fix was required for the plan's own specified action signature to compile.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TRN-03 is now mechanically guarded end-to-end (action gate + org scope from 36-06, panel render + wired control from this plan) with zero remaining `test.skip` in `version-breakdown-panel.spec.ts`.
- `npx playwright test --project=phase36` green (53 passed, 1 pre-existing unrelated skip for Plan 36-10's own runtime probe); `npx tsc --noEmit` and `npm run build` both clean; bundle delta `/sops/[sopId]/page` +2 KB (within the ±2 KB tolerance, worker-facing route unaffected since all new code is on the admin-only versions page).
- Manual post-deploy check still recommended per the plan's verification section: set an interval, reload, confirm persistence; expand a superseded version and confirm the worker list renders.

---
*Phase: 36-refresher-cadence-version-currency*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
- FOUND: src/actions/versioning.ts
- FOUND: tests/phase36/version-breakdown-panel.spec.ts
- FOUND commit: f10ef70
- FOUND commit: e0d07f5
