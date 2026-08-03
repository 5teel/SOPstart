---
phase: 40-shared-creation-foundation
plan: 14
subsystem: api
tags: [security, supabase, storage-rls, tus-upload, server-actions]

requires:
  - phase: 40-shared-creation-foundation
    provides: startVideoSopUpload (shared client video-upload routine, plan 40-07)
  - phase: 40-shared-creation-foundation
    provides: scripts/apply-phase40-migration.mjs (migration applier, plans 40-04/40-06)
provides:
  - Video TUS uploads authenticated by the caller's own session access_token, never a server-supplied key
  - SUPABASE_SERVICE_ROLE_KEY referenced by exactly one file under src/ (src/lib/supabase/admin.ts), enforced by a sweep spec
  - Migration 00059 — org-prefix + admin-role INSERT and UPDATE policies on storage.objects for the sop-videos bucket
  - Phase-40 migration applier covering 00058 then 00059 in order, with clause-pinned post-apply assertions
affects: [admin-sop-upload, sop-versions, video-pipeline, storage-rls]

tech-stack:
  added: []
  patterns:
    - "A client upload routine resolves its own auth token via supabase.auth.getSession(); the server returns a path, never a credential"
    - "Removing a service-role bypass makes the underlying RLS load-bearing — the policy tightening must ship in the same pass, not as a follow-up"

key-files:
  created:
    - supabase/migrations/00059_sop_videos_storage_scope.sql
    - tests/phase40/no-service-role-to-browser.spec.ts
  modified:
    - src/actions/sops.ts
    - src/actions/versioning.ts
    - src/lib/upload/start-video-sop-upload.ts
    - src/components/admin/VideoPreviewPanel.tsx
    - src/components/admin/VideoFormatSelectionModal.tsx
    - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
    - scripts/apply-phase40-migration.mjs
    - tests/phase40/dat01-migration.spec.ts

key-decisions:
  - "All three sites closed in one pass (CLAUDE.md rule #5), not just the one plan 40-07 introduced — two predate this phase (Phase 6)"
  - "UPDATE policy created alongside INSERT because tus-upload.ts sends x-upsert:'true'; INSERT alone would have broken resumable uploads"
  - "SELECT policy on sop-videos deliberately left untouched (T-40-14-05, accept) — pre-existing, no read path changed by this plan"
  - "Sweep spec keys on the secret name itself, not a list of known-bad functions, so a fourth site anywhere under src/ fails immediately"
  - "Service-role key rotation flagged as a recommended operator action — the key has been reaching browsers since Phase 6"

requirements-completed: [DUP-01]

duration: ~35min (execution) + human checkpoint
completed: 2026-08-03
---

# Phase 40 Plan 14: Service-role key removal + sop-videos storage scoping Summary

**Removed `SUPABASE_SERVICE_ROLE_KEY` from three server-action return values that shipped it to the browser as a video TUS upload token, repointed video uploads onto the caller's own session token, and tightened the `sop-videos` bucket policies that this makes load-bearing for the first time.**

## Performance

- **Duration:** ~35 min execution, plus a blocking human checkpoint spanning to 2026-08-03
- **Tasks:** 3 completed (2 auto, 1 human-verify)
- **Files modified:** 8 (+2 created)

## Accomplishments

