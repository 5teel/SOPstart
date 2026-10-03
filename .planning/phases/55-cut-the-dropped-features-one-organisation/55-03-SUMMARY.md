---
phase: 55-cut-the-dropped-features-one-organisation
plan: 03
subsystem: worker-path
tags: [photo-upload, zustand, server-actions, deployed-eval, org-scope]
requires:
  - phase: 55-02
    provides: worker read side and builder autosave off Dexie
provides:
  - src/lib/photo/compress.ts (compressPhoto moved out of lib/offline)
  - useStepPhotos hook (compress -> getPhotoUploadUrl -> signed PUT, memory only)
  - memory-only completionStore
  - getPhotoUploadUrl with session-only org and UUID ids
  - deployed walk-with-photo and waits-for-sign-off evals (green on sopstart.com)
affects: [55-09, 55-14]
tech-stack:
  added: []
  patterns:
    - "Photo upload is two server calls and one PUT; the chip shows Uploading / Uploaded / failed and submit waits for uploads"
key-files:
  created:
    - src/hooks/useStepPhotos.ts
  modified:
    - src/lib/photo/compress.ts
    - src/stores/completionStore.ts
    - src/actions/completions.ts
    - src/components/sop/walkthrough/MobileWalkthrough.tsx
    - src/components/sop/walkthrough/ImmersiveStepCard.tsx
    - src/components/sop/walkthrough/DesktopWalkthrough.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/offline/sync-engine.ts
    - src/hooks/usePhotoQueue.ts
    - tests/phase55/worker-path-contract.spec.ts
    - tests/evals/cut-features.eval.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - .planning/phases/55-cut-the-dropped-features-one-organisation/55-VALIDATION.md
key-decisions:
  - "completionStore moved into the Task 2 commit (not Task 1) so every commit compiles: its callers lose restoreFromDexie in the same change"
  - "submitCompletion now rejects photo paths outside {session org}/completions/{localId}/ (Rule 2; the same trust gap T-55-04 closed on the URL side)"
requirements-completed: [CUT-01]
duration: ~1h
completed: 2026-10-03
---

# Phase 55 Plan 03: Worker write side off Dexie, proven on the deployed site

**A worker on a phone walks a SOP, takes the photo a step asks for, sees it go Uploading then Uploaded, submits, and the admin sees the completion waiting for sign-off with the photo — all server calls, no IndexedDB, verified on https://sopstart.com.**

## Accomplishments

- `compressPhoto` moved to `src/lib/photo/compress.ts`; `useStepPhotos` does the same two server calls the old flush used, in memory.
- `MobileWalkthrough`: no queue chip, no `window.confirm`, no restore/flush effects; Sign off is disabled and reads "Photos uploading…" while an upload runs; the photo gate opens only on an `uploaded` photo.
- `ImmersiveStepCard`: chips carry `data-testid="step-photo"` + `data-status`; failed uploads show "Upload failed — remove and try again" with a remove button.
- `completionStore` is synchronous and memory-only; `DesktopWalkthrough` dropped its Dexie writes (its missing photo capture is the pre-existing Phase 58 gap, untouched).
- `getPhotoUploadUrl` takes the org from `getSessionContext()` only, `orgId` removed from its input, both ids validated with `z.string().uuid()`.
- `journeys.ts` photo step reworded; CAPABILITY-MATRIX "Record completion" row updated.

## Org-scope re-read of `src/actions/completions.ts`

- `submitCompletion`: organisation from `getSessionContext()`; roster worker checked against that org; insert uses session org. Unchanged, plus the new photo-path prefix check below.
- `signOffCompletion`: role + `organisationId` from session. Unchanged.
- `recordSignature`: org from session, roster user checked in-org. Unchanged.

## Eval result (deployed, commit 87fec4e, `npm run eval -- --no-wait`)

31 passed / 0 failed / 6 skipped (4 are the 55-14 stubs, 2 pre-existing org-without-site skips). One flaky retry-pass in the Phase 51 site-editor eval (timing, passed on retry; not touched by this plan).

| Result | Test |
|---|---|
| pass | walk with a photo > worker on a phone walks the walk fixture, takes the photo it asks for and submits — nothing queued |
| pass | walk with a photo > admin sees that completion waiting for sign-off with its photo |
| pass | all 29 existing Phase 43/51/52/53/54 and SOP-page evals |

Screenshots `cut-walk-phone.png` (success state, no queued text) and `cut-walk-signoff.png` (Pending review, "1 photo submitted", photo thumbnail rendered, Approve/Reject bar) were viewed. After the run `sop_completions` for the walk SOP is 0 rows (cleanup ran).

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0. Bundle: `/sops/[sopId]/page` 943 KB (before 1045 / 55-02 1030), `/sops/page` 827 KB (before 936). Baseline file untouched.
- `phase55` worker-path-contract: 11 passed, 3 skipped (55-09 only). `phase46` capability-matrix-doc and `no-static-desktop-import` green.

## Task Commits

1. `63694e0` direct photo upload hook, session-only org in getPhotoUploadUrl
2. `ab29680` walkthrough on the direct photo path, in-memory completion store
3. `f0eba5f` deployed walk evals + VALIDATION rows
4. `87fec4e` fix: phone step card follows the current step

## Deviations from Plan

**1. [Rule 1 - Bug] Phone step card stuck on the done step**
- **Found during:** Task 3 (first deployed eval run; screenshot showed "STEP 1/2 DONE" while the gate said "Capture a photo in the step above").
- **Issue:** the below-430px `ImmersiveStepCard` mount in `MobileWalkthrough` never received `currentStepId`, so after step 1 it kept the done step and the photo input for step 2 never rendered. A phone worker could not take a photo a step asked for. Pre-existing (the mount was unchanged by this plan); no unit test could see it.
- **Fix:** pass `currentStepId={localStepId}` to that mount.
- **Commit:** `87fec4e`

**2. [Rule 2 - Missing critical] submitCompletion photo-path prefix check**
- `storagePath` was client-supplied and unchecked, so a crafted path could attach another org's file to a completion in the caller's org (an admin viewing it would get a signed URL for it). `submitCompletion` now rejects any path not under `{session org}/completions/{localId}/`. Same commit as the URL hardening (`63694e0`).

**3. Commit grouping:** `completionStore.ts` landed with Task 2 instead of Task 1 so each commit passes `tsc`.

## Known Stubs

None.

## Threat Flags

None beyond the mitigated T-55-04; the new prefix check reduces surface.

## Hand-offs

- `usePhotoQueue.ts`, `sync-engine.ts`, `useSopSync`, `useAssignedSops`, `useDraftLayoutSync` and `src/lib/offline/*` are unreferenced by the walk path and remain only for 55-09 to delete (`usePhotoQueue` still imports `@/lib/offline/db`).
- Pushed to master (Railway live at 87fec4e); the ordering gate for the deleting waves is met.
- Manual UAT notes: the walk eval runs at a 390 px viewport because `DesktopWalkthrough` still has no photo capture.

## Self-Check: PASSED

- Commits `63694e0`, `ab29680`, `f0eba5f`, `87fec4e` exist; `src/lib/photo/compress.ts` and `src/hooks/useStepPhotos.ts` present; `src/lib/offline/photo-compress.ts` gone.
