---
phase: 22-voice-driven-walkthrough
plan: 02
subsystem: voice-infrastructure
tags: [tts, stt, deepgram, openai, intent-classifier, keyterms, tdd]
dependency_graph:
  requires:
    - 22-01 (phase22-stubs test harness — specs that this plan turns green)
  provides:
    - src/lib/voice/intent-classifier.ts (classifyIntent + VoiceIntent type)
    - src/lib/voice/extract-keyterms.ts (extractKeyterms helper)
    - src/lib/voice/deepgram-stream.ts (keyterms extension)
    - src/lib/voice/tts-constants.ts (TTS_MODEL shared constant)
    - src/lib/validators/voice-tts.ts (voiceTtsSchema + VoiceTtsInput)
    - src/app/api/voice/tts/route.ts (auth-gated TTS streaming route)
    - src/components/sop/voice/useTtsPlayback.ts (fail-silent TTS hook)
    - src/lib/voice/__tests__/intent-classifier.test.ts (behavioral unit tests)
  affects:
    - Plan 22-03 (WalkthroughVoiceModal live wiring uses all primitives from this plan)
    - Plan 22-04 (ImmersiveStepCard — no direct dep but shares voice layer context)
tech_stack:
  added: []
  patterns:
    - classifyIntent: pure TS intent gate (QUESTION_WORDS → PREV → NEXT with length cap)
    - Deepgram keyterm URL injection: params.append('keyterm', kt) per-term loop
    - TTS route: mirrors voice/query route auth + concurrency + error-code contract
    - useTtsPlayback: fail-silent fetch → object URL → audio.play() with try/catch
    - TTS_MODEL: process.env override pattern (prevents silent model-rot)
key_files:
  created:
    - src/lib/voice/intent-classifier.ts
    - src/lib/voice/extract-keyterms.ts
    - src/lib/voice/tts-constants.ts
    - src/lib/validators/voice-tts.ts
    - src/app/api/voice/tts/route.ts
    - src/components/sop/voice/useTtsPlayback.ts
    - src/lib/voice/__tests__/intent-classifier.test.ts
  modified:
    - src/lib/voice/deepgram-stream.ts (keyterms field + URL injection)
    - tests/phase22/intent-classifier.spec.ts (source-contract assertions, Rule 1 fix)
