---
phase: 36-refresher-cadence-version-currency
verified: 2026-07-28T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 36: Refresher Cadence + Version-Currency Verification Report

**Phase Goal:** A SOP version supersede surfaces "trained on an outdated version" instead of silently orphaning competency history, and due/overdue refresher re-walkthroughs surface to workers and supervisors — both derived from the same cadence/version-lineage math the governance queue already uses. Promotes backlog 999.7.
**Verified:** 2026-07-28
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | A SOP version supersede surfaces "trained on outdated version" rather than resetting/orphaning competency history | ✓ VERIFIED | `resolveLineage()` (`src/lib/competency/lineage.ts`) widens every evidence read (matrix, training record, self-state, CSV export) across a SOP's flat version lineage and maps evidence onto the canonical current id; `isOutdatedVersion()` (`src/lib/competency/version-currency.ts`) flags `latestCompletionVersion < currentVersion` without altering the classified state. Proven against the **live remote DB**, not just source inspection: `tests/phase36/version-currency-lineage.spec.ts` creates a real org, a real SOP, a real v1 completion, performs a real supersede to v2, and asserts the v1 completion still surfaces as evidence under the v2 read with `isOutdatedVersion: true` — this test passed (1.6s, real network round-trips). |
| 2 | SOP detail (admin) shows which workers completed the current version vs. a prior version | ✓ VERIFIED | `getVersionCompletionBreakdown()` (`src/actions/competency.ts`) returns per-lineage-version completion counts + worker names, gated to admin/safety_manager, self-scoped to org. Wired into `versions/page.tsx`: renders a per-version completion-count row with an expandable worker list and an "isCurrent" flag computed off `superseded_by === null && status === 'published'` (fixed under WR-01 to exclude in-flight drafts). `tests/phase36/version-breakdown-panel.spec.ts` (8 assertions) confirms export, gating, org-scoping, read-only posture, and real UI wiring — all pass. |
| 3 | Refresher due/overdue re-walkthroughs surface to workers and supervisors, computed from last completion + per-SOP cadence | ✓ VERIFIED | `refresherDueDate()`/`isRefresherDue()`/`isRefresherOverdue()` (`src/lib/competency/refresher.ts`) delegate to the existing `computeReviewDueDate` (Phase 28 governance cadence math). Supervisor surface: `StatePill.tsx` renders a "Refresher due"/"Refresher overdue" chip fed by lineage-widened matrix/record data (`matrix.ts` `outdatedCount`/`refresherOverdueCount` rollups, appended not substituted). Worker surface: `sops/page.tsx` computes the same predicate from a lineage-root-keyed last-completion map (fixed under WR-03 so the clock survives a supersede) and renders via `SopLibraryCard`'s `data-refresher-due-badge`. `isRefresherDue` carries a real 14-day lead window (`REFRESHER_DUE_WINDOW_DAYS`, fixed under WR-04) so "due" is reachable before escalating to "overdue". Admin can set/clear the interval on the live-published current version (`setRefresherInterval`, fixed under WR-01 to target the published row, not an in-flight draft) and it is copied forward on both `uploadNewVersion` and `cloneSopAsDraft`. |
| 4 | Refresher state never blocks worker access — informational only | ✓ VERIFIED | `tests/phase36/no-refresher-gate.spec.ts` mechanically greps every worker-touching file (ReadTab, worker SOP detail, profile CompetencySection, SopLibraryCard, worker library page, StatePill, TrainingRecordSection, TrainingMatrixView) for any comparison/if-branch/bare-ternary on the new derived fields, plus a stricter check that the chip markup itself carries no `disabled=`/`onClick`. Guard's own self-check (matches real gates, does not match passive JSX/label-ternary syntax) passed, and the regex was hardened under WR-06 after a real gap was found (bare `=` false-positive class + a weaker sibling guard in `worker-library-chip.spec.ts` that would have let an `===` gate through) — both now share one corrected `GATE_PATTERN`, proven by temporarily inserting a real gate and confirming both specs turn red. All 8 target files pass with zero gates. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/competency/lineage.ts` | `resolveLineage()` deriving currency from published lineage members | ✓ VERIFIED | Plain module (moved out of `'use server'` under WR-07 — was a POST-invokable public endpoint). Currency/interval keyed off highest-version **published** member per root (CR-01 fix); drafts excluded. |
| `src/lib/competency/version-currency.ts` | `isOutdatedVersion()` pure helper | ✓ VERIFIED | Null-safe, monotonic integer comparison, unit-tested (`version-currency.test.ts`). |
| `src/lib/competency/refresher.ts` | `refresherDueDate`/`isRefresherDue`/`isRefresherOverdue` pure helpers | ✓ VERIFIED | Delegates date math to `computeReviewDueDate`; `isRefresherDue` has a real 14-day lead window (WR-04 fix), unit-tested. |
| `src/lib/competency/matrix.ts` | Outdated/refresher-overdue tallies appended to rollups | ✓ VERIFIED | `outdatedCount`/`refresherOverdueCount` on row+column rollups, additive not substitutive (confirmed by `matrix-chips-and-axis-swap.spec.ts`). |
| `src/lib/competency/csv.ts` + `competency.ts` export | `on_current_version`/`refresher_due_date` CSV columns | ✓ VERIFIED | Populated via `resolveLineage`; CR-01 fixed the export-cut baseline bug; WR-05 fixed the SOP-filtered export to widen across lineage; IN-02 (timestamp vs date format) deliberately left as Info, out of fix scope. |
| `src/actions/competency.ts` `getVersionCompletionBreakdown` | Per-version worker completion breakdown, admin-gated | ✓ VERIFIED | Gated to `['admin','safety_manager']`, org-self-scoped, read-only (no write calls) — confirmed by `version-breakdown-panel.spec.ts`. |
| `src/actions/governance.ts` `setRefresherInterval` | Admin can set/clear per-SOP interval, range 1..120, RLS-enforced | ✓ VERIFIED | Runs on the plain session client (rides `admins_can_update_sops` RLS, never admin-client bypass), range-validated, zero-row-not-found handled — confirmed live against remote DB per 36-03 plan and `refresher-interval-write.spec.ts`. |
| `supabase/migrations/00055_sops_refresher_interval.sql` | `sops.refresher_interval_months` nullable, range-constrained column | ✓ VERIFIED | Idempotent, constraint-checked; `scripts/apply-phase36-migration.mjs` bypasses PostgREST schema-cache staleness for post-apply assertions (2026-06-15 learning applied). |
| `src/components/admin/competency/StatePill.tsx` | "Outdated version"/refresher chips beside existing pill, informational, coaching-toned | ✓ VERIFIED | Additive siblings, no `onClick`/`disabled`, orange (`--accent-voice`)/amber (`--accent-decision`) — never red-alarm. All referenced CSS vars declared in `blueprint-theme.css` (test-confirmed). |
| `src/components/sop/SopLibraryCard.tsx` | Worker-facing refresher chip, no-interval = no chip | ✓ VERIFIED | `data-refresher-due-badge` renders only when `isRefresherDue`; `isRefresherDue`/`isRefresherOverdue` default `false` (D-02 zero-noise). |
| `src/app/(protected)/sops/page.tsx` | Worker library computes refresher state from own completions, lineage-root-keyed | ✓ VERIFIED | WR-02 fix: query explicitly `.eq('worker_id', user.id)` (was relying on an RLS assumption that's false for admin/supervisor/safety_manager sessions). WR-03 fix: completion clock keyed by `parent_sop_id ?? id` so it survives a supersede-triggered assignment repoint. |
| `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` | Per-version completion breakdown + refresher interval control | ✓ VERIFIED | WR-01 fix: `currentSop`/refresher-control target predicate now matches the row-level "Current" badge (`superseded_by === null && status === 'published'`), so an in-flight unpublished draft can no longer silently absorb the admin's refresher-interval write. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `competency.ts` (matrix/record/self/CSV reads) | `lineage.ts` `resolveLineage()` | import + call | ✓ WIRED | Confirmed by `lineage-widening.spec.ts` (batched query check, org-scoping check, no-admin-client check for `getMyCompetencyStates`). |
| `versions/page.tsx` | `getVersionCompletionBreakdown` | import + `useEffect` call | ✓ WIRED | `version-breakdown-panel.spec.ts` confirms import, call-site, and that the save handler is not empty. |
| `versions/page.tsx` | `setRefresherInterval` | Save/Clear button `onClick` | ✓ WIRED | Handler present and non-empty; targets the corrected `currentSop` id post-WR-01. |
| `sops/page.tsx` | `refresherDueDate`/`isRefresherDue`/`isRefresherOverdue` | import + `refresherState()` helper | ✓ WIRED | `worker-library-chip.spec.ts` confirms the import and that `<SopLibraryCard>` receives both fields from real computed values, not hardcoded. |
| `versioning.ts` (`uploadNewVersion`, `cloneSopAsDraft`) | `refresher_interval_months` column | select + insert payload copy-forward | ✓ WIRED | `refresher-interval-write.spec.ts` confirms the field appears ≥4 times (two selects, two insert payloads) and both supersede paths carry it forward independently. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `StatePill` outdated/refresher chips | `result.isOutdatedVersion` / `result.refresherDueAt` | `matrix.ts` `buildMatrix()` cells, fed by `resolveLineage()` + real `sop_completions`/`sops` rows via `getTrainingMatrix`/`getTrainingRecordForPerson` | Yes — live-probe (`version-currency-lineage.spec.ts`) creates real rows and confirms the flag flips correctly across a real supersede | ✓ FLOWING |
| `SopLibraryCard` refresher badge | `isRefresherDue`/`isRefresherOverdue` props | `sops/page.tsx` `refresherState()`, sourced from real `sop_completions`/`sops` queries scoped to the authenticated worker | Yes — query explicitly filters `worker_id = auth.uid()` (WR-02 fix); no hardcoded/static fallback | ✓ FLOWING |
| `versions/page.tsx` breakdown panel | `breakdown.versions[].workers` | `getVersionCompletionBreakdown` real `sop_completions` join, admin/org-scoped | Yes — read-only real query, confirmed no-write by test | ✓ FLOWING |
| CSV export `on_current_version`/`refresher_due_date` | `lineage.currentVersionBySopId`/`refresherIntervalBySopId` | `resolveLineage()` over real completion rows in the export cut | Yes — CR-01 fix specifically corrected this to derive from the highest published lineage member rather than the export cut's own (possibly stale) rows | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full type-check | `npx tsc --noEmit` | Clean, no output | ✓ PASS |
| Production build | `npm run build` | Clean; bundle-size gates OK (walkthrough/source-viewer/Konva isolation all pass) | ✓ PASS |
| Phase 36 + Phase 35 + Phase 35-unit suite | `npx playwright test --project=phase36 --project=phase35 --project=phase35-unit` | 179 passed (includes 2 live-remote-DB probes: `competency-rls-probe.spec.ts` Probe 4, `version-currency-lineage.spec.ts` orphaning scenario) | ✓ PASS |

### Probe Execution

Not applicable in the `scripts/*/tests/probe-*.sh` sense — this phase's live-runtime evidence is delivered via Playwright specs against the real remote Supabase database (`tests/phase35/competency-rls-probe.spec.ts`, `tests/phase36/version-currency-lineage.spec.ts`), executed above under Behavioral Spot-Checks and confirmed passing with real network round-trips (1.1s and 1.6s respectively — consistent with live DB calls, not mocked).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| CMP-03 | 36-01,02,04,05,06,07,10 | A SOP version supersede surfaces "trained on outdated version" rather than resetting/orphaning competency history | ✓ SATISFIED | Truth #1 above; live-DB orphaning probe passes. |
| TRN-03 | 36-06,07,09,10 | Admin can see which workers completed the current vs a prior version after a supersede | ✓ SATISFIED | Truth #2 above; `getVersionCompletionBreakdown` + versions-page panel. |
| REF-01 | 36-01,02,03,04,06,07,08,09,10 | Refresher cadence per SOP surfaces due/overdue re-walkthroughs to workers and supervisors — never blocking access | ✓ SATISFIED | Truths #3/#4 above; `no-refresher-gate.spec.ts` mechanical guard, 0 gates found across 8 target files. |
| REF-02 | 36-01,02,03,04,06,10 | Refresher due-dates derive from last completion + cadence via the existing governance cadence helpers | ✓ SATISFIED | `refresherDueDate()` delegates to `computeReviewDueDate` (Phase 28), no second date implementation (D-03). |

No orphaned requirements — REQUIREMENTS.md maps exactly CMP-03/TRN-03/REF-01/REF-02 to Phase 36, and all 4 appear in plan frontmatter with matching evidence.

### Anti-Patterns Found

None. Grepped all Phase-36-touched files (`src/lib/competency/*`, `src/actions/competency.ts`, `src/app/(protected)/sops/page.tsx`, `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx`, `src/components/sop/SopLibraryCard.tsx`, `src/components/admin/competency/StatePill.tsx`) for `TBD|FIXME|XXX|HACK|PLACEHOLDER` and placeholder-prose patterns — zero matches. Prior code review (`36-REVIEW.md`) found 1 Critical + 7 Warnings; all 8 were fixed in atomic commits (`017c256`..`308f929`) and independently re-verified above as real, non-cosmetic fixes (not just SUMMARY claims). 4 Info-tier findings were deliberately left unfixed (out of scope per review triage) — none affect goal achievement:
- IN-01: `getVersionCompletionBreakdown.isCurrent` field is caller-relative (UI doesn't consume it that way — no user-visible defect today).
- IN-02: CSV `refresher_due_date` emits a full ISO timestamp instead of a date-only string — cosmetic.
- IN-03: minor duplicated `latestOf` reducer across two modules — maintainability only.
- IN-04: `resolveLineage`'s `.or()` filter built by string interpolation of DB-sourced UUIDs — no injection path today (inputs are never user-supplied).

### Human Verification Required

None. All 4 truths are verified via a combination of static wiring checks, unit tests, and live-remote-database Playwright probes that exercise the real shipped code against real data (not source-contract greps alone). The chip visual styling was confirmed via a CSS-token-declaration test (`every var(--...) token referenced is declared in blueprint-theme.css`), which mechanically catches the 2026-07-14 undefined-CSS-token class of bug that would otherwise require an eyeball check.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria verified against the live codebase (not SUMMARY claims): version-lineage evidence widening is proven against a real supersede on the live database; the admin version-breakdown panel is real and wired; refresher due/overdue chips surface to both workers and supervisors from real per-user/per-SOP data; and the informational-only guard mechanically proves zero gating branches across every worker-facing file the phase touched. The prior code review's 1 Critical + 7 Warnings were the substantive risk in this phase (particularly CR-01, which would have shipped a false "trained on current version" claim in the auditor-facing CSV export) — all were verified fixed with real code changes, not just SUMMARY narrative, and the regression suite (179 tests, including 2 live-DB probes) passes clean alongside `tsc`/`next build`.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