- **The service-role key no longer leaves the server.** `uploadNewVersion` (`versioning.ts`), `createVideoUploadSession` and `createVideoSopPipelineSession` (`sops.ts`) each returned `process.env.SUPABASE_SERVICE_ROLE_KEY` to an authenticated admin/safety_manager's browser, visible in DevTools. A captured key grants cross-tenant read/write of every table and bucket via PostgREST. All three return sites are gone; `grep -rn "SUPABASE_SERVICE_ROLE_KEY" src/` now returns exactly `src/lib/supabase/admin.ts`.
- **Video uploads authenticate as the user.** `startVideoSopUpload` (the single shared client routine behind three of the four call sites) resolves `supabase.auth.getSession()` itself and passes `access_token` to `tusUpload`, with a "Not authenticated" error path — the same shape `UploadDropzone`'s document TUS branch already used. `VideoPreviewPanel` calls `tusUpload` directly with pre-extracted audio, so it got the same treatment inline. `StartVideoSopUploadSession` lost its `token` field; the two object-literal call sites (`VideoFormatSelectionModal`, `versions/page.tsx`) stopped passing one.
- **Genuine signed-upload tokens preserved.** The non-video branches of `uploadNewVersion` and `createVideoSopPipelineSession` still return `signedData.token` from `createSignedUploadUrl`, and `createVideoUploadSession` still returns `signedUploadUrl` for its under-10MB branch — those are real scoped credentials and were not touched.
- **Migration 00059 applied live.** 00012 created `sop-videos` with a bucket-wide, org-blind INSERT policy, safe only because the service-role key was doing the authorising. 00059 drops it and creates `admins_can_upload_sop_videos` (INSERT) and `admins_can_update_sop_videos` (UPDATE), both predicated on `bucket_id = 'sop-videos' AND (storage.foldername(name))[1] = public.current_organisation_id()::text AND public.current_user_role() IN ('admin','safety_manager')` — the 00005 `sop-documents` shape. UPDATE is required, not optional: `tus-upload.ts` sends `x-upsert: 'true'`.
- **Applier extended and clause-pinned.** `MIGRATIONS` now lists `00058` then `00059` in order. Post-apply assertions query `pg_policies` and pin *every* clause of both new policies (all three tokens in `with_check`, and in `qual` too for UPDATE) plus the absence of the old permissive policy name — per CLAUDE.md [2026-07-28], not mere existence checks. A pre-apply audit counted `sop-videos` objects whose first path segment is not a UUID: **0**, so no legacy object lost write access.
- **Two guards added/repaired.** `tests/phase40/no-service-role-to-browser.spec.ts` (new) asserts the set of `src/` files containing the secret is exactly `['src/lib/supabase/admin.ts']`, that `tus-upload.ts` still takes `accessToken` from its caller, and that no file under `src/actions/` returns `token: process.env.*`. `dat01-migration.spec.ts`'s ordering guard had `f.startsWith('00058')` — which would have silently exempted 00059 from the very check the file's header cites (the [2026-07-13] stale-guard class); widened to cover every phase-40 migration.

## Task Commits

1. **Task 1: Stop returning the service-role key; authenticate video TUS uploads as the caller** - `27bf048` (fix)
2. **Task 2: Scope the sop-videos bucket policies and apply the migration, with the sweep and ordering guards** - `5c76a0e` (fix)
3. **Task 3: Human checkpoint on sopstart.com** - approved 2026-08-03; follow-up fix `dd4477c`

## Files Created/Modified

- `src/actions/versioning.ts` - `token` removed from `uploadNewVersion`'s video-branch return (and the comment claiming the service-role key was the correct TUS token); `token` made optional on the success arm
- `src/actions/sops.ts` - `createVideoUploadSession` drops the key and its `token` field; `createVideoSopPipelineSession` drops the `token:` line from its video branch
- `src/lib/upload/start-video-sop-upload.ts` - resolves `auth.getSession()` and supplies `access_token` as `tusUpload`'s `accessToken`; `StartVideoSopUploadSession` loses `token`
- `src/components/admin/VideoPreviewPanel.tsx` - same `getSession()` treatment on its direct `tusUpload` call, with a toast + `upload-error` path when unauthenticated
- `src/components/admin/VideoFormatSelectionModal.tsx`, `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` - stopped passing `token` into `startVideoSopUpload`
- `supabase/migrations/00059_sop_videos_storage_scope.sql` - org-prefix + admin-role INSERT/UPDATE policies (new)
- `scripts/apply-phase40-migration.mjs` - `MIGRATIONS` extended to 00058→00059; clause-pinned post-apply assertions; pre-apply legacy-object audit
- `tests/phase40/no-service-role-to-browser.spec.ts` - secret-keyed sweep (new)
- `tests/phase40/dat01-migration.spec.ts` - ordering-guard filter widened off the stale `startsWith('00058')`; 00059 clause-pinning test added

## Decisions Made

