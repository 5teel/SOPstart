# Deprecated: /sops/[sopId]/walkthrough — Function Assessment

**Deprecated:** 2026-04-27
**Replaced by:** `/sops/[sopId]?tab=walkthrough` (WalkthroughTab + ImmersiveStepCard)
**Route status:** URL now redirects to the new tab.

The old full-page walkthrough (`src/app/(protected)/sops/[sopId]/walkthrough/page.tsx`) contained
completion-tracking functionality that has NOT been carried into the phase 12.5 ImmersiveStepCard.
These functions need assessment before a future phase builds them into the new design.

---

## Functions Not Carried Over

### 1. Safety Acknowledgement Gate
**What it did:** Before showing any steps, displayed hazard/PPE/emergency section content and
required the worker to tap "I understand" (per-session, re-required on each walkthrough start).
Per design decision D-02: safety re-acknowledgement must not persist across sessions.
**Components:** `SafetyAcknowledgement` component, `useWalkthroughStore.acknowledgeSafety()`,
`useWalkthroughStore.isAcknowledged()`
**Assessment needed:** Does the new immersive card flow need a pre-walkthrough gate, or should
hazard callouts be inline per-step? Regulatory/liability implications for NZ industrial context.

### 2. Step Completion Marking
**What it did:** Per-step "Mark step N complete" button. Stored completed step IDs in:
- Zustand `walkthroughStore` (in-memory, session only per D-02)
- Dexie `completions` table (offline-persistent across sessions for in-progress records)
**Current state:** `ImmersiveStepCard` has Prev/Next navigation but no completion marking.
`upsertWalkthroughProgress` saves a progress pointer but does not record individual step sign-offs.
**Assessment needed:** How does the new card UX handle "mark complete"? Swipe gesture? Tap footer?

### 3. Progress Bar
**What it did:** `StepProgress` component — horizontal strip showing N/M steps completed.
**Assessment needed:** Where does this live in the immersive card design? Header or footer?

### 4. Photo Capture per Step
**What it did:**
- Camera button per step; captured photos queued in Dexie `photoQueue` table
- `photo_required` flag on SopStep: blocked marking step complete until photo was taken
- `addPhotoToQueue` / `removePhoto` hooks
- Immediate upload attempt if online; offline queue flushed on reconnect
**Components:** `StepPhotoZone` (within `WalkthroughList`), `usePhotoQueue`, `addPhotoToQueue`,
`flushPhotoQueue`
**Assessment needed:** Photo capture UI must be designed for the new card layout.
The offline queue infrastructure already exists — it just needs a new trigger surface.

### 5. Photo Queue Indicator
**What it did:** Top bar badge showing "N photos queued" in orange when offline uploads pending.
Warned before submission if photos still uploading.
**Assessment needed:** Where does this indicator live in the immersive card header?

### 6. Submit Completion
**What it did:**
- SHA-256 content hash of all step texts (tamper/version detection, decision D-03)
- Gathered uploaded photo storage paths from Dexie
- Called `submitCompletion` server action → inserted row into `sop_completions` table
- Cleared in-progress completion from Dexie on success
- Showed success confirmation screen (CheckCircle2 + "Completion submitted")
**This is the most critical missing function.** Without it, workers cannot formally complete SOPs
and supervisors have nothing to review in `/activity`.
**Assessment needed:** Where does the submit CTA live in the new design? After final step card?

### 7. In-Progress Completion Resume (D-02 Dexie Restore)
**What it did:** On mount, called `completionStore.restoreFromDexie(sopId)` to resume any
in-progress completion (e.g., app backgrounded mid-walkthrough).
**Assessment needed:** The new tab-based design must handle resume without a dedicated page mount.

### 8. Online Photo Flush on Reconnect
**What it did:** `window.addEventListener('online', flushOnline)` triggered `flushPhotoQueue`
when network returned during a walkthrough session.
**Assessment needed:** This listener needs to live in the walkthrough tab or a parent provider.

### 9. List Mode Walkthrough
**What it did:** `WalkthroughList` component — all steps visible at once, expandable, with
inline photo zones, hazard callouts, and step completion per row. Used as the desktop "list mode"
alternative to immersive cards.
**Current state:** `WalkthroughTab` has a stub list mode (simple `<ol>` with "Go to step" buttons,
no completion marking, no photos).
**Assessment needed:** Full list mode parity with the old WalkthroughList, adapted to the new
paper/ink design system.

---

## Existing Infrastructure (Ready to Reuse)

These pieces are built and working — a future phase only needs to wire UI onto them:

| Infrastructure | Location | Status |
|---|---|---|
| `useCompletionStore` (Dexie in-progress tracking) | `src/stores/completionStore.ts` | Ready |
| `submitCompletion` server action | `src/actions/completions.ts` | Ready |
| `usePhotoQueue` / `addPhotoToQueue` / `flushPhotoQueue` | `src/hooks/usePhotoQueue.ts`, `src/lib/offline/sync-engine.ts` | Ready |
| `SafetyAcknowledgement` component | `src/components/sop/SafetyAcknowledgement.tsx` | Ready |
| `StepProgress` component | `src/components/sop/StepProgress.tsx` | Ready |
| `useWalkthroughStore` (in-memory step state) | `src/stores/walkthrough.ts` | Ready |
| `WalkthroughList` component | `src/components/sop/WalkthroughList.tsx` | Ready (needs paper/ink reskin) |
| Dexie `photoQueue` + `completions` tables | `src/lib/offline/db.ts` | Ready |

---

## Recommended Future Phase Scope

**Phase title:** Walkthrough Completion — Immersive Card Parity
**Goal:** Wire submission, safety gate, photo capture, and progress tracking into the new
ImmersiveStepCard / WalkthroughTab design so workers can formally complete SOPs.
**Priority:** HIGH — without this, the Activity feed and supervisor sign-off flow have no input.
