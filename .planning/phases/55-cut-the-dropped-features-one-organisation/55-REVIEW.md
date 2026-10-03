---
phase: 55
reviewed: 2026-10-03T00:00:00Z
depth: standard
files_reviewed: 92
files_reviewed_list:
  - src/actions/auth.ts
  - src/actions/completions.ts
  - src/actions/sop-section-blocks.ts
  - src/actions/sops.ts
  - src/actions/versioning.ts
  - src/hooks/useBuilderAutosave.ts
  - src/hooks/useStepPhotos.ts
  - src/hooks/useWorkerSops.ts
  - src/hooks/useSopDetail.ts
  - src/hooks/useCompletions.ts
  - src/stores/completionStore.ts
  - src/lib/supabase/middleware.ts
  - src/lib/governance/publish-core.ts
  - src/app/api/sops/[sopId]/publish/route.ts
  - src/app/(protected)/sops/page.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
  - src/components/admin/UploadDropzone.tsx
  - src/components/sop/walkthrough/MobileWalkthrough.tsx
  - src/components/sop/walkthrough/DesktopWalkthrough.tsx
  - src/components/sop/walkthrough/ImmersiveStepCard.tsx
  - src/components/sop/walkthrough/WalkthroughSwitcher.tsx
  - src/components/sop/plant/NowCard.tsx
  - src/components/sop/SopLibraryCard.tsx
  - src/app/(auth)/sign-up/page.tsx
  - src/components/auth/LoginForm.tsx
  - src/components/auth/JoinByCodeForm.tsx
  - next.config.ts
  - public/sw.js
  - "(plus the remaining 66 added/modified files under src/ in 0f3e89f..HEAD, reviewed as diffs)"
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: fixed
---

# Phase 55: Code Review Report

**Reviewed:** 2026-10-03
**Depth:** standard
**Files Reviewed:** 92 (`git diff --name-only --diff-filter=AM 0f3e89f..HEAD -- src/`) plus `next.config.ts` and `public/sw.js`
**Status:** issues_found

## Summary

The deletion work is clean. `npx tsc --noEmit` passes. The remaining `'use server'` modules export only async functions. No client-supplied `organisationId` or trust flag survives in `auth`, `completions`, `sops`, `versioning` or `sop-section-blocks`. The publish gate body in `publish-core.ts` is unchanged apart from the removed video auto-queue. `/sw.js` is correctly exempted in the middleware. `UploadDropzone` still calls `setUploadedSopIds` on the document branches (small and TUS) and on the record-video branch. `next.config.ts` keeps the `splitChunks` cacheGroup. `/sign-up` is a static invitation-only page and nothing calls `auth.signUp`. No mount-effect `router.replace` was added, and no `navigator` or `window` read happens at module load or in render.

Two real defects survive verification, and both sit on the new direct-upload and completion path. The first is a stale-photo bug in `MobileWalkthrough` that breaks a second walk. The second is an authorization gap in `recordSignature`: it already existed, but the phase removed the only feature that justified its client-supplied parameter. Four warnings cover the photo-path validation, lost photo rows, autosave failure handling and swallowed read errors. Three info items follow.

## Critical Issues

### CR-01: Photos from a previous walk are re-submitted with the next completion, so the second submit fails with "Invalid photo path."

**File:** `src/components/sop/walkthrough/MobileWalkthrough.tsx:116, 206, 263` and `src/hooks/useStepPhotos.ts:21-70`

**Issue:** `useStepPhotos()` keeps its photo list in `MobileWalkthrough`'s own `useState`. Nothing ever clears that list. `handleSubmit` sends `photoStoragePaths: uploadedPhotos` (line 206). On success it calls `completionStore.clearCompletion` and `setSubmitted(true)`, and the component stays mounted because the success panel is an early return inside the same component. The success panel offers "Start another walkthrough" (line 263) and "Re-read steps". In either case the next step tick calls `startCompletion`, which creates a new `localId` (L2). The next submit still sends every photo uploaded under L1.

