---
phase: 58-the-sop-focus-screen-walk-edit
plan: 15
subsystem: guards
tags: [source-contract-guards, repoint, focus-screen, no-gate, dead-control-net, bulk-verify-lock]
requires: [58-14]
provides:
  - "every surviving worker-side guard reads the focus page, frame, walker, walk steps, review/send panels, useWalk and walk.ts"
  - "every surviving admin-side guard reads the focus editor (page edit branch, FocusEditor seam, PublishBar, focus-steps actions)"
  - "dead-control net on src/components/focus (every button carries a handler) and a tick-all phrase ban, both mutation-proven"
  - "58-15 added to LIVE_PLANS in the phase58 repoint inventory"
affects: [58-16, 58-18]
key-files:
  modified:
    - tests/phase28/library-and-worker.spec.ts
    - tests/phase29/phase-gate.spec.ts
    - tests/phase30/dead-weight.spec.ts
    - tests/phase30/governance-fold.spec.ts
    - tests/phase32/wire-up-mode.spec.ts
    - tests/phase35/no-competency-gate.spec.ts
    - tests/phase36/no-refresher-gate.spec.ts
    - tests/phase37/no-competency-gate-worker.spec.ts
    - tests/phase40/dup04-page-shell.spec.ts
    - tests/phase40/parse-status-no-navigate-after-unmount.spec.ts
    - tests/phase41/nav-and-shim.spec.ts
    - tests/phase43/route-truth.spec.ts
    - tests/phase43/dead-controls.spec.ts
    - tests/phase46/sop-edit-guard-wiring.spec.ts
    - tests/phase54/library-table.spec.ts
    - tests/phase54/inbox-reuses-governance-gating.spec.ts
    - tests/phase55/worker-path-contract.spec.ts
    - tests/phase56/decision-writers-sweep.spec.ts
    - tests/phase57/place.spec.ts
    - tests/sb-auth-builder.test.ts
    - tests/sb-builder-infrastructure.test.ts
    - tests/sb-ux-blueprint.test.ts
    - tests/sb-ux-walkthrough.test.ts
    - tests/lint/no-bulk-verify-ui.spec.ts
    - tests/phase58/repoint-inventory.spec.ts
    - .planning/codebase/ARCHITECTURE.md
key-decisions:
  - "A guard on a surviving behaviour is repointed to the focus file that now holds it, asserting both where it lives and that its caller calls it; assertions whose subject has no successor are dropped and listed below"
  - "Deletion guards in dead-weight walk src/ for the file name and for any code reference, so they stay meaningful after 58-16 removes the directories they used to read inside"
  - "no-bulk-verify-ui keeps its allow-list (the VerifyChecklistGate files still exist until 58-16) and gains the tick-all phrasings plus a coverage assertion that the scan reaches StepCard / EditDocument"
duration: one session
completed: 2026-10-05
---

# Phase 58 Plan 15: Surviving guards repointed onto the focus files Summary

Every guard that protects a behaviour surviving the cutover now reads the focus files; the only specs still reading the tabbed page, old walkthroughs or builder are the whole-subject ones 58-16 deletes. Two commits: `872c7d5a` (worker side), `ff558728` (admin side + inventory).

## What moved (per file)

**Worker side (Task 1)**
- `phase28/library-and-worker`: the ReadTab no-gate block became a no-gate loop over every worker focus file, `useWalk` and `walk.ts` (no review_due_at / owner gate, no governance action import), with a GATE_PATTERN self-check.
- `phase35/no-competency-gate`, `phase36/no-refresher-gate`, `phase37/no-competency-gate-worker`: ReadTab target replaced by the ten worker focus files + `useWalk.ts` + `walk.ts`.
- `phase55/worker-path-contract`: `useSopDetail` / builder autosave / walkthrough / completion store blocks repointed: no worker focus file touches the cache, a local db or a persisted store; page renders `FocusWalker` which calls `useWalk`; `useFocusAutosave` debounces 750 ms, retries and never drops a pending patch; `useStepPhotos(walk?.id)` keeps photos tied to the walk; `ReviewAndSend` submits `{ walkId }` and nothing is queued.
- `phase30/dead-weight`: guards walk `src/` for the file name and for code references instead of reading inside the builder and tabs directories.
- `phase41/nav-and-shim`: worker shell links no `mode: 'edit'` address; the focus page renders no links and mounts `FocusWalker`.
- `sb-ux-blueprint`, `sb-ux-walkthrough`: paper theme (root layout body + focus frame `bg-paper`) and the glove-sized walk (`text-step`, `min-h-tap-glove` on `WalkStep` / `ReviewAndSend`) as source contracts.
- `phase53/login-next-redirect`, `phase41/reference-sweep`: already clean (earlier plans repointed them); no change.

