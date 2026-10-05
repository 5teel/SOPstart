---
phase: 58-the-sop-focus-screen-walk-edit
fixed_at: 2026-10-05T14:30:00Z
review_path: .planning/phases/58-the-sop-focus-screen-walk-edit/58-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 58: Code Review Fix Report

**Fixed at:** 2026-10-05
**Source review:** .planning/phases/58-the-sop-focus-screen-walk-edit/58-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 critical, 7 warning; Info findings out of scope)
- Fixed: 9
- Skipped: 0

Fixes were made on the main working tree (`master`) rather than a worktree: the live migration needs `.env`, and a worktree checkout CRLF-smudges source files on this machine (CLAUDE.md 2026-07-18) — which bit once anyway, see Notes. Nothing was pushed.

## Fixed Issues

### CR-01: Workers can write `sop_walks.acks` / `done` / `photos` directly

**Files modified:** `supabase/migrations/00072_sop_walks_server_written.sql` (new), `src/actions/walk.ts`, `scripts/apply-phase58-migration.mjs`, `tests/phase58/focus-rls-live.spec.ts`, `tests/phase58/walk-actions.spec.ts`, `tests/phase58/capability-matrix.spec.ts`, `.planning/codebase/CAPABILITY-MATRIX.md`
**Commit:** 030f1db2
**Applied fix:** 00072 drops `workers_can_start_own_sop_walks` and `workers_can_update_own_sop_walks`; the own-row SELECT stays. Applied live via `supabase db push` (history 00001..00071 was clean) and asserted through the Management API: `sop_walks` now carries exactly one policy, `workers_can_view_own_sop_walks SELECT`. Every `sop_walks` read/write in `walk.ts` goes through `createAdminClient()` with the existing `organisation_id` + `worker_id` session filters; the `sops` reads stay on the session client. The photo branch lists `completion-photos/{org}/completions/{walkId}` for `{localId}.{ext}` and refuses "That photo did not finish uploading." when absent. The applier lists 00072 after 00071 and its policy assertion now expects the single SELECT. Live spec test 2 flipped to: own-row insert refused, forged `done`/`status` PATCH on the worker's own row is a zero-row deny (re-read with the service client), peer row untouched, service-role update (the action's channel) succeeds — run ONCE, 8/8. Capability matrix row rewritten ("written by the server only", names 00072 and `createAdminClient()`), spec repointed. `rls-org-scope` 3/3 (drops are order-aware).

### CR-02: `recordSignature({ role: 'worker' })` lets any org member sign another worker's completion

