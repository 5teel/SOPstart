---
phase: 55-cut-the-dropped-features-one-organisation
plan: 04
subsystem: worker-path
tags: [voice, deletion, bundle-gate, sweep]
requires:
  - phase: 55-03
    provides: walkthrough on the direct photo path
provides:
  - walkthrough, step cards and plant ask bar with no voice, read-aloud or microphone
  - inert MeasurementBlock (typed entry) and VoiceNoteBlock (plain-text prompt)
  - bundle gate without voice assertions
  - voice-capture sweep live and mutation-proven
affects: [55-05, 55-09]
tech-stack:
  added: []
  patterns:
    - "A retired block type stays registered and renders its stored prompt as static text, so old layout_data never crashes"
key-files:
  created: []
  modified:
    - src/components/sop/walkthrough/WalkthroughSwitcher.tsx
    - src/components/sop/walkthrough/MobileWalkthrough.tsx
    - src/components/sop/walkthrough/ImmersiveStepCard.tsx
    - src/components/sop/walkthrough/DesktopWalkthrough.tsx
    - src/components/sop/plant/PlantAskBar.tsx
    - src/components/sop/plant/PlantHome.tsx
    - src/components/sop/plant/PhoneHome.tsx
    - src/components/sop/blocks/MeasurementBlock.tsx
    - src/components/sop/blocks/VoiceNoteBlock.tsx
    - src/lib/offline/sync-engine.ts
    - scripts/check-bundle-size.ts
    - src/lib/journeys/journeys.ts
    - tests/phase55/deletion-sweep.spec.ts
  deleted:
    - src/components/sop/voice/ (ReadAloudButton, useTtsPlayback, WalkthroughVoiceButton, WalkthroughVoiceModal)
    - src/components/sop/VoiceCaptureControl.tsx
    - src/actions/voice-notes.ts
    - src/lib/offline/voice-queue.ts
    - tests/phase22/voice-modal.spec.ts
    - tests/phase22/voice-safety-gate.spec.ts
    - tests/sb-ux-voice.test.ts
    - tests/integration/voice-qa-happy-path.spec.ts
key-decisions:
  - "VoiceNoteBlock stays in block-registry, introspection and the Zod union (contract-check needs it); only its component became static"
  - "MeasurementBlockPropsSchema keeps voiceEnabled so stored layout_data still validates"
  - "plant-home.eval.ts is excluded from the sweep's tests scan because it asserts the mic test id is absent"
requirements-completed: [CUT-01]
duration: ~35min
completed: 2026-10-03
---

# Phase 55 Plan 04: Worker voice removed

**No step offers a microphone or read-aloud any more: the walkthrough voice bridge and modal, the plant ask-bar mic, and voice capture inside measurement / voice-note sections are gone, old sections still render, and the build and bundle gate are green with both gated routes smaller than before.**

## Accomplishments

- `WalkthroughSwitcher` is now a plain Mobile/Desktop switch (one `dynamic(...)`, for DesktopWalkthrough). `MobileWalkthrough` is a plain function component: forwardRef, the imperative handle and the voice-state push are gone; ack gate, forward-jump guard and the 55-03 photo path are untouched.
- `ReadAloudButton` removed from `ImmersiveStepCard` and `DesktopWalkthrough`; `PlantAskBar` is search only (no `voiceSopId` prop, `PlantHome`/`PhoneHome` updated).
- `MeasurementBlock` keeps its typed input; `VoiceNoteBlock` renders the prompt as plain text with its `data-block` attributes. Both schemas unchanged; block-registry, introspection and validators untouched.
- Deleted the voice dir, `VoiceCaptureControl`, `voice-notes` action and `voice-queue`; `sync-engine.ts` lost its re-export. `sop_voice_notes` rows and the `sop-voice-notes` bucket are untouched (no DB change).
- `check-bundle-size.ts`: removed the `WalkthroughVoiceModal` chunk assertion, `voiceFound`, and the `voice modal (52 D-13)` marker group. Baseline file not touched.
- Specs/evals/maps: four voice specs deleted; `no-static-desktop-import`, `plant-ask-bar`, `plant-render-seam`, `desktop-walkthrough-layout` repointed; plant-home eval step 9 now asserts `plant-ask-mic` count is 0; `journeys.ts` lost the voice step and mic/voice wording; `playwright.config.ts` `phase12.5-stubs` regex lost `voice`. `uat/tests.ts` had no voice wording, unchanged.