The new server check in `submitCompletion` (`completions.ts:40-43`) requires `startsWith(`${org}/completions/${L2}/`)`. It rejects the whole submission with `Invalid photo path.` The worker cannot submit the second walk until they reload the page. If the check were absent, the old photos would be attached to the wrong completion instead. The cause is that hook state outlives the completion it belongs to, and the 55-03 plan never tied the two together.

**Fix:** Tag each photo with the completion it was uploaded under, and only submit the ones for the active completion. This works even if the hook is never reset.

```ts
// useStepPhotos.ts
export type StepPhoto = { localId: string; completionId: string; stepId: string; storagePath: string | null; status: ... }
// addPhoto: setPhotos(prev => [...prev, { localId, completionId, stepId, storagePath: null, status: 'uploading' }])
const uploadedFor = (completionId: string) =>
  photos.filter(p => p.completionId === completionId && p.status === 'uploaded' && p.storagePath)
    .map(p => ({ localId: p.localId, stepId: p.stepId, storagePath: p.storagePath as string, contentType: 'image/jpeg' }))
// MobileWalkthrough.handleSubmit: photoStoragePaths: uploadedFor(activeCompletion.localId)
```

Also expose `reset()` from the hook and call it next to `completionStore.clearCompletion(sopId)`.

### CR-02: `recordSignature` lets any org member write a supervisor counter-signature as any other member

**File:** `src/actions/completions.ts:303-360` (the call site is `CompletionDetailClient.tsx:140-150`)

**Issue:** This code is not in the phase diff, but the phase removed the reason it exists. `recordSignature` takes `role` and `rosterUserId` from the client. The server only checks that the completion is in the caller's org and that `rosterUserId` is a member of that org. It never checks that `rosterUserId === userId`, and it never checks the caller's role when `role === 'supervisor'`. The insert uses the service-role client into an append-only table that migration 00038 calls legally immutable.

Any plain worker in the org can therefore call the server action. It is POST-reachable because the module is imported by a client component. The call `recordSignature({ completionId, role: 'supervisor', rosterUserId: <an admin's user_id> })` writes a forged counter-signature, attributed to someone else, on any completion in the org, with no way to undo it.

The parameter existed for the shared-device roster flow, where the session user was the shared account and the signer was the roster name. That flow is deleted (D-11, `safestart_roster_worker_id`), and `CompletionDetailClient` now always passes `currentUserId`. The parameter is now a pure attack surface.

**Fix:**
```ts
// recordSignature
const { completionId, role } = parsed.data            // drop rosterUserId from the schema
if (role === 'supervisor' && !['supervisor', 'safety_manager', 'admin'].includes(sessionRole ?? '')) {
  return { success: false, error: 'Only supervisors can counter-sign.' }
}
// insert: roster_user_id: userId   (session-derived, never client-supplied)
```
Remove `rosterUserId` from `RecordSignatureSchema` and from the call in `CompletionDetailClient.tsx`. Then delete the now-redundant `organisation_members` membership lookup.

## Warnings

### WR-01: Photo path validation is a bare `startsWith`, so `..` segments and arbitrary suffixes pass

**File:** `src/actions/completions.ts:40-43`

**Issue:** `p.storagePath.startsWith(`${org}/completions/${localId}/`)` accepts `"{org}/completions/{id}/../../{otherOrg}/completions/{x}/y.jpg"` and any other suffix. The prefix was added so a client-supplied path never reaches another tenant's files. The string is then stored in `completion_photos.storage_path`. The activity page later calls `createSignedUrl(photo.storage_path, 3600)` with the admin client (`activity/[completionId]/page.tsx:107`), which bypasses storage RLS. Whether Storage normalises `..` is a property of the Storage service, so this is a defence-in-depth gap rather than a proven exploit. The check should not depend on that.

