---
phase: 07-video-transcription-in-app-recording
plan: "01"
subsystem: admin-upload
tags: [video-recording, media-recorder, ios-fallback, tus-upload, ffmpeg-wasm, recording-overlay]
dependency_graph:
  requires:
    - src/lib/parsers/extract-video-audio.ts (FFmpeg WASM audio extraction)
    - src/lib/upload/tus-upload.ts (TUS resumable upload)
    - src/actions/sops.ts (createVideoUploadSession server action)
    - /api/sops/transcribe (Phase 6 transcription pipeline)
    - src/components/admin/TusUploadProgress.tsx (progress bar)
  provides:
    - src/components/admin/VideoRecorder.tsx (full-screen recording overlay)
    - src/components/admin/VideoPreviewPanel.tsx (preview + submit flow)
    - src/components/admin/UploadDropzone.tsx (extended with Record video tab)
  affects:
    - Admin SOP upload page (/admin/sops/upload)
tech_stack:
  added: []
  patterns:
    - MediaRecorder API with codec selection (webm vp9/vp8 → mp4 fallback)
    - getUserMedia with facingMode toggle (front/rear camera)
    - useMemo for object URL lifecycle (avoids setState-in-effect pattern)
    - Stable ref pattern for setInterval closures (showToastInternalRef)
    - State machine with union type for recorder states
key_files:
  created:
    - src/components/admin/VideoRecorder.tsx
    - src/components/admin/VideoPreviewPanel.tsx
  modified:
    - src/components/admin/UploadDropzone.tsx
decisions:
  - MediaRecorder codec selection iterates webm(vp9,opus) → webm(vp8,opus) → webm → mp4; first supported wins
  - useMemo for object URL in VideoPreviewPanel avoids setState-in-effect lint rule; cleanup via paired useEffect
  - showToastInternal ref used in setInterval closure to avoid stale dependency without adding it to handleStartRecording deps
  - discard-confirm replaces controls bar content inline (not a modal) per UI-SPEC
metrics:
  duration: 9m
  completed: 2026-04-04
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  total_lines: 1659
---

# Phase 7 Plan 01: In-App Video Recording — Summary

**One-liner:** In-browser MediaRecorder overlay (VideoRecorder) with 9-state machine, audio-only FFmpeg WASM extraction, TUS upload via Phase 6 pipeline, and iOS fallback in UploadDropzone.

## What Was Built

### VideoRecorder.tsx (623 lines)
Full-screen recording overlay implementing VID-03 in-app recording. Key capabilities:
- 9-state machine: `requesting-permission` → `ready` → `recording` → `stopping` → `extracting-audio` → `preview`, plus `permission-denied`, `error`, `discard-confirm`
- Camera acquisition via `navigator.mediaDevices.getUserMedia` with front/rear toggle (`facingMode`). Front camera mirrors viewfinder via `scaleX(-1)`.
- MediaRecorder codec selection: vp9+opus → vp8+opus → webm → mp4. Options: 2.5Mbps video, 128kbps audio.
- 15-minute cap (D-06): timer counts up, switches to `text-red-400` + remaining suffix at 13:00, auto-stops at 15:00 with toast.
- Audio extraction in `onstop` handler: `extractAudioFromVideo(videoFile, onProgress)` via FFmpeg WASM, shows `TusUploadProgress`.
- Discard confirmation inline in controls bar (not a modal) when X tapped during `recording` state.
- Focus trap, keyboard navigation (Escape), aria attributes per UI-SPEC accessibility contract.
- Delegates to `VideoPreviewPanel` when state transitions to `preview`.

### VideoPreviewPanel.tsx (264 lines)
Post-recording preview panel for reviewing and submitting recordings.
- Object URL created via `useMemo(URL.createObjectURL, [videoBlob])` — avoids setState-in-effect lint error.
- Duration badge computed from `video.loadedmetadata` event, formatted MM:SS.
- Submit flow: `createVideoUploadSession` → TUS upload to `sop-videos` bucket → `fetch POST /api/sops/transcribe` → `onSubmitComplete(sopId)`.
- Upload progress shown inline on Submit button ("Uploading... 47%").
- Retake calls `onRetake()` which parent (VideoRecorder) handles by resetting state and restarting camera.

