---
phase: 04-completion-and-sign-off
plan: 02
subsystem: worker-completion-ui
tags: [photo-capture, completion, walkthrough, offline, pwa]
dependency_graph:
  requires: [04-01]
  provides: [StepPhotoZone, PhotoThumbnail, usePhotoQueue, extended-walkthrough]
  affects: [walkthrough-page, step-item, walkthrough-list]
tech_stack:
  added: []
  patterns:
    - useEffect+setState polling for Dexie (no dexie-react-hooks)
    - canvas capture="environment" for iOS-safe camera
    - crypto.subtle.digest SHA-256 for content hash
    - online event listener triggers flushPhotoQueue
key_files:
  created:
    - src/hooks/usePhotoQueue.ts
    - src/components/sop/PhotoThumbnail.tsx
    - src/components/sop/StepPhotoZone.tsx
  modified:
    - src/components/sop/StepItem.tsx
    - src/components/sop/WalkthroughList.tsx
    - src/app/(protected)/sops/[sopId]/walkthrough/page.tsx
decisions:
  - "useEffect+setState polling (2s) for Dexie photo queue — dexie-react-hooks not in package.json"
  - "StepPhotoZone click handlers call e.stopPropagation() to prevent step toggle when tapping photo UI"
  - "handleAddPhoto auto-starts completion record if none active before first photo capture"
  - "completionStore.clearCompletion called on success; Dexie cleanup deferred to sync-engine flushCompletions"
metrics:
  duration_seconds: 261
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
requirements: [COMP-02, COMP-03]
---

# Phase 04 Plan 02: Photo Capture and Submit Completion Summary

**One-liner:** Photo capture with canvas compression and Dexie queuing wired into walkthrough, with SHA-256 content hash and Submit Completion server action integration.

## What Was Built

### Task 1: StepPhotoZone, PhotoThumbnail, usePhotoQueue

**`src/hooks/usePhotoQueue.ts`**
- `usePhotoQueue(completionLocalId)` — polls `db.photoQueue` every 2 seconds; returns `photos`, `photosForStep`, `queueCount`, `uploadedCount`
- `addPhotoToQueue({ completionLocalId, stepId, file })` — compresses via `compressPhoto`, generates UUID, writes to Dexie
- `removePhoto(localId)` — deletes from Dexie only if `uploaded === false`

**`src/components/sop/PhotoThumbnail.tsx`**
- 72x72 thumbnail using `URL.createObjectURL` in `useEffect` with cleanup on unmount
- Orange border + dot when queued; green border + dot when uploaded
- X remove button (top-left) visible only for unuploaded photos; calls `e.stopPropagation()` to avoid toggling the step

**`src/components/sop/StepPhotoZone.tsx`**
- Four states per UI-SPEC C-01: (A) required + no photos, (B) required + has photos, (C) optional + no photos, (D) optional + has photos
- Hidden `<input type="file" accept="image/*" capture="environment">` triggered via `inputRef.current?.click()`
- All click handlers call `e.stopPropagation()` to prevent step row toggle
- Thumbnail grid with [+ Add] button matching 72x72 size

### Task 2: Walkthrough page wiring

**`src/components/sop/StepItem.tsx`**
- Added `completionLocalId`, `stepPhotos`, `onAddPhoto`, `onRemovePhoto` props
- Renders `<StepPhotoZone>` inside centre column when `completionLocalId` is non-null

**`src/components/sop/WalkthroughList.tsx`**
- Added `completionLocalId`, `photosByStep`, `onAddPhoto`, `onRemovePhoto` props
- Threads per-step photos to each `StepItem`
- Wraps each step in `<div id="step-{id}">` for scroll-to-step functionality

**`src/app/(protected)/sops/[sopId]/walkthrough/page.tsx`**
- `useCompletionStore.restoreFromDexie(sopId)` called on mount (D-02 resume)
- `usePhotoQueue(completionLocalId)` for live photo queue state
- Photo queue indicator in top bar: orange pill with CloudUpload icon replaces step counter when photos pending
- `handleMarkActive` starts completion if none active, marks step in both walkthrough store (memory) and completion store (Dexie)
- Photo-required gate: `Mark Step Complete` button disabled with orange label when `photo_required === true` and zero photos
- `handleSubmitCompletion`: computes SHA-256 content hash, gathers uploaded photo storage paths from Dexie, calls `submitCompletion` server action, shows submitted success state
- Photos-still-uploading warning strip above Submit Completion when `queueCount > 0`
- `window.addEventListener('online', flushPhotoQueue)` for automatic sync on reconnect
- `flushPhotoQueue` also triggered immediately after each photo capture if `navigator.onLine`
- Submitted success state: full-screen CheckCircle2, "Completion submitted", "Your supervisor has been notified.", link back to SOP

## Verification

- `npm run build` — passed with zero errors
- `npx tsc --noEmit` — passed (Task 1)
- StepPhotoZone renders four states per UI-SPEC C-01
- PhotoThumbnail shows orange (queued) and green (uploaded) status dots
- Mark Step Complete disabled when `photo_required=true` and no photos
- Submit Completion calls `submitCompletion` server action with SHA-256 content hash
- Completion store restores from Dexie on mount (D-02 resume)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Notes

**dexie-react-hooks not installed:** Plan noted to check and use polling fallback. Confirmed not in `package.json`. Used `useEffect + useState` with `setInterval(2000)` polling as planned. Tracked as expected deviation, not a bug.

**WalkthroughList `onAddPhoto` signature:** Plan specified `onAddPhoto: (file: File) => Promise<void>` on WalkthroughList, but WalkthroughList needs the `stepId` to route photos correctly. Adapted to `onAddPhoto: (stepId: string, file: File) => Promise<void>` at the list level; each StepItem still receives `(file: File) => Promise<void>` via closure (`(file) => onAddPhoto(step.id, file)`). The page-level handler matches the list signature.

## Self-Check: PASSED

All created files confirmed on disk. All task commits confirmed in git log.

| Check | Result |
|-------|--------|
| src/hooks/usePhotoQueue.ts | FOUND |
| src/components/sop/PhotoThumbnail.tsx | FOUND |
| src/components/sop/StepPhotoZone.tsx | FOUND |
| Commit 753fe55 (Task 1) | FOUND |
| Commit 57260cf (Task 2) | FOUND |