**Fix:** Validate the exact shape that `getPhotoUploadUrl` signs:
```ts
const re = new RegExp(`^${organisationId}/completions/${localId}/${p.localId}\\.(jpg|png)$`)
if (photoStoragePaths.some((p) => !new RegExp(`^${organisationId}/completions/${localId}/${p.localId}\\.(jpg|png)$`).test(p.storagePath)))
```
Both ids are already UUID-validated by `PhotoStoragePathSchema`, so no escaping is needed.

### WR-02: A failed `completion_photos` insert is swallowed, and the idempotent retry can never repair it

**File:** `src/actions/completions.ts:66-70, 75-95`

**Issue:** If the `completion_photos` insert fails, the code logs it and returns `{ success: true }`. The comment says "photos can be retried". They cannot. A client retry hits `23505` on the completion insert and returns success at line 68, before the photo block runs. Once the photo rows are lost, the evidence for `photo_required` steps is gone while the worker sees "Completion submitted". The files stay in storage but nothing points at them. The old offline queue had its own retry. The 55-03 direct path has none, so this gap now matters more.

**Fix:** Run the photo insert on the duplicate path too (make it an upsert on `(completion_id, storage_path)`, or ignore duplicates), and return `{ success: false }` when it fails so the client keeps the walk open and retries:
```ts
if (insertError && insertError.code !== '23505') { ...return failure }
// fall through to the photo insert for both fresh and duplicate completions
if (photoError) return { success: false, error: 'Photos could not be saved. Please try again.' }
```

### WR-03: A failed autosave is dropped with no retry, and save status leaks between SOPs

**File:** `src/hooks/useBuilderAutosave.ts:16-55, 67-71` and `BuilderClient.tsx:56-62, 167-175`

**Issue (a):** `saveLayout` catches errors and only sets `status.error`. `dataRef.current` still holds the edit, but `timerRef.current` is `null`, so `flush()` returns early at line 68. Nothing re-arms the save. The only retry is the user making another edit. A transient network error followed by closing the tab loses the edit. The old Dexie path kept it as `dirty` and re-flushed it. The pill's "NOT SAVED" label is the only signal.

**Issue (b):** `useBuilderSaveStatus` is a module-level zustand store. `error`, `lastSavedAt` and `overwrittenSectionIds` survive client navigation between builders. After a failure on SOP A, SOP B's builder opens showing "NOT SAVED" until an edit succeeds. A stale `lastSavedAt` from A shows "SAVED Ns AGO" on B.

**Fix:** On a non-`server_newer` error, schedule one retry (for example `setTimeout(() => saveLayout(sectionId, data), 5000)`, or re-arm on the `online` event), and keep the latest `Data` until a save succeeds. In `BuilderClient`, reset the store on mount with `useEffect(() => useBuilderSaveStatus.setState({ pending: 0, lastSavedAt: null, error: null, overwrittenSectionIds: [] }), [sopId])`.

### WR-04: The worker library and assignment reads treat a fetch error as an empty list

**File:** `src/hooks/useWorkerSops.ts:33-42` (and the same pattern at 52-70 and 80-92)

**Issue:** With Dexie gone, `library-sops` is the only source of the worker's SOP list. The query function does `return data ?? []` and discards the Supabase `error`. A 4xx or 5xx therefore renders as "no SOPs", the same as a worker who has none. With `networkMode` back to the default, an offline query is paused. Its `isLoading` is false, so the page shows an empty library rather than a loading or offline state. For a safety app, "nothing to do" is the wrong default when the read failed.

**Fix:** Throw on error (`if (error) throw error`) so React Query exposes `isError`. Return `isError` from `useWorkerSops` and render a retry or "can't load SOPs" state in `SopsSection`.

## Info

### IN-01: Overwrite toast timer is never cleared