decisions:
  - TTS_MODEL constant overridable via process.env.TTS_MODEL (CLAUDE.md 2026-06-02 model-rot learning)
  - TTS route uses regular createClient() not createAdminClient — session RLS is the org-scope gate
  - TTS instructions string reuses wording from src/lib/video-gen/tts.ts BASE_INSTRUCTIONS
  - intent-classifier spec converted from dynamic import() to source-contract assertions (dynamic import does not resolve @/ TS path aliases in Playwright's Node.js context for phase22-stubs project)
  - Behavioral unit tests for classifyIntent live in src/lib/voice/__tests__/intent-classifier.test.ts (phase15-unit project) where static @/ imports resolve
  - voiceTtsSchema uses text min(1)/max(500) matching the 500-char DoS cap in T-22-02-01
metrics:
  duration: "~8 minutes"
  completed: "2026-06-24"
  tasks_completed: 2
  files_changed: 9
---

# Phase 22 Plan 02: Voice Infrastructure — TTS + Intent Classifier + STT Keyterms Summary

**One-liner:** Auth-gated TTS streaming route + useTtsPlayback fail-silent hook + classifyIntent question-word-first gate + Deepgram keyterm URL injection via extractKeyterms, all wired through a shared TTS_MODEL constant.

## What Was Built

Seven new files + two extensions forming the complete voice primitive layer that Plan 22-03's modal wiring consumes.

### Task 1: Intent classifier + keyterm extraction + STT keyterms extension (commit `1269edb`)

**`src/lib/voice/intent-classifier.ts`**
- Pure TS module (no `'use client'`, no framework deps)
- `VoiceIntent = 'next' | 'done' | 'prev' | 'question'` union type
- `classifyIntent(transcript)` with gate ordering: QUESTION_WORDS → PREV → NEXT (length-gated < 60 chars) → default 'question'
- Question-word gate runs FIRST (Pitfall 4 fix): "what is next on the hanger" → 'question', not 'next'
- Length gate prevents long utterances containing "next" from triggering step advance

**`src/lib/voice/extract-keyterms.ts`**
- `extractKeyterms(sop: SopWithSections): string[]` — collects section titles + step required_tools, Set-deduped, capped at 100
- Never throws on empty/partial SOP

**`src/lib/voice/deepgram-stream.ts` (extended)**
- Added `keyterms?: string[]` to `VoiceStreamOpts` interface
- Added per-term `params.append('keyterm', kt)` loop before WebSocket open (capped at `slice(0, 100)`)
- No-op when `keyterms` is absent/empty — URL is byte-identical to pre-extension

**`src/lib/voice/__tests__/intent-classifier.test.ts`** (Rule 1 deviation — see below)
- 10 behavioral unit tests covering all 5 plan cases + edge cases (length gate, 'previous', 'last step', 'i have done this')

### Task 2: TTS route + shared model constant + validator + playback hook (commit `357044d`)

**`src/lib/voice/tts-constants.ts`**
- `TTS_MODEL = process.env.TTS_MODEL ?? 'gpt-4o-mini-tts'`
- Monitoring note: watch for Content-Length: 0 in TTS responses (0-byte audio = silent model-rot signature)

**`src/lib/validators/voice-tts.ts`**
- `voiceTtsSchema = z.object({ text: z.string().min(1).max(500) })` — mirrors voice-query.ts structure
- `VoiceTtsInput` type

**`src/app/api/voice/tts/route.ts`**
- `export const maxDuration = 30` (Railway timeout cap)
- Module-level `const inFlight = new Set<string>()` (per-user concurrency cap, 429 on second concurrent call)
- Lazy `getClient()` OpenAI init (prevents build failure without API key)
- Auth: `createClient()` (regular, NOT admin) + `supabase.auth.getUser()` → 401 if no session
- Body validation: `voiceTtsSchema.safeParse()` → 400 invalid_input
- TTS call: `getClient().audio.speech.create({ model: TTS_MODEL, voice: 'nova', input: text, instructions: TTS_INSTRUCTIONS, response_format: 'mp3' })`
- Response: `new NextResponse(arrayBuffer, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })`
- OpenAI errors → 502 `tts_failed` (only `.message` logged, T-22-02-04)
- `finally { inFlight.delete(user.id) }` releases cap

**`src/components/sop/voice/useTtsPlayback.ts`**
- `'use client'` hook returning `{ speak, stop, audioRef }`
- `speak(text)`: no-op on empty text; stops current audio first (Pitfall 1 sequencing); POST /api/voice/tts; `!res.ok` → silent return; object URL → `audio.play()` in try/catch (NotAllowedError swallowed for iOS)
- `stop()`: pause + reset currentTime; safe to call when idle
- Hook never throws to caller — fully fail-silent (TTS is additive per D-04/D-06)

## TTS Instruction String

```
"Speak clearly and at a measured pace suitable for an industrial safety procedure in New Zealand. Pronounce: PPE as P-P-E, kPa as kilopascals, SCBA as S-C-B-A, MSDS as M-S-D-S."
```

Reuses wording from `src/lib/video-gen/tts.ts` BASE_INSTRUCTIONS for consistency.

## Keyterm Cap Behavior

- `extractKeyterms()` collects section titles + step required_tools into a Set (deduplication), returns `Array.from(terms).slice(0, 100)`
- `startVoiceStream()` enforces `opts.keyterms.slice(0, 100)` again as a defence-in-depth guard
- Empty SOP → empty array (never throws)
- No keyterms → URL is byte-identical to pre-extension (no empty `keyterm=` params)

## Route Client Confirmation

`src/app/api/voice/tts/route.ts` uses `createClient()` from `@/lib/supabase/server` (regular RLS client). It does NOT import `createAdminClient` or service-role. Session authentication is the gate; org-scoping is implicit via session RLS. Workers are allowed (D-15) — no admin-role check.

## Spec Results

| Spec | Tests | Result |
|------|-------|--------|
| `tests/phase22/intent-classifier.spec.ts` | 5 | 5 PASS (source-contract) |
| `tests/phase22/stt-keyterms.spec.ts` | 3 | 3 PASS |
| `tests/phase22/tts-route.spec.ts` | 5 | 5 PASS |
| `src/lib/voice/__tests__/intent-classifier.test.ts` | 10 | 10 PASS (behavioral) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dynamic import() in intent-classifier.spec.ts fails with Playwright's Node.js runner**

- **Found during:** Task 1 GREEN phase verification
- **Issue:** The Wave-0 spec used `await import('@/lib/voice/intent-classifier')` to call the live function. When the module exists (post-plan), Node.js tries to natively import the `.ts` file — it sees `export` keyword and fails with `SyntaxError: Unexpected token 'export'` + `Warning: Failed to load the ES module` because the project has no `"type": "module"` in package.json. The dynamic import pattern bypasses Playwright's TypeScript compiler. At Wave-0 head, the tests SKIPPED before reaching the import, masking the issue.
- **Fix:** Replaced `tests/phase22/intent-classifier.spec.ts` dynamic imports with source-contract assertions (`fs.readFileSync` + `toContain`) covering: file exists, `classifyIntent` exported, `VoiceIntent` type present, QUESTION_WORDS gate before NEXT_PATTERNS in source order, `length < 60` present. Created `src/lib/voice/__tests__/intent-classifier.test.ts` (10 behavioral unit tests using static `@/` import) registered under `phase15-unit` project where TypeScript path aliases resolve correctly.
- **Files modified:** `tests/phase22/intent-classifier.spec.ts`, new `src/lib/voice/__tests__/intent-classifier.test.ts`
- **Commit:** `1269edb`

## Known Stubs

None — all seven artifacts are fully implemented with no placeholder data flows.

## Threat Surface Scan

No new network endpoints beyond `/api/voice/tts` which is explicitly in the plan's threat model.

| Flag | File | Description |
|------|------|-------------|
| Covered by T-22-02-01 | src/app/api/voice/tts/route.ts | New network endpoint — auth-gated + concurrency-capped + input-bounded per plan threat model |

All STRIDE threats (T-22-02-01 through T-22-02-SC) mitigated as specified.

## Self-Check: PASSED

Files verified:
- `src/lib/voice/intent-classifier.ts` — exists ✓
- `src/lib/voice/extract-keyterms.ts` — exists ✓
- `src/lib/voice/tts-constants.ts` — exists ✓
- `src/lib/validators/voice-tts.ts` — exists ✓
- `src/app/api/voice/tts/route.ts` — exists ✓
- `src/components/sop/voice/useTtsPlayback.ts` — exists ✓
- `src/lib/voice/__tests__/intent-classifier.test.ts` — exists ✓
- `src/lib/voice/deepgram-stream.ts` — contains `keyterms` and `params.append('keyterm'` ✓

Commits verified:
- `1269edb` — feat(22-02): intent classifier + keyterm extraction + STT keyterms extension ✓
- `357044d` — feat(22-02): TTS route + model constant + validator + playback hook ✓

`npx playwright test --project=phase22-stubs tests/phase22/intent-classifier.spec.ts tests/phase22/stt-keyterms.spec.ts tests/phase22/tts-route.spec.ts`: 13 passed ✓
`npx playwright test --project=phase15-unit src/lib/voice/__tests__/intent-classifier.test.ts`: 10 passed ✓
`npx tsc --noEmit`: CLEAN ✓
Route uses regular `createClient()` not `createAdminClient` ✓
TTS_MODEL constant from tts-constants.ts (not hardcoded in route body) ✓