- Closed all three sites rather than only the one plan 40-07 authored. Two predate Phase 40 (Phase 6), but leaving them would have left the class alive while the sweep spec claimed it closed.
- Left the `sop-videos` SELECT policy alone and documented why in the migration header: reads go through the admin client (`transcribe`) or an admin-gated session-client signed URL (`source-url`). Narrowing it is a separate pre-existing concern (T-40-14-05).
- Recommended but did not perform service-role key rotation — an operator action. The key has been reaching browsers since Phase 6, so any browser session or DevTools capture in that window holds a still-valid key.

## Deviations from Plan

- **Task 3's verification steps were partly wrong as written.** The plan told the user to upload "an MP4 larger than 10MB (this forces the resumable TUS path)". Tracing the code during the checkpoint showed `startVideoSopUpload` has *no size branch at all* — both the dropzone and versions-page paths always use TUS. The only 10MB threshold is in `VideoPreviewPanel.tsx:151` and it measures the **extracted audio**, not the source video. Any MP4 exercises the changed path on the two surfaces the checkpoint actually names.
- **A pre-existing UI bug surfaced during the checkpoint and was fixed** — see Issues Encountered.

## Issues Encountered

**The checkpoint upload succeeded but showed nothing.** Progress reached 100% (so TUS `onSuccess` fired — the session-token auth and 00059's policies both worked) and then no confirmation, no link, no visible SOP. Root cause was unrelated to this plan: `UploadDropzone.tsx`'s success panel renders on `success && uploadedSopIds.length > 0`, and the **video branch never called `setUploadedSopIds`** while both document branches did. Confirmed pre-existing by reading `26a8223^` — the omission was in the inline video branch before plan 40-02 extracted it, so Phase 40 relocated the bug without introducing it. The versions page was checked and redirects correctly, so the miss was confined to this one surface. Fixed in `dd4477c` (one line + comment).

This is the [2026-07-14] `--accent-ok` class again: every gate this phase ran — tsc, `next build`, the 54-test phase40 project, code review, phase verification — reads source, and none of them watch a screen. A missing state write on a success path is invisible to all of them.

## Mutation Proof (plan-required)

1. **Ordering guard** — removed `00059_sop_videos_storage_scope.sql` from the applier's `MIGRATIONS` array while leaving it on disk; `dat01-migration.spec.ts` went **RED**. Restored, **GREEN**. (With the original `startsWith('00058')` filter it would have stayed green in both states — the regression the fix exists to prevent.)
2. **Service-role sweep** — temporarily re-added `process.env.SUPABASE_SERVICE_ROLE_KEY` to `src/actions/sops.ts`; `no-service-role-to-browser.spec.ts` went **RED** naming the offending file. Reverted, **GREEN**.
3. Spec discoverability confirmed: `npx playwright test --list --project=phase40 | grep no-service-role-to-browser` resolves (CLAUDE.md [2026-05-25]).

## Human Verification (Task 3, blocking gate)

Approved 2026-08-03 on sopstart.com. A 10.6MB MP4 (generated with the `ffmpeg-static` already in `node_modules`) uploaded through **Admin → SOPs → Upload** ran to 100% and landed as a draft with transcription queued — proving the caller's session token authenticates against 00059's org-prefix + admin-role predicate on a live tenant. Had the predicate been wrong, the upload would have failed mid-transfer with a 403 / "new row violates row-level security policy", not completed.

## User Setup Required

**Recommended: rotate `SUPABASE_SERVICE_ROLE_KEY`** (Supabase dashboard → API settings → regenerate, then update the Railway env var). The key was reachable from admin browser sessions from Phase 6 until this plan deployed. Rotation is the only way to invalidate a copy captured in that window. Not blocking — the code no longer emits it either way.

## Next Phase Readiness

- 40-VERIFICATION.md GAP 2 closed at all three sites; 40-REVIEW.md CR-01 closed.
- With GAP 1 (`image/webp` — `uploadFileSchema` now derives from `ACCEPTED_MIME_TYPES`) closed by plan 40-10 and GAP 3 (`cloneSopAsDraft` carries `category_slug`) closed by plan 40-11, all three verification gaps are closed in code. Phase 40 is ready for re-verification.
- Deliberately not addressed: the `sop-videos` SELECT policy (T-40-14-05, accept), and key rotation (operator action above).

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-08-03*