**Admin side (Task 2)**
- `sb-auth-builder`: wizard, AI prompt and upload all `router.push(focusHref(..., { mode: 'edit' }))`; the focus page's edit branch calls `requireSopEditAccess({ sopId })`; publish pinned via `PublishBar` (`getPublishGateStatus`) and `PublishDialog` posting `/api/sops/<id>/publish`.
- `sb-builder-infrastructure`: SB-INFRA-00 is now page guard + client shell; SB-INFRA-03 pins the lazy `FocusEditor` seam (`dynamic`, `ssr: false`, no static import in any worker focus file).
- `phase29/phase-gate`: APR-05 pinned on `getApprovalHistory` itself (admin-gated, per-version `sop_approvals`, labels from `approval_snapshot`).
- `phase30/governance-fold`: `PublishStage approveStep` assertion became: `PublishBar` reads `getApprovalStatus(`, withholds Publish while pending (`isAdmin && !pending`), and the dialog reports pending approval.
- `phase40/dup04-page-shell`: versions page removed from the shell targets; per-SOP Back is the focus top bar's `onClick={onBack}`.
- `phase43/route-truth`, `phase43/dead-controls`: architecture-doc builder-route pin removed (doc updated to the focus editor address); versions-page `selectedForCompare` half replaced by a net over `src/components/focus`: every `<button>` has an `onClick` or is a submit (live count of 77 buttons; mutation-proven).
- `phase46/sop-edit-guard-wiring`: verify actions replaced by `tickFocusStep` / `untickFocusStep` stay `requireAdminContext`, no `requireSopEditAccess`; every focus content write calls `requireSopEditAccess(` in its own body; no `serviceRole` wire flag in the focus actions; the parse route calls `writeFocusStepsForSop(` from a plain module.
- `phase54/library-table`: `CategoryButton` is rendered for admins in `ThisSopBlock`. `phase54/inbox-reuses-governance-gating`: wording only. `phase54/governance-inbox`: already on `focusHref`.
- `phase56/decision-writers-sweep`: the verifyBlock-takes-only-blockId test became tickFocusStep / untickFocusStep take only `{ stepId }`.
- `phase57/place`: retired builder address replaced by a generic admin page in the "every other page goes to the site" case.
- `lint/no-bulk-verify-ui`: scan root (`src/`) provably covers `src/components/focus/admin/StepCard.tsx` and `EditDocument.tsx` (asserted); banned phrases extended with `tick all`, `check all`, `mark all`, `confirm all`.
- `phase58/repoint-inventory`: `58-15` added to `LIVE_PLANS`.

## Assertions dropped (no successor) and why

| File | Dropped | Why |
|---|---|---|
| phase28/library-and-worker | "Current as of" caption on the read tab | The focus screen shows no currency caption; the no-gate half survives |
| sb-ux-walkthrough | immersive step card at 390x852; ViewModeToggle persists to localStorage | Both fixme stubs for retired surfaces; one walk layout, nothing persisted on device |
| sb-ux-blueprint | live landing-page probe on localhost; worker preview toggle clamps to 430px; 6-tab shell via ?tab= | The probe needs a running server and could only fail here; toggle and tabs are gone (tab addresses redirect in the proxy) |
| sb-auth-builder | `useForm` / `zodResolver` pins; `section_type: kind.slug`, `section_kind_id`, compensating section-insert cleanup; one-builder-directory readdir; BuilderStageShell pin | Wizard uses a plain zod schema; `createSopFromWizard` creates no sections (D-19); builder route is redirect-only and goes in 58-16 |
| sb-builder-infrastructure | SB-INFRA-02 (Dexie offline authoring and sync) | Online-only since Phase 55; the editor writes straight to the server |
| phase29/phase-gate | versions page calls `getApprovalHistory` and groups rows per version | The versions page has no successor surface (see Flags) |
| phase32/wire-up-mode | builder hands the publish stage `/admin/access?sop=<id>` (Phase 57 D-14) | The post-publish stage is gone and `PublishBar` has no equivalent link (see Flags) |
| phase40/dup04-page-shell | versions page preserves the per-SOP back link | Replaced by the focus top bar's Back |
| phase43/dead-controls | versions page has no `selectedForCompare` | No compare UI exists; replaced by the focus button net |
| phase43/route-truth | architecture doc names the builder route | Doc updated; pin would go red when 58-16 deletes the page |
| phase55/worker-path-contract | completion-store cache-free, `server_newer` last-write-wins, save-status store resets per SOP | Store deleted by design; the focus autosave has no last-write-wins branch (plain draft write); no per-SOP reset exists in `useFocusSaveStatus` |