### UploadDropzone.tsx (extended, +94 lines net)
Third tab ("Record video") added alongside "Upload file" and "YouTube URL":
- Mode type extended: `'upload' | 'youtube' | 'record'`
- MediaRecorder capability detection on mount (D-05): checks `window.MediaRecorder` and `isTypeSupported('video/webm')`
- Capable device: dashed "Start recording" button → opens `VideoRecorder` overlay → `onSubmitComplete` navigates to `/admin/sops/{sopId}/review`
- iOS fallback (D-04): branded `bg-brand-orange/20` banner with `Smartphone` icon, guided copy, "Choose video file" button that triggers `videoInputRef` and switches to `upload` tab post-selection.
- `VideoRecorder` rendered below toast block with `recorderOpen` state gate.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create VideoRecorder and VideoPreviewPanel | `8328657` | VideoRecorder.tsx (new), VideoPreviewPanel.tsx (new) |
| 2 | Add Record video tab and iOS fallback to UploadDropzone | `a539e97` | UploadDropzone.tsx |
| fix | Resolve lint errors (Rule 1 deviation) | `103a6d9` | VideoPreviewPanel.tsx, VideoRecorder.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused selectedMime state in VideoRecorder**
- **Found during:** TypeScript compilation and lint check after Task 1
- **Issue:** `selectedMime` state was set but never read; TypeScript narrowing caused a comparison error on `recorderState === 'stopping'` inside `renderControlsContent` (narrowed to `'ready'` at that code path)
- **Fix:** Removed `selectedMime` state (closure over local `mime` variable suffices); removed unreachable disabled condition
- **Files modified:** `src/components/admin/VideoRecorder.tsx`
- **Commit:** `103a6d9`

**2. [Rule 1 - Bug] useMemo for object URL in VideoPreviewPanel**
- **Found during:** Lint check post-Task 2
- **Issue:** `setObjectUrl(url)` called synchronously inside `useEffect` body triggers "setState in effect" lint error
- **Fix:** Replaced `useState<string|null> + useEffect(setObjectUrl)` with `useMemo(() => URL.createObjectURL(videoBlob), [videoBlob])` + paired cleanup `useEffect` for revocation
- **Files modified:** `src/components/admin/VideoPreviewPanel.tsx`
- **Commit:** `103a6d9`

**3. [Rule 1 - Bug] Stable ref for setInterval toast closure**
- **Found during:** Lint check post-Task 2
- **Issue:** `showToastInternal` used inside `setInterval` closure in `handleStartRecording` but defined after it, creating a dependency warning and potential stale closure
- **Fix:** Moved `showToastInternal` before `handleStartRecording`; added `showToastInternalRef` updated via `useEffect` for use inside `setInterval`
- **Files modified:** `src/components/admin/VideoRecorder.tsx`
- **Commit:** `103a6d9`

## Known Stubs

The pre-existing "Scanner coming soon" placeholder modal in `UploadDropzone.tsx` (line ~740) was carried forward unchanged — it predates this plan and is tracked separately.

## Verification

- TypeScript: `npx tsc --noEmit` — passes (0 errors)
- Lint: `npm run lint` — no errors in our 3 files; 12 pre-existing errors in unrelated files
- Build: not run (dev environment; manual smoke test required per plan verification section)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/components/admin/VideoRecorder.tsx` | FOUND |
| `src/components/admin/VideoPreviewPanel.tsx` | FOUND |
| `src/components/admin/UploadDropzone.tsx` | FOUND |
| commit `8328657` | FOUND |
| commit `a539e97` | FOUND |
| commit `103a6d9` | FOUND |