## Verification

- `npx tsc --noEmit` clean; `npx tsx scripts/contract-check.ts` exit 0 (18 blocks in all three registries); `npm run build` exit 0.
- Bundle (`check-bundle-size:` lines): `/sops/[sopId]/page` 935 KB, `/sops/page` 827 KB. "Bundle before" in 55-BASELINE-FAILURES.md was 1045 / 936 (55-03: 943 / 827). Neither route grew.
- Projects run: `phase55` 42 passed; `phase52` 94 passed; `phase15-stubs` 94 passed (includes `no-static-desktop-import`, `no-dead-internal-hrefs`, `desktop-walkthrough-layout`); `phase22-stubs` + `phase12.5-stubs`: 18 passed, 5 failed, all five already in the baseline (#11-#15, ECONNREFUSED needing a running server).
- Evals list still discovers `plant-home.eval.ts`; not run (no push yet, see below).

### Mutation proof (voice-capture sweep)

| Step | Result |
|---|---|
| Planted a `VoiceCaptureControl` import at line 1 of `VoiceNoteBlock.tsx`, ran `deletion-sweep.spec.ts -g voice-capture` | RED: `src/ has no reference` listed `VoiceNoteBlock.tsx:1`; 1 failed / 4 passed |
| Restored the file (no diff) and re-ran | GREEN: 5 passed |

## Task Commits

1. `9964017` strip the voice bridge from the walkthrough and the mic from the plant ask bar
2. `be004fb` delete voice capture; measurement and voice-note sections render inert; bundle gate edited
3. `8166b87` repoint voice guards, drop voice specs, flip voice-capture sweep live

## Deviations from Plan

**1. [Rule 3 - Blocking] `VoiceDraftClient.tsx` imported the deleted `useTtsPlayback`**
- tsc failed after deleting `src/components/sop/voice/`. The file belongs to 55-05 (create-with-voice, deleted whole there), so I only removed its read-aloud call, hook import and hook use; the typed/voice draft flow otherwise unchanged. Commit `be004fb`. The "Mute replies" checkbox in that file is now a no-op until 55-05 deletes the file.

**2. [Rule 3 - Blocking] `tests/integration/voice-qa-happy-path.spec.ts` deleted here instead of 55-05**
- It reads the deleted modal/button files and (via the symbol pattern) made the `voice-capture` sweep's `tests/ has no reference` test fail. Deleted in `8166b87`. 55-05 still lists it and `voice-qa-happy-path|` in the `phase15-stubs` regex in `playwright.config.ts`: the file is already gone, so 55-05 only needs to remove the regex alternative.

## Known Stubs

None.

## Threat Flags

None. `/api/voice/*` remain auth-gated and live until 55-05 (T-55-04-03 accepted); their only worker callers are gone.

## Hand-offs

- 55-05: `VoiceDraftClient.tsx` (now without read-aloud), `src/lib/voice/`, `/api/voice/*`, and the `voice-qa-happy-path` alternative in the `phase15-stubs` regex.
- Not pushed: master is ahead of origin; the orchestrator pushes at phase end. The plant-home eval change is unrun until then.

## Self-Check: PASSED

- Commits `9964017`, `be004fb`, `8166b87` exist; `src/components/sop/voice`, `VoiceCaptureControl.tsx`, `voice-notes.ts`, `voice-queue.ts` are absent; `VoiceNoteBlock` still referenced in block-registry and introspection.