## Deviations from Plan

**1. [Rule 3 - Blocking] Task 2 acceptance grep still matches `no-bulk-verify-ui.spec.ts` on `verify-checklist`.**
The allow-list names the `VerifyChecklistGate` files, which still exist and enumerate the banned phrases, so removing the entries now turns the lock red until 58-16 deletes them. The inventory row says "allow-list stays". The literal is a 58-16-owned token and is not checked against `LIVE_PLANS`. 58-16 must drop the two allow-list entries with the files.

**2. [Rule 3 - Blocking] `redirectOnly` pathway exemptions left in `phase30/governance-fold` and `phase40/dup04-page-shell`.**
Both pages still exist as full page files (the proxy redirects before they render), so the pathway-coverage guards still need the exemption. Same as `phase57/shell-structure`: 58-16 deletes all three exemptions with the directories.

**3. [Rule 1 - Bug] `.planning/codebase/ARCHITECTURE.md` line 141** named the builder route in a backticked path; `no-dead-internal-hrefs` ("route docs name only routes that exist") would have gone red when 58-16 deleted the page. Repointed to `/sops/[sopId]?mode=edit`.

**4. `phase56/decision-writers-sweep` still lists `verifyBlock` / `unverifyBlock` in `LIVE_WRITERS` (and the JSON registry).** The functions still exist and still record decisions; removing the rows now would desync them from `scripts/decision-writers.json`. 58-16 removes the rows with the functions.

## Flags for the orchestrator (behaviour that has no focus-screen successor)

- **Post-publish "Choose who sees it" link** (builder PublishStage to `/admin/access?sop=<id>`, Phase 57 D-14) is not carried by `PublishBar` or `PublishDialog`. The receiving end (`?sop=` pin on the access page) still works.
- **Approval history rows per version (APR-05 UI)** rendered only on the versions page. After 58-16 `getApprovalHistory` has no caller; the focus rail lists earlier versions without approvals.
- **`useFocusSaveStatus` is never reset when the editor opens a different SOP**, so the top-bar pill can show the previous SOP's `saved` / `error` state briefly. The old builder reset its status per SOP (WR-03). Not fixed here (test-only plan).

## Verification

- `npx tsc --noEmit`: clean.
- Every project owning a touched spec run once (phase11-stubs, phase12.5-stubs, phase15-stubs, phase28, 29, 30, 32, 35, 36, 37, 40, 41, 43, 46, 53, 54, 55, 56, 57, 58): 1477 passed, 57 skipped, 11 failed. All 11 are outside this plan:
  - `sb-layout-editor` x6 and `sb-section-schema` SB-SECT-05: 58-16 deletes (inventory), already in deferred-items.
  - `sb-ux-blocks` x4: need a running server on localhost:3000 (`/api/schema`), not in the inventory, pre-existing.
- phase58 project including `repoint-inventory` with `58-15` live: passes.
- Mutation proofs: a handler-less `<button>` and a "Tick all" label planted in `SentPanel.tsx` turned `dead-controls` and `no-bulk-verify-ui` red; reverted.
- `playwright --list | grep builder|walkthrough|ReadTab`: no test files match by path; the whole-subject builder specs remaining are the inventory's 58-16 deletes (`sb-layout-editor`, `sb-section-schema`, `tests/builder/*`, `phase26/*`, `phase29/publish-stage-approval`, `phase29/version-history-approvals`).

## Deferred

`tests/integration/wizard-sop-dept.spec.ts` A4 (`__new__` sentinel) left red: `SopMetadataFields` no longer holds the literal and the picker now takes `localOnly`; repointing needs the new local-only contract, not a one-liner.

## Self-Check: PASSED

- Commits `872c7d5a` and `ff558728` present in `git log`.
- All 24 spec files and `ARCHITECTURE.md` modified as listed; STATE.md and ROADMAP.md untouched.
