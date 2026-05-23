# Deprecated: /sops/[sopId]/walkthrough — Function Assessment

**Deprecated:** 2026-04-27
**Replaced by:** `/sops/[sopId]?tab=walkthrough` (WalkthroughTab + ImmersiveStepCard)
**Route status:** URL now redirects to the new tab.
**Audit updated:** 2026-05-06 — 7 of 9 functions wired during 12.5; 2 partial gaps remain.

The original assessment (2026-04-27) flagged 9 walkthrough functions that had not yet been
carried into the new ImmersiveStepCard / WalkthroughTab design. Subsequent commits
(`fecd2ae` — full completion flow into WalkthroughTab; `4f0cb09` — evidence capture grid +
photo gate into ImmersiveStepCard) closed most of these. This document is now an audit
record, not an open task list.

---

## Audit (2026-05-06)

| # | Function | Status | Evidence |
|---|---|---|---|
| 1 | Safety Acknowledgement Gate | ✅ Wired | `WalkthroughTab.tsx:194-202` renders `SafetyAcknowledgement` when `!acknowledged`; calls `walkthroughStore.acknowledgeSafety(sopId)` on confirm |
| 2 | Step Completion Marking | ✅ Wired | `handleMarkComplete` writes to walkthrough store + completion store and auto-advances (`WalkthroughTab.tsx:100-114`); button lives in the sticky footer (`:335-347`) and in list mode rows (`:268-274`) |
| 3 | Progress Bar | ✅ Wired | Paper/ink themed bar with N-of-M + percent (`WalkthroughTab.tsx:205-220`) |
| 4 | Photo Capture per Step | ✅ Wired (immersive) | `handleCapturePhoto` auto-starts completion + queues (`WalkthroughTab.tsx:87-98`); full evidence grid with `capture="environment"`, per-photo status, remove button (`ImmersiveStepCard.tsx:89-138`); photo gate enforced via `photoGateMet` (`:67`, `:338`) |
| 5 | Photo Queue Indicator | ⚠ Partial | Per-photo Uploaded/Queued chip + spinner present (`ImmersiveStepCard.tsx:108-130`); no aggregate "N photos queued" header badge and no pre-submit warning if uploads still pending |
| 6 | Submit Completion | ✅ Wired | `WalkthroughTab.tsx:116-168` — SHA-256 canonical hash (D-03), reads uploaded photos from Dexie, calls `submitCompletion`, success screen at `:171-188`, rollback to `in_progress` on failure |
| 7 | In-Progress Completion Resume (D-02) | ✅ Wired | `completionStore.restoreFromDexie(sop.id)` on mount (`WalkthroughTab.tsx:31-34`) |
| 8 | Online Photo Flush on Reconnect | ✅ Wired | `window.addEventListener('online', flush)` calling `flushPhotoQueue` with cleanup (`WalkthroughTab.tsx:36-44`) |
| 9 | List Mode Walkthrough | ⚠ Partial | `<ol>` with View / Mark done buttons + photo-required indicator (`WalkthroughTab.tsx:240-281`); no inline photo capture per row — workers must switch to immersive mode to capture |

---

## Outstanding gaps

### Gap A — Aggregate photo queue indicator + submit-time warning
**Risk:** A worker could submit thinking a photo was captured when the upload silently failed.
The current per-photo chip shows status, but there is no global indicator and no confirm-step
on Submit when uploads are still pending. `submitCompletion` only sends photos with
`uploaded === true`, so a partially-uploaded completion is silently submitted without the
queued photo.

**Scope:**
- Header badge near the progress bar showing pending count when `db.photoQueue.where({uploaded: false}).count() > 0`.
- On Submit, if pending count > 0, show a confirm dialog: "N photos still uploading — submit anyway, or wait?"

### Gap B — List mode photo capture parity
**Status:** Likely out of scope. The current pattern ("list mode for desktop browse,
immersive mode for capture") is defensible. List mode already shows the photo-required flag
per step and the View button jumps the worker to that step in immersive mode where capture
works. Confirm whether parity is required before scoping any work.

---

## Existing Infrastructure (still valid)

| Infrastructure | Location | Status |
|---|---|---|
| `useCompletionStore` (Dexie in-progress tracking) | `src/stores/completionStore.ts` | In use |
| `submitCompletion` server action | `src/actions/completions.ts` | In use |
| `usePhotoQueue` / `addPhotoToQueue` / `flushPhotoQueue` | `src/hooks/usePhotoQueue.ts`, `src/lib/offline/sync-engine.ts` | In use |
| `SafetyAcknowledgement` component | `src/components/sop/SafetyAcknowledgement.tsx` | In use |
| `useWalkthroughStore` (in-memory step state) | `src/stores/walkthrough.ts` | In use |
| `WalkthroughList` component (legacy) | `src/components/sop/WalkthroughList.tsx` | Superseded by inline list in `WalkthroughTab.tsx`; legacy file retained — verify before removal |
| `StepProgress` component (legacy) | `src/components/sop/StepProgress.tsx` | Superseded by inline progress bar in `WalkthroughTab.tsx`; legacy file retained — verify before removal |
| Dexie `photoQueue` + `completions` tables | `src/lib/offline/db.ts` | In use |
