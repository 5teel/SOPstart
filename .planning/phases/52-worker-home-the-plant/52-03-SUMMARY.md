---
phase: 52-worker-home-the-plant
plan: 03
subsystem: ui
tags: [playwright, source-contract, next-dynamic, bundle-gate, voice, plant]

# Dependency graph
requires:
  - phase: 52-worker-home-the-plant
    plan: 01
    provides: phase52 Playwright project + worker-signal.ts (NowItem/pickNowQueue/PLANT_REL_LABEL/askMatches/narrowForAsk), RelBadge.tsx, Konva/voice bundle guards
  - phase: 52-worker-home-the-plant
    plan: 02
    provides: PlantStage.tsx, MachinePanel.tsx, scene.ts camera constants
provides:
  - src/components/sop/plant/NowCard.tsx -- NowCard (D-10)
  - src/components/sop/plant/PlantAskBar.tsx -- PlantAskBar (D-13), the second sanctioned next/dynamic site for WalkthroughVoiceModal
  - tests/lint/no-static-desktop-import.spec.ts -- WalkthroughVoiceModal allowlist extended to [WalkthroughSwitcher.tsx, PlantAskBar.tsx]
  - tests/phase52/plant-now-card.spec.ts and plant-ask-bar.spec.ts flipped from fixme to live