**File:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx:80`

**Issue:** `setTimeout(() => setOverwriteToast(null), 4000)` has no handle and no cleanup (the comment explains why the effect cannot clean up). A second overwrite inside 4 s has its toast hidden early by the first timer. A timer also fires after unmount.

**Fix:** Keep the handle in a `useRef`, clear it before arming a new one, and clear it in an unmount-only effect.

### IN-02: Kill-switch reloads controlled tabs, and the walk is memory-only now

**File:** `public/sw.js:15-16`

**Issue:** `clients.forEach((c) => c.navigate(c.url))` hard-reloads every controlled window when the old worker is replaced. Walk progress and uploaded photos are now in-memory only (`completionStore`, `useStepPhotos`). A worker mid-walk on the deploy day loses their steps once. The `navigate()` promises are also not awaited, so a rejected navigation becomes an unhandled rejection. The activate chain itself is safe: `waitUntil` covers the cache clear and unregister.

**Fix:** The one-time cost is probably acceptable. Either drop the forced `navigate` (the next navigation is already uncontrolled once the worker unregisters), or wrap it in `Promise.allSettled(clients.map((c) => c.navigate(c.url)))` inside the `waitUntil` chain.

### IN-03: `joinWithInviteCode` still carries multi-org assumptions

**File:** `src/actions/auth.ts:105, 118-122`

**Issue:** The comment says "multi-org allowed", and the action rewrites `active_org_id` to the new org. With `switchOrganisation` and the `OrgSwitcher` deleted, this is now the only writer of that metadata, and nothing can switch back. In a one-org product the case is rare, but a user who already belongs to an org and enters a different org's code is silently re-pointed with no way back. 55-12 recorded the behaviour as "harmless with one org".

**Fix:** Reject with a clear error when the user already has any membership (`.select('id', { count: 'exact', head: true }).eq('user_id', userId)`). Drop the `active_org_id` update and fix the comment.


## Fix Log

Fixed in-place on master by gsd-code-fixer (Critical + Warning scope; IN-01 as a tied one-liner). IN-02 and IN-03 are out of scope and left open.

| Finding | Commit | What changed |
|---|---|---|
| CR-01 | ec560bf | `useStepPhotos(activeCompletionId)` tags each photo with its completion and filters every view to the active one; `MobileWalkthrough` passes `activeCompletion?.localId`. |
| CR-02 | d6d0565 | `recordSignature` signs as the session user only (`rosterUserId` removed from schema, action and `CompletionDetailClient`), a `supervisor` signature needs session role supervisor/safety_manager/admin, membership lookup dropped, CAPABILITY-MATRIX row added. |
| WR-01 | d8378f5 | `submitCompletion` accepts only the exact `{org}/completions/{localId}/{photoId}.jpg|png` strings `getPhotoUploadUrl` signs (string equality, no prefix match). |
| WR-02 | d8378f5 | Photo insert failure now returns an error; the duplicate-key retry path (owner + org checked) inserts only the photo rows still missing, so a resubmit repairs a partial first attempt. Chose retry-repair over deleting the completion row (completions are append-only). |
| WR-03 | 72eb018 | `saveLayout` reports success; `saveWithRetry` re-sends a failed edit up to 3 times at 5 s (superseded by a newer edit); `BuilderClient` clears `lastSavedAt`/`error`/`overwrittenSectionIds` when `sopId` changes (`pending` left alone, in-flight saves still decrement it). |
| IN-01 | 72eb018 | Overwrite toast timer handle kept in a ref, cleared before re-arming and on unmount; no cleanup added to the overwrite effect, so `clearOverwritten()` re-runs cannot cancel it. |
| WR-04 | a4b7a6f | `library-sops` throws on a Supabase error; `useWorkerSops` returns `libraryError` (failed, or paused offline with nothing cached) and `refetchLibrary`; `/sops` renders a token-styled error with "Try again". The two secondary reads (last completions, refresher intervals) still degrade to defaults on error by design (only affect chips). |

Verification: `npx tsc --noEmit` clean; `phase55`, `phase26`, `phase36`, `phase37`, `phase41`, `phase46` (matrix doc), `phase52` and `phase15-stubs` (design-token lint) green; `npm run build` exit 0 (bundle gate +1 KB, within tolerance). Contract assertions for each fix live in `tests/phase55/worker-path-contract.spec.ts`. Not pushed. Not exercised on the deployed site (no eval run).

---

_Reviewed: 2026-10-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
