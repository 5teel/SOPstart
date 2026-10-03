---
phase: 55-cut-the-dropped-features-one-organisation
plan: 05
subsystem: authoring-voice
tags: [voice, deletion, ai-registry, sweep]
requires:
  - phase: 55-04
    provides: worker UI with no voice callers
provides:
  - /admin/sops/new/ai opening straight onto the typed brief
  - no voice endpoint, module, validator or AI model key
  - sop-pack under agent-layer with its byte-identity test in phase55
  - voice sweep live and mutation-proven
affects: [55-08, 55-14]
tech-stack:
  added: []
  patterns:
    - "A shared helper used by a surviving subsystem moves out of a deleted directory before the directory goes"
key-files:
  modified:
    - src/app/(protected)/admin/sops/new/ai/AiDraftFork.tsx
    - src/lib/parsers/verify-sop.ts
    - src/lib/ai/registry.ts
    - src/lib/ai/model-options.ts
    - src/types/sop.ts
    - src/lib/agent-layer/synthesis.ts
    - src/components/admin/builder-v2/inserter/inserter-model.ts
    - src/lib/journeys/journeys.ts
    - playwright.config.ts
    - tests/phase55/deletion-sweep.spec.ts
  created:
    - src/lib/agent-layer/sop-pack.ts (git mv from lib/voice)
    - tests/phase55/sop-pack.spec.ts (git mv from lib/voice/__tests__)
  deleted:
    - src/lib/voice/ (all), src/hooks/useDeepgramWebSocket.ts
    - src/lib/validators/voice-query.ts, voice-tts.ts
    - src/app/api/voice/ (query, token, tts), src/app/api/sops/voice-draft/, src/app/api/sops/[sopId]/ask/
    - VoiceDraftClient.tsx
    - 6 voice specs/fixture (phase22 x3, voice-grounding-scope, voice-qa-persistence, anthropic-voice-mock)
key-decisions:
  - "AddMenu.tsx keeps its VoiceNoteBlock styling-map entry: it is grouping metadata for existing sections, not an insert offer; the inserter list lost it"
  - "tts-video key stays in the registry until 55-08 removes video generation"
requirements-completed: [CUT-01]
duration: ~30min
completed: 2026-10-03
---

# Phase 55 Plan 05: Voice authoring and server side removed

**AiDraftFork is now just the typed brief; every voice and ask endpoint, the streaming/TTS modules, five AI model keys and the builder's add-voice-note entry are gone, with sop-pack moved byte-identical to the agent layer.**

## Accomplishments

- `AiDraftFork` renders `PromptClient` directly (export and `departments` prop unchanged, so `page.tsx` untouched). No mode modal, no `?mode=`.
- `sop-pack.ts` moved to `src/lib/agent-layer/`; `synthesis.ts` imports it there; its 6-test byte-identity spec now runs in `phase55`.
- `verify-sop.ts` lost the `voice_qa` mode, `VOICE_QA_VERIFY_SYSTEM`/`MODEL`; transcript and prompt modes untouched.
- `registry.ts`/`model-options.ts` lost `voice-qa`, `sop-ask`, `voice-draft`, `stt-stream`, `tts-voice`. `stt-batch`, `ocr-fallback`, `vision-image-describe`, parse/verify/synthesis/embed and `tts-video` remain. `VoiceQueryResponse` removed from `types/sop.ts`.
- Kept per D-05: `/api/sops/transcribe`, `transcribe-audio.ts`, `DEEPGRAM_API_KEY`, `readVoiceSignals` / `sop_voice_qa_log`.
- `phase15-unit` project and the two voice alternatives in the `phase15-stubs` regex removed. `signal-readers.spec` now asserts `sop_voice_qa_log`; `create-entry.spec` asserts the fork is a straight PromptClient wrapper.
- `create-with-voice` journey deleted, `create-with-ai` detail rewritten, "AI-voice" dropped from the capability matrix Create SOP row (the "Last updated" date was already 2026-10-03).

## Verification

- `npx tsc --noEmit` clean for src/tests (only stale generated `.next/types` entries for deleted routes before the rebuild); `npm run build` exit 0. Bundle: `/sops/[sopId]/page` 935 KB, `/sops/page` 827 KB (unchanged vs 55-04; neither grew).
- `phase55` 52 passed; `phase15-stubs`, `phase26`, `phase26.5`, `phase30`, `phase40`, `phase23-unit`, `phase22-stubs` combined: 373 passed, 11 skipped, 0 failed. `--list` shows 0 `phase15-unit` tests.

### Mutation proof (voice sweep)

| Step | Result |
|---|---|
| Appended `fetch('/api/voice/token')` to `src/components/sop/StepItem.tsx`, ran `deletion-sweep -g voice` | RED, offender `StepItem.tsx:120` listed |
| `git checkout -- StepItem.tsx`, re-ran | GREEN, 14 passed |

## Task Commits

1. `c21b7e7` delete voice drafting, voice/ask endpoints and voice model keys
2. `653ecc1` remove add-voice-note entry, drop voice specs/config, flip voice sweep live

## Deviations from Plan

**1. [Rule 1 - Bug, self-inflicted] Quoted forbidden literal in new test**
- A `not.toContain('VoiceDraftClient')` assertion I added to `create-entry.spec.ts` tripped the voice symbol sweep (the known quoted-literal learning). Removed that one assertion; the `PromptClient` and `Talk it through` / fork-modal checks remain.

**2. [Rule 3] Comment-only references to the old client**
- `SopMetadataFields.tsx` and `blueprint-theme.css` comments named `VoiceDraftClient`, which the symbol sweep scans; reworded (commit `c21b7e7`).

Plan note: `tests/integration/voice-qa-happy-path.spec.ts` was already deleted by 55-04; only the regex alternative was removed here.

## Known Stubs

None.

## Threat Flags

None. `/api/voice/token` and the paid LLM/TTS endpoints no longer exist (T-55-05-01/02); the deployed eval in 55-14 will confirm.

## Hand-offs

- 55-08: `tts-video` registry key leaves with `lib/video-gen`.
- Not pushed; orchestrator pushes at phase end.

## Self-Check: PASSED

- Commits `c21b7e7`, `653ecc1` exist; `src/lib/voice`, `src/app/api/voice`, `VoiceDraftClient.tsx` absent; `src/lib/agent-layer/sop-pack.ts` and `src/app/api/sops/transcribe/route.ts` present.