affects: [52-04-render-seam, 52-05-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A second next/dynamic({ ssr:false }) reference site for an already-dynamic component is added to the SAME lint guard's allowlist, not a new guard (no-static-desktop-import.spec.ts)"
    - "A component that must not classify state (2026-09-27 rule) receives already-computed values (NowItem.rel) rather than calling the classifier itself"

key-files:
  created:
    - src/components/sop/plant/NowCard.tsx
    - src/components/sop/plant/PlantAskBar.tsx
  modified:
    - src/components/sop/voice/WalkthroughVoiceModal.tsx
    - tests/lint/no-static-desktop-import.spec.ts
    - tests/phase52/plant-now-card.spec.ts
    - tests/phase52/plant-ask-bar.spec.ts

key-decisions:
  - "NowCard reads step minutes via a plain async Dexie query (db.sections.where('sop_id').equals(id).primaryKeys() -> db.steps.where('section_id').anyOf(keys)) inside useQuery, offlineFirst, 5 min staleTime -- reads only, no writes, keeping the plant-pins-no-storage.spec.ts guarantee intact"
  - "The mic's onVoiceNext/onVoicePrev are NOOP (ponytail-commented) -- no walkthrough exists to drive from the home screen; currentStepText is always '' so the modal never reads a stale step aloud on open"
  - "WalkthroughVoiceModal's bundle-isolation comment was updated to name PlantAskBar.tsx as the second dynamic site -- code in the modal itself is unchanged"

patterns-established:
  - "Extending a bundle-isolation lint guard for a second legitimate dynamic-import site: add a second ALLOWED_* list scoped to the specific test, leave the other component's (DesktopWalkthrough) single-file allowlist untouched"

requirements-completed: [HOM-03, HOM-05]

# Metrics
duration: ~25min
completed: 2026-09-29
---

# Phase 52 Plan 03: Now Card and Ask Bar Summary

**`NowCard` (bottom-left, single next procedure, Walk it / Show me, D-10) and `PlantAskBar` (the page's one search query relocated onto the scene, mic opens the existing `WalkthroughVoiceModal` via a second sanctioned `next/dynamic` site, D-13) -- both pure presentation components ready for 52-04's composition**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-29
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Built `NowCard.tsx` (D-10): `NEXT FOR YOU` header + `RelBadge`, title, mono meta line (machine · department · `~min` · last done / never done), primary `Walk it` link to `/sops/<id>?tab=walk`, secondary `Show me` button (only when the item has a linked machine) calling the `onShowMe(machineId)` callback, and up to two `Then:` lines from `items.slice(1, 3)`. Empty queue renders "Nothing due — browse your machines." instead of fabricated content. Step-minutes are read offline-first from cached Dexie `sections`/`steps` via `useQuery`, keyed on the top item's SOP id, enabled only when one exists so hook order stays stable between empty and non-empty renders.
- Built `PlantAskBar.tsx` (D-13): input bound directly to the caller's `value`/`onChange` (no second query state, no `router.push`), a clear button, and a mic button (`disabled={!voiceSopId}`) that opens the existing `WalkthroughVoiceModal` — imported via `next/dynamic({ ssr: false })` inside this module, mirroring `WalkthroughSwitcher.tsx`'s own dynamic import so Next dedupes the chunk. The mic's `onVoiceNext`/`onVoicePrev` are a `ponytail:`-commented no-op (no walkthrough to drive from the home screen); `currentStepText=""` so nothing is read aloud on open.
- Extended `tests/lint/no-static-desktop-import.spec.ts`'s `WalkthroughVoiceModal` guard from a single allowed file to a two-file allowlist (`WalkthroughSwitcher.tsx`, `PlantAskBar.tsx`), each still required to reference it only via `next/dynamic`. The separate `DesktopWalkthrough` guard/test was left untouched (still single-file). Updated the file's header comment and `WalkthroughVoiceModal.tsx`'s own bundle-isolation comment to name both sanctioned sites.
- Flipped both `tests/phase52/plant-now-card.spec.ts` and `plant-ask-bar.spec.ts` from `test.fixme` stubs to live source-contract assertions (10 tests total), asserting handler wiring (`onClick` bodies, `onChange` bodies, the `voiceOpen && voiceSopId` gate before the modal element, the dynamic-import regex) rather than mere string presence, per the 2026-06-05 source-contract convention.

## Task Commits

Each task was a single commit:

1. **Task 1: NowCard** - `32adc52` (feat)
2. **Task 2: PlantAskBar + voice-modal guard extension** - `9bb2033` (feat)

## Files Created/Modified
- `src/components/sop/plant/NowCard.tsx` - the bottom-left Now card
- `src/components/sop/plant/PlantAskBar.tsx` - the on-scene ask bar + mic-to-voice-modal wiring
- `src/components/sop/voice/WalkthroughVoiceModal.tsx` - bundle-isolation comment names the second dynamic site (no code change)
- `tests/lint/no-static-desktop-import.spec.ts` - `WalkthroughVoiceModal` allowlist extended to two files
- `tests/phase52/plant-now-card.spec.ts` - flipped fixme -> live (7 tests)
- `tests/phase52/plant-ask-bar.spec.ts` - flipped fixme -> live (3 tests)

## Decisions Made
- `NowCard` never calls `plantRelState(` itself — it consumes the already-classified `NowItem.rel`/`PLANT_REL_LABEL`, keeping worker-signal.ts as the sole classifier (2026-09-27 rule); the source-contract spec asserts the absence of a local `plantRelState(` call as well as `.sort(`.
- Step-minutes query is a plain read-only async function (`sopMinutes`), not a new hook file — it's small, single-use, and colocated with its only caller; no `.put(`/`.add(`/`.delete(` anywhere in the file, verified by both the plan's own spec and the pre-existing `plant-pins-no-storage.spec.ts` (f) sweep of `src/components/sop/plant/`.
- The ask bar's mic button sits outside the `<label>` wrapping the input, so clicking it never focuses/opens the search keyboard on mobile-width admin previews (not a worker-facing concern at ≥1024px, but keeps the DOM correct regardless).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- `NowCard({ items, onShowMe })` and `PlantAskBar({ value, onChange, voiceSopId })` are both pure presentation components with no internal data-fetching beyond the minutes read (which needs no props threading) — 52-04's `PlantHome` composition can wire them directly to `pickNowQueue()` output and the page's existing `query`/`setQuery` state.
- The voice-modal bundle guard already expects `PlantAskBar.tsx` to exist and reference `WalkthroughVoiceModal` dynamically — 52-04 does not need to touch `tests/lint/no-static-desktop-import.spec.ts` again.
- No blockers.

## Self-Check: PASSED

- FOUND: src/components/sop/plant/NowCard.tsx
- FOUND: src/components/sop/plant/PlantAskBar.tsx
- FOUND: tests/phase52/plant-now-card.spec.ts (0 test.fixme)
- FOUND: tests/phase52/plant-ask-bar.spec.ts (0 test.fixme)
- FOUND: tests/lint/no-static-desktop-import.spec.ts contains "PlantAskBar.tsx"
- FOUND commit 32adc52 (git log --oneline)
- FOUND commit 9bb2033

---
*Phase: 52-worker-home-the-plant*
*Completed: 2026-09-29*

## Self-Check: PASSED (verified)
