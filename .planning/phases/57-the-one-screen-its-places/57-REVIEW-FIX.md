---
phase: 57-the-one-screen-its-places
fixed_at: 2026-10-05T06:10:00Z
review_path: .planning/phases/57-the-one-screen-its-places/57-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 57: Code Review Fix Report

**Fixed at:** 2026-10-05T06:10:00Z
**Source review:** .planning/phases/57-the-one-screen-its-places/57-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01..WR-06; Info findings out of scope except IN-01, folded into WR-05's commit)
- Fixed: 5 (WR-01, WR-02, WR-03, WR-04, WR-05) + IN-01
- Skipped: 1 (WR-06, by orchestrator decision)

**Gates after all fixes:**
- `npx tsc --noEmit`: clean
- `npm run build` + postbuild bundle gate: `/page` 831 KB (Δ 0 KB), `/sops/[sopId]/page` 795 KB (Δ 0 KB); baseline untouched
- `npx playwright test --project=phase57 --project=phase52 --project=phase54 --project=phase15-stubs`: 341 passed, 5 skipped (live-DB specs gated on `PHASE57_LIVE` / env)
- Not pushed; STATE.md / ROADMAP.md / `.bundle-baseline.json` untouched

## Fixed Issues

### WR-01: Smoko room shows OTHER people's walks as "on your record" for supervisors and admins

**Files modified:** `src/hooks/useCompletions.ts`
**Commit:** cade907d
**Applied fix:** Root-cause fix in the shared hook. `useWorkerCompletions` now reads `supabase.auth.getUser()` and adds `.eq('worker_id', user.id)` (returns `[]` with no user). All three callers (`SmokoBody`, `OfficeWorkerBody`, `/activity` `WorkerActivityView`) want "my own completions" semantics, so none needed a separate hook. Header comment updated to say RLS is not a self-scope.

### WR-02: "Waiting for sign-off" counts are computed from a 100-row list, so they under-count

**Files modified:** `src/hooks/useCompletions.ts`, `src/components/shell/WorkerShell.tsx`, `src/components/shell/AdminShell.tsx`, `tests/phase57/one-query.spec.ts`
**Commit:** 69122695
**Applied fix:** New `usePendingSignOffCount(enabled = true)` hook: `select('id', { count: 'exact', head: true }).eq('status', 'pending_sign_off')` via the session client (RLS scopes to the supervisor's workers / the org). `WorkerShell` (`pending`, supervisor-only) and `AdminShell` (`pendingSignOffs`) both read it, so the Office pin, card, body and summary line share one number. The spec that pinned the old list-filter literal was repointed in the same commit and now asserts the hook is a head count with no `.limit(`. `shell.ts` was deliberately not touched (the "completions stay out of the inbox count" guard greps it for `/completion/i`).
**Not changed:** `OfficeWorkerBody`'s per-status counts for a worker still come from the worker's own 50 most recent rows (`useWorkerCompletions`). Correct for a worker under 50 walks; noted as a known ceiling, not fixed here.

### WR-03: A floor-read failure renders as "The site has not been drawn yet" with a Draw button

**Files modified:** `src/actions/shell.ts`, `src/components/shell/AdminShell.tsx`
**Commit:** 98ec2854
**Applied fix:** `AdminShellData` gains `floorError: string | null`; `getAdminShell` sets it from `inbox.floor.error` instead of silently flattening. `AdminShell.loadError` now falls through to `data?.floorError`, and `ShellFrame` receives `loading={isLoading || loadError !== null}` so a failed read holds the stage blank (no `shell-no-site` empty state, no "Draw the site") while the card slot shows the error alert. This also closes the same shape for a whole-read `shell.error`, which previously rendered the empty state beside the alert. Token-only styling (existing `text-accent-escalate` alert).

### WR-04: The camera re-fits to the whole site whenever the signed scene URL rotates

**Files modified:** `src/components/sop/plant/PlantStage.tsx`, `src/components/shell/AdminShell.tsx`
**Commit:** f42d859c
**Applied fix:** `PlantStage`'s mount-fit effect depends on `[sceneWidth, sceneHeight]` only (comment explains why `sceneUrl` is excluded). `SHELL_KEY` query gets `staleTime: 30 * 60 * 1000`, matching the worker `['site-worker']` read; the worker query does not disable `refetchOnWindowFocus`, so neither does this one (a 30-min staleTime means focus refetches are a no-op until stale). `QueryProvider` is created per `/` mount, so navigating back from the builder/governance still refetches the inbox counts.

### WR-05: Department removal ignores member and content links, leaving orphaned junction rows

**Files modified:** `src/actions/departments.ts`, `src/components/admin/site/DepartmentsStrip.tsx`, `tests/phase57/departments.spec.ts`
**Commit:** c9b1b6d4
**Applied fix:** `archiveDepartment` now also head-counts `member_departments` and `block_departments` by `department_id` and returns `{ error: 'Still in use', machines, sops, people, blocks }`. Client choice: session client (no service-role) — `member_departments_self_read` has an admin/safety_manager arm and `block_departments_read_all_auth` is `using (true)`, and the department is already proven in-org by the preceding lookup, so no org-scoped service read module was needed (and the "no createAdminClient inside the department bodies" guard stays satisfied). Strip copy now reads "still used by N machines, N SOP rules, N library items and N people" (keeps the `/\d+ SOP rules?/` phrase the deployed eval asserts; "library item" rather than "block" per the plain-words rule). Spec extended to pin both new junction reads before the archive write and both new strip fields.
**Also in this commit (IN-01, one line, same file):** `setDepartmentOwner`'s update now carries `.eq('organisation_id', ctx.organisationId)` like its siblings. The "treat empty result as not found" half of IN-01 was not done (would need a `.select()`; RLS already makes a foreign id a no-op).

## Skipped Issues

### WR-06: The `/page` bundle baseline was raised in-phase (792 → 831 KB) without the ROADMAP record the gate requires

**File:** `scripts/check-bundle-size.ts:18-39,228-234`, `.bundle-baseline.json`
**Reason:** Skipped by orchestrator instruction — the orchestrator records the 831 KB decision in ROADMAP. The fixer did not touch `.bundle-baseline.json`, STATE.md or ROADMAP.md.
**Original issue:** Baseline moved 792 → 565 → 831 within Phase 57 with the authorising note living only inside the baseline file; the gate's own rule requires a ROADMAP record.

### Info findings not applied

- IN-02 (wizard drops a failed machine link), IN-03 (two Back affordances), IN-05 (fixture `listUsers` page): out of scope, files not otherwise edited.
- IN-04 (`loading="lazy"` on the scene image): one-liner in a file I was editing, but `tests/phase52/plant-stage.spec.ts:132` pins `loading="lazy"` — changing a sibling phase's guard is beyond this pass. Left as-is.

---

_Fixed: 2026-10-05T06:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