**Files modified:** `src/actions/completions.ts`, `tests/phase58/walk-actions.spec.ts`
**Commit:** 8e1e755d
**Applied fix:** The completion read selects `worker_id`; after the org check, `role === 'worker' && completion.worker_id !== userId` returns "Only the worker who did this walk can sign it." The supervisor branch and the `submitCompletion` call site are unchanged (the reviewer's "narrow the schema to supervisor" alternative would have moved the writer out of `decision-writers.json` and three source-contract specs for no extra safety). Pinned: the check sits before the `sop_completion_signatures` insert.

### WR-01: `forkDraft` drops six `sops` columns on the new version

**Files modified:** `src/actions/versions.ts`, `tests/phase58/fork-draft.spec.ts`
**Commit:** 740a1497
**Applied fix:** `source_type`, `all_departments`, `all_departments_pre_override`, `overall_confidence`, `parse_notes`, `pipeline_run_id` are now copied (the first three via a narrow cast — the hand-maintained types do not carry them — and the insert goes through the untyped `db` handle). New spec test walks `create table public.sops` plus every `alter table sops add/drop/rename column` in migration order (43 columns found), subtracts a reasoned skip-list (id, timestamps, status, version, lineage, uploaded_by, placement, approval, review cadence, fts) and fails on any column not inserted — mutation-proven by removing `pipeline_run_id`.

### WR-02: `forkDraft` does not copy `sop_image_annotations`

**Files modified:** `src/actions/versions.ts`, `tests/phase58/fork-draft.spec.ts`
**Commit:** e58cc151
**Applied fix:** Image ids are generated up front (`imageIds[i]`, map by array index — same idiom as sections/steps); annotation rows for the source images are read by `organisation_id` + `sop_image_id in (...)` and inserted against the new image ids. The table census now walks the transitive key graph from `sops(id)` (a table referencing a table already in the set), which surfaced seven second-level tables: `sop_image_annotations` is COPIED; `sop_steps`, `sop_section_blocks`, `sop_block_update_decisions`, `completion_photos`, `completion_sign_offs`, `sop_completion_signatures` are classified with reasons.

### WR-03: A partial reviewer run retires open findings from jobs that did not run

**Files modified:** `src/lib/parsers/ai-reviewer/orchestrator.ts`, `tests/phase58/reviewer-steps.spec.ts`
**Commit:** 30ac2dc2
**Applied fix:** `persistFindings` takes the requested job list; the retire delete adds `.in('job', [...jobsRequested, 'all'])` so only re-checked jobs (plus the `all_clear` markers) are retired. The `jobs` body parameter stays (the orchestrator is now correct for any caller). The same line replaces `.neq('run_id', runId)` with `.or('run_id.is.null,run_id.neq.<runId>')`, which closes IN-05 at no cost. Spec literal repointed.

### WR-04: `reparseSop` / `restructureSop` still rewrite a published SOP; `restructureSop` has no role check

**Files modified:** `src/actions/sops.ts`, `tests/phase58/edit-actions.spec.ts`
**Commit:** bfe14593
**Applied fix:** Both select `status` and return `PUBLISHED_MSG` (imported from `src/lib/sop/editable.ts`) for a published SOP before any delete — `parsing`/`uploading` are still allowed since a failed job is the retry case, so `editableSop` itself was not changed. `restructureSop` now checks `admin`/`safety_manager`, resolves the SOP in the session org, and both actions stamp the new `parse_jobs` row with the session `organisationId` instead of the fetched row's. Pinned in the edit-actions "refused on published" test; phase40 `reparse-precondition` 12/12.

### WR-05: `useWalk` turns every server refusal into "Check your signal and tap again"

**Files modified:** `src/hooks/useWalk.ts`, `tests/phase58/walk-no-leak.spec.ts`
**Commit:** 930754f3
**Applied fix:** A `serverError(msg, fallback)` callback: "Start the walk again." and "That step is not part of this SOP." map to plain-words copy ("This walk was finished or started over somewhere else. Loading the latest." / "This SOP changed since you started. Loading the latest."), drop the local walk, return to browse and `router.refresh()` from the click handler (no effect, no `router.replace`); "Finish the steps before this one first." and "Add a photo to continue." pass through as written; anything else keeps `SAVE_ERROR` / `PHOTO_ERROR`. `start`, `complete`, `photo` and `startOver` all route through it.

### WR-06: Autosave failure state leaks from one SOP's editor into the next

**Files modified:** `src/hooks/useFocusAutosave.ts`, `tests/phase58/edit-ui.spec.ts`, `tests/phase55/worker-path-contract.spec.ts`
**Commits:** b69baed2, 467f777e
**Applied fix:** `pending` and `failures` entries carry a `sopId`; the mount effect sets `activeSopId` and drops every other SOP's entries (after that SOP's unmount flush); `settle()` reads only the active SOP's failures; a failed send for a SOP no longer on screen is not requeued. `queue(stepId, patch)` keeps its signature (tags with `activeSopId`). The phase55 spec that pinned the old `pending.set` literal was repointed in the same pass.

### WR-07: Walk-step photo retake and draft delete leave orphaned storage objects

**Files modified:** `src/actions/walk.ts`, `src/app/api/sops/[sopId]/route.ts`, `tests/phase58/walk-actions.spec.ts`, `tests/phase58/edit-actions.spec.ts`
**Commit:** 0886bfca
**Applied fix:** After the walk row is saved, a retake removes the replaced object (only when the path differs and sits under `{org}/completions/{walkId}/`); the remove is awaited (a fire-and-forget promise is cut off when the action returns) and its error is logged, never returned. The DELETE route lists `{org}/{sop}/steps` for step folders, lists each, and removes the files — inside the existing best-effort try/catch, so a storage error never fails the delete.

## Skipped Issues

None.

## Verification

- `npx tsc --noEmit`: clean after every fix.
- `npm run build`: clean; bundle gate Δ 0 KB on `/sops/[sopId]` (792) and `/` (831).
- `node scripts/apply-phase58-migration.mjs`: db push applied 00072, all post-apply assertions PASS.
- `PHASE58_LIVE=1 … focus-rls-live`: 8/8, run once.
- Projects: phase58 219 passed / 9 skipped; phase55 145; phase56 99 / 12 skipped; phase46 30; phase15-stubs 50 / 4 skipped; phase40 77 / 1 skipped; plus the sibling specs reading touched files (integration scp-ai-reviewer, wizard-sop-dept, phase33 delete-sop-org-scope, sb-auth-builder, sb-builder-infrastructure) 28 passed / 5 skipped.

## Notes

- `git checkout -- src/actions/versions.ts` (used to undo the WR-01 mutation probe) re-smudged the file to CRLF and reverted the then-uncommitted WR-01 edit; the edit was re-applied and the file normalised to LF before committing. Working-copy CRLF makes `strip()`-based specs see comments as code (2026-07-18 class).
- IN-05 is closed as a side effect of WR-03. IN-01..IN-04 and IN-06 were out of scope and untouched.
- The deployed eval (`npm run eval -- --phase 58`) was not run here (no push); the walk path now depends on the service-role channel, so the post-push eval is the end-to-end proof for CR-01.

---

_Fixed: 2026-10-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
