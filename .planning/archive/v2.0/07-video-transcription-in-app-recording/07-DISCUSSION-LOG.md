# Phase 7: Video Transcription (In-App Recording) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 07-video-transcription-in-app-recording
**Areas discussed:** Recording UX flow, iOS fallback experience, Video quality & limits

---

## Recording UX Flow

### Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Third tab in UploadDropzone | Add Record tab alongside Upload file and YouTube URL. | ✓ |
| Separate page | Dedicated /admin/sops/record page. | |
| Button on SOP list page | Alongside Upload SOP button. | |

**User's choice:** Third tab in UploadDropzone

### Camera View

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen overlay | Full-screen camera with record/stop/pause, timer, close button. | ✓ |
| Inline camera preview | Camera within the dropzone area. | |
| You decide | Claude picks. | |

**User's choice:** Full-screen overlay

### Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Preview + submit/retake | After stopping, show playback with Submit and Retake buttons. | ✓ |
| Submit immediately on stop | No preview, immediate upload. | |
| You decide | Claude picks. | |

**User's choice:** Preview + submit/retake

---

## iOS Fallback Experience

### Fallback UX

| Option | Description | Selected |
|--------|-------------|----------|
| Guided fallback with file picker | Message + prominent "Choose video file" button opening iOS picker. | ✓ |
| Simple message only | Text message linking to Upload tab. | |
| Hide Record tab on iOS | Don't show the tab at all. | |

**User's choice:** Guided fallback with file picker

---

## Video Quality & Limits

### Max Duration

| Option | Description | Selected |
|--------|-------------|----------|
| 15 minutes max | Countdown in last 2 min. Auto-stop. | ✓ |
| 30 minutes max | More generous for complex procedures. | |
| No limit | Record as long as needed. | |
| You decide | Claude picks. | |

**User's choice:** 15 minutes max

### Compression

| Option | Description | Selected |
|--------|-------------|----------|
| Extract audio, upload audio only | FFmpeg WASM strips video, uploads MP3 via TUS. Same as Phase 6. | ✓ |
| Upload full video | Complete video via TUS. Preserves video for review. | |
| You decide | Claude picks. | |

**User's choice:** Extract audio, upload audio only

---

## Claude's Discretion

- MediaRecorder config, camera selection, recording indicator, permission handling, mobile data warning, pause/resume details

## Deferred Ideas

- Per-org recording quality settings
- Video-to-video recording (upload actual video)
- Recording pause/resume on Android
