---
phase: 35-competency-classifier-training-matrix-records
fixed_at: 2026-07-24T02:10:00Z
review_path: .planning/phases/35-competency-classifier-training-matrix-records/35-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 35: Code Review Fix Report

**Fixed at:** 2026-07-24T02:10:00Z
**Source review:** .planning/phases/35-competency-classifier-training-matrix-records/35-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (fix_scope: critical_warning — CR-01, WR-01..WR-07; IN-* excluded)
- Fixed: 8
- Skipped: 0

All fixes were made in an isolated worktree and fast-forwarded onto `master`. Post-fix gates all green: `npx tsc --noEmit` clean, `npx playwright test --project=phase35 --project=phase35-unit` 87 passed / 4 skipped (the deliberately-fixme'd live-UAT RLS probes), `npm run build` clean including the postbuild bundle-size checks.

## Fixed Issues

### CR-01: CSV formula injection — exported fields not sanitized against Excel formula execution

**Files modified:** `src/lib/competency/csv.ts`, `src/lib/competency/__tests__/csv.test.ts`
**Commit:** 1a6fccf
**Applied fix:** `csvField()` now prefixes fields starting with `=`, `+`, `-`, `@`, tab or CR with an apostrophe (neutralizing Excel/Sheets formula execution) and force-quotes on bare `\r` per RFC 4180. Added unit cases: `=HYPERLINK(...)` neutralization (including quote-doubling interaction), `+`/`-`/`@` prefixes, and bare-CR quoting.

### WR-01: `dateTo` end-date effectively exclusive — To-day completions silently dropped from audit export

**Files modified:** `src/lib/validators/competency.ts`, `src/actions/competency.ts`
**Commit:** b84aea1
**Applied fix:** `exportTrainingCsv` now compares `lt('submitted_at', nextDayIso(dateTo))` (midnight of the following day, exclusive) so the whole To-day is included. `dateFrom`/`dateTo` are validated as strict `YYYY-MM-DD` with a human-readable message, so junk strings never reach PostgREST.

### WR-02: Matrix fetch has no cancellation — rapid filter/department changes can render a stale cut

**Files modified:** `src/components/admin/competency/TrainingMatrixView.tsx`
**Commit:** d83dd99
**Applied fix:** Both `getTrainingMatrix` effects (filter-options fetch and filtered-matrix fetch) now use the `cancelled`-flag idiom already used by `TrainingRecordSection`, so an earlier slower response can never overwrite a later selection.

### WR-03: Action errors swallowed into misleading empty states in both consumers

**Files modified:** `src/components/admin/competency/TrainingMatrixView.tsx`, `src/components/admin/competency/TrainingRecordSection.tsx`
**Commit:** d71ae41
**Applied fix:** Both components gained a `fetchError` state rendered as a visible message (amber, matching the existing `exportError` presentation). The matrix's "No people with required SOPs in this cut." empty state is now gated on `!fetchError`; the options effect clears stale filter options on error; `TrainingRecordSection` no longer renders a silently blank panel on `{ error }`. Spec constraints preserved: no `disabled=` introduced (CMP-04 blanket assertion), handler shapes untouched.

### WR-04: Classifier could emit `read` / "Read only" for a worker who never completed the SOP

**Files modified:** `src/lib/competency/classify.ts`, `src/lib/competency/__tests__/classify.test.ts`
**Commit:** 81524c7
**Applied fix:** The D-02 needs_support reset now floors at `ev.hasCompletion ? 'read' : 'not_started'` (per the review fix and the phase verifier's independent confirmation) — an observed-but-never-completed worker resets to `not_started` + flag instead of a fabricated "Read only". D-02 header and inline comments corrected. Added the two missing unit cases: observation-only + newer needs_support → `not_started` + flag; completion + observation + newer needs_support → `read` + flag. Status note: behavioral logic change — covered by new unit tests (green), but flagged **fixed: requires human verification** for product-intent confirmation that the reset floor semantics match D-02 intent.

### WR-05: `resolveDisplayNames` caps at 1,000 auth users — silently corrupts matrix names and CSV identity columns

**Files modified:** `src/actions/competency.ts`, `src/actions/observations.ts`
**Commit:** a95e51f
**Applied fix:** Both copies of `resolveDisplayNames` now page through `listUsers({ page, perPage: 1000 })` until every requested id is resolved or pages are exhausted (also replacing the O(n·m) `ids.includes` scan with a Set). Applied to `observations.ts` in the same commit per the review's systemic-pattern note (CLAUDE.md rule 5).

### WR-06: `getMyCompetencyStates` leaks cross-org requirements into the profile as phantom "Untitled SOP" rows

**Files modified:** `src/actions/competency.ts`
**Commit:** 89e5b65
**Applied fix:** Applied the review's intersection variant — the org-RLS-scoped `sops` read now defines `scopedSopIds = requiredSopIds.filter(id => sopById.has(id))`, used for the completions/observations reads and the final map. Foreign-org requirements can no longer render on /profile; the function stays admin-client-free and RECORDER_ROLES-free (pinned by `competency-actions.spec.ts`, still green).

### WR-07: RLS probe suite asserts nothing even when un-fixme'd

**Files modified:** `tests/phase35/competency-rls-probe.spec.ts`
**Commit:** 1d8eeae
**Applied fix:** Took the review's second sanctioned option: each probe body now ends in a deliberate tripwire failure (`expect(false, 'TRIPWIRE — Probe N body not implemented...').toBe(true)`) naming exactly what must be written, and the header activation instruction now states the real assertions must be WRITTEN before removing the fixme guards. An un-fixme'd placeholder now fails loudly instead of reading as green RLS coverage. Rationale for not implementing the PostgREST probe bodies now: the reviewer's suggested Probe-1 PostgREST equivalent ("supervisor session reads sop_access_people and asserts rows") would assert the opposite of the actual migration-00046 RLS design (supervisor is excluded from that branch by design — which is why the action uses the admin client), so writing probes without a live schema round-trip risked enshrining wrong assertions; the tripwire keeps the file honest until the live-UAT pass writes them.

## Skipped Issues

None — all in-scope findings were fixed.

## Verification

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | clean (exit 0) |
| `npx playwright test --project=phase35 --project=phase35-unit` | 87 passed, 4 skipped (fixme'd live-UAT probes) |
| `npm run build` (incl. postbuild bundle checks) | clean |

Info-tier findings (IN-01..IN-06) were out of scope (`fix_scope: critical_warning`) and remain open in 35-REVIEW.md. Note for a future pass: IN-01 (delete `callerOrgId`) requires repointing the `competency-actions.spec.ts` assertions that pin `callerOrgId(` in the same commit.

---

_Fixed: 2026-07-24T02:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
