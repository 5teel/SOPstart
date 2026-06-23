# Phase 22: Voice-Driven Walkthrough — Research

**Researched:** 2026-06-23
**Domain:** Browser STT/TTS, voice-driven walkthrough state, visual literacy layer, PWA audio constraints
**Confidence:** HIGH (stack, patterns, codebase integration points), MEDIUM (TTS provider selection), LOW (iOS 17.4+ PWA mic quirks)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Lightweight voice advancement — spoken "next"/"done" advances to and reads the next step. No AI comprehension gate or re-read-then-confirm ceremony.
- **D-02:** Voice is additive, not a bypass. The existing per-session safety re-acknowledgement (`walkthroughStore.isAcknowledged(sopId)`) still governs safety-critical steps. Voice "next" routes through the same state machine the tap UI drives — it does not get a weaker gate.
- **D-03:** Push-to-talk is the primary input (large glove-friendly mic button). Optional tap fallback always visible. No always-listening wake word.
- **D-04:** Every voice affordance has a visible tap equivalent — worker is never stuck.
- **D-05:** Always-on visual layer — every step card surfaces photo/icon prominently. Voice read-aloud sits on top as the accessibility layer.
- **D-06:** Graceful degradation on authoring — icons auto-derived from block type. Admins are NOT forced to add a photo per step.
- **D-07:** Mobile immersive walkthrough is the first surface. Desktop/kiosk voice mode is stretch/next phase.
- **D-08:** English-only voice this phase. VDW-LIT-04 and VDW-VOICE-04 (multi-language) are deferred.

### Claude's Discretion

- STT provider: Default to wiring Deepgram nova-3 (already scaffolded). Researcher to confirm streaming + noise model + PWA/iOS-Safari constraints.
- TTS provider for read-aloud: OPEN — research to choose. Constraints: must work in installed PWA, prefer low-latency streaming, English-only.
- Reuse vs rebuild: wire real STT + TTS into existing `WalkthroughVoiceModal` / `/api/voice/query` rather than rebuilding.
- Bundle isolation: keep Phase 15 `next/dynamic` + lint-guard (SB-LINE-06).

### Deferred Ideas (OUT OF SCOPE)

- Multi-language voice + UI (VDW-LIT-04, VDW-VOICE-04): Te Reo Māori, Tagalog, Hindi, Mandarin.
- Desktop/kiosk voice mode.
- Comprehension-gated step progression.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VDW-LIT-01 | A worker with low literacy can complete an SOP without requiring fluent reading | Visual layer (D-05/D-06 icons + photos) + TTS step read-aloud |
| VDW-LIT-02 | A worker can complete an SOP entirely visually — diagrams, photos, icons, no required reading | Always-on icon-per-step fallback from block type metadata; SopStep.photo_required + SopImage |
| VDW-LIT-03 | A worker can complete an SOP entirely by voice — AI reads steps aloud, listens for "done," asks questions back | TTS read-aloud on step entry + STT push-to-talk + voice command dispatch into walkthrough store |
| VDW-VOICE-01 | Voice input transcribed reliably in industrial-floor noise — accuracy target ≥ 90% for common SOP vocabulary | Deepgram nova-3 + keyterm prompting (up to 100 SOP-domain terms) |
| VDW-VOICE-02 | AI answer is read back aloud — full audio loop, no required screen reading | TTS playback triggered in `WalkthroughVoiceModal` after `answerSopQuestion()` resolves |
| VDW-VOICE-03 | Voice Q&A drives step progression — "I've done step 4, what's next" advances walkthrough state | Intent classifier in modal dispatches to `handleMarkComplete(stepId)` + `handleStepChange(nextId)` via callback prop; state update uses existing `useState` + `history.replaceState` pattern |
</phase_requirements>

---

## Summary

Phase 22 turns the Phase 15 voice Q&A shell into a real end-to-end voice loop. The codebase audit reveals the architecture is already 80% scaffolded: `deepgram-stream.ts` has a complete WebSocket streaming client with push-to-talk lifecycle; `WalkthroughVoiceModal` has the correct state machine (idle/listening/transcribing/querying/answered/error) but with a stubbed mic and no TTS; `MobileWalkthrough` and `ImmersiveStepCard` expose the exact `handleMarkComplete` / `handleStepChange` callbacks voice needs to route through. The walkthrough store's `isAcknowledged` + `markStepAcknowledged` guards are the single source of truth for the D-02 safety invariant.

The two genuine open questions are TTS provider and iOS Safari audio routing. For TTS: `gpt-4o-mini-tts` is already in production use in `src/lib/video-gen/tts.ts` with NZ industrial pronunciation guidance — reusing it via a new server-side `/api/voice/tts` streaming route is the lowest-risk path. Browser `SpeechSynthesis` is unsuitable for production (voice quality varies per device, iOS 17 degraded quality, Chrome 15-second utterance cut-off, requires user gesture). Deepgram Aura-2 is a viable alternative offering sub-200ms TTFB with a single-vendor STT+TTS stack but introduces a second Deepgram billing surface. The recommendation is `gpt-4o-mini-tts` via a server streaming route: it reuses the existing OpenAI client, matches the existing TTS quality bar, and is English-only which simplifies voice/instructions parameters.

For the visual layer (VDW-LIT-02), `ImmersiveStepCard` already renders `current.warning`, `current.caution`, `current.required_tools`, and `current.photo_required`. The missing piece is (a) block-type icons for steps derived from `layout_data` content, and (b) surfacing `SopImage` records on non-`photo_required` steps. Both are additive renders inside the existing card — no schema changes needed.

**Primary recommendation:** Wire Deepgram nova-3 STT (scaffolded) + `gpt-4o-mini-tts` TTS (server streaming route, reusing existing OpenAI client). Extend `WalkthroughVoiceModal` to emit step progression commands via a callback prop. Add visual icon layer to `ImmersiveStepCard`. All changes are additive — no rebuilding of existing components.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| STT (mic → transcript) | Browser / Client | API (token grant) | MediaRecorder + Deepgram WebSocket live in the client; token minted server-side to keep API key off client |
| TTS (text → audio playback) | API / Backend | Browser / Client | Server-side `gpt-4o-mini-tts` streaming route avoids shipping OpenAI SDK to client; Audio element plays streamed response |
| Voice intent classification ("next" / "done" / question) | Browser / Client | — | Pure string match on transcript client-side; no LLM call needed for simple navigation commands |
| Voice Q&A answer (AI) | API / Backend | — | Existing `/api/voice/query` route — unchanged |
| Step progression dispatch | Browser / Client | — | Calls `handleMarkComplete` / `handleStepChange` via callback prop into `MobileWalkthrough` state |
| Safety acknowledgement gate (D-02) | Browser / Client | — | `walkthroughStore.isAcknowledged(sopId)` — single source of truth in Zustand; voice path reads same guard |
| Visual icon layer (block-type icons) | Browser / Client | — | Pure render in `ImmersiveStepCard` from `layout_data` / `section_type` metadata — no new API surface |
| Offline degradation | Browser / Client | — | TTS degrades gracefully (skip read-aloud); STT hard-requires network (Deepgram WebSocket); offline queue pattern from `voice-queue.ts` covers voice note capture |

---

## Standard Stack

### Core (all already in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deepgram SDK (via WebSocket) | nova-3 model | STT streaming | Already scaffolded in `deepgram-stream.ts`; nova-3 is Deepgram's 2025 flagship with noise-robust encoder + keyterm prompting |
| OpenAI SDK | already installed | TTS via `gpt-4o-mini-tts` | Already in `src/lib/video-gen/tts.ts` with NZ industrial pronunciation guidance; reuse pattern = zero new dep |
| Zustand (`useWalkthroughStore`) | already installed | Voice command → step state dispatch | `markStepAcknowledged` + `markStepComplete` are the correct write path; voice must use these, not bypass them |
| `next/dynamic` | Next.js 16 built-in | Bundle isolation for voice modal extensions | SB-LINE-06 contract — voice code never lands in mobile worker static bundle |
| Web Audio API / `<audio>` element | browser built-in | TTS playback | `fetch` streaming response piped to `<audio>` via `URL.createObjectURL(blob)` or MediaSource Extensions; no extra dep |

### New API Surface (server-side only)

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `POST /api/voice/tts` | Accept `{ text: string }`, call `gpt-4o-mini-tts`, stream MP3 response | Auth-gated (session required); text capped at ~500 chars (one step); lazy OpenAI init pattern from `tts.ts` |
| `GET /api/voice/token` | Existing — mint Deepgram ephemeral token | No change needed |
| `POST /api/voice/query` | Existing — answer Q&A | No change — extend response with `tts_text` field so client knows what to read back |

### No New npm Packages Required

The phase can be implemented entirely with the existing dependency set. [VERIFIED: codebase audit]

**Installation:** No new packages to install.

---

## Package Legitimacy Audit

No new npm packages are introduced in this phase. All capabilities use existing installed dependencies (OpenAI SDK, Deepgram WebSocket, Zustand, Next.js). This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
Worker device (iOS PWA / Android Chrome)
│
├── Push-to-talk button pressed
│     └── getUserMedia() → MediaRecorder → audio chunks
│           └── WebSocket → wss://api.deepgram.com/v1/listen
│                 ├── partial transcript → UI transcript display
│                 └── final transcript → Intent Classifier (client-side)
│                       ├── "next" / "done" / "complete"
│                       │     └── [D-02 guard: isAcknowledged?]
│                       │           ├── YES → handleMarkComplete(currentStepId)
│                       │           │         → handleStepChange(nextStepId)
│                       │           │         → TTS: read next step aloud
│                       │           └── NO → TTS: "Please acknowledge safety first"
│                       └── question (anything else)
│                             └── POST /api/voice/query
│                                   └── answerSopQuestion() → VoiceQueryResponse
│                                         └── POST /api/voice/tts  ← new
│                                               └── gpt-4o-mini-tts stream → <audio>.play()
│
└── Step entry (any method: tap or voice)
      └── TTS: read step text aloud → POST /api/voice/tts → <audio>.play()
```

### Recommended Project Structure (additive only — no moves)

```
src/
├── app/api/voice/
│   ├── token/route.ts          — existing (no change)
│   ├── query/route.ts          — existing (extend response with tts_text hint)
│   └── tts/route.ts            — NEW: text → gpt-4o-mini-tts streaming MP3
├── components/sop/voice/
│   ├── WalkthroughVoiceModal.tsx  — EXTEND: wire Deepgram STT + TTS playback + step progression
│   ├── WalkthroughVoiceButton.tsx — EXTEND: pass onStepCommand callback prop
│   └── useTtsPlayback.ts          — NEW: hook wrapping fetch→<audio> streaming
├── components/sop/walkthrough/
│   ├── ImmersiveStepCard.tsx   — EXTEND: visual icon layer (block-type icon + photo thumbnail)
│   └── MobileWalkthrough.tsx   — EXTEND: pass voiceStepCallback down to VoiceModal
└── lib/voice/
    ├── deepgram-stream.ts      — existing (no change needed)
    ├── media-recorder.ts       — existing (no change needed)
    ├── voice-qa.ts             — existing (no change needed)
    ├── sop-pack.ts             — existing (no change needed)
    └── intent-classifier.ts   — NEW: classify transcript → 'next' | 'done' | 'question' | 'prev'
```

### Pattern 1: Intent Classification (client-side, no LLM)

**What:** A pure string-match function that classifies a Deepgram final transcript into a voice command category. Runs synchronously on the client — no API call.

**When to use:** After every Deepgram `is_final: true` result during push-to-talk.

```typescript
// src/lib/voice/intent-classifier.ts
// Source: project convention (no external library needed for this vocabulary set)

type VoiceIntent = 'next' | 'done' | 'prev' | 'question'

const NEXT_PATTERNS = /\b(next|done|complete|finished|move on|i('ve| have) done (this|it)|proceed)\b/i
const PREV_PATTERNS = /\b(back|previous|go back|last step)\b/i

export function classifyIntent(transcript: string): VoiceIntent {
  const t = transcript.trim().toLowerCase()
  if (PREV_PATTERNS.test(t)) return 'prev'
  // Check next/done AFTER prev to avoid "done, go back" ambiguity
  if (NEXT_PATTERNS.test(t) && t.length < 60) return 'next'
  return 'question'
}
```

**Key design decision:** Keep the `next` pattern short-utterance-gated (`t.length < 60`). A worker saying "I've done step 4, now what do I do?" is asking a question, not issuing a navigation command. Short utterances (< 60 chars) that match the pattern are navigation; longer ones go to Q&A. [ASSUMED — threshold TBD during implementation; test with actual SOP vocabulary]

### Pattern 2: Voice "next" routing through the D-02 safety gate

**What:** Voice "next" must call the SAME path as the tap "I've done this — Next" button — `handleMarkComplete(stepId)` in `MobileWalkthrough` — which calls `walkthroughStore.markStepAcknowledged` + `markStepComplete`. Voice does NOT directly set `localStepId`.

**When to use:** Always. This is the D-02 invariant.

```typescript
// WalkthroughVoiceModal receives this as a prop:
interface VoiceProgressionCallbacks {
  onVoiceNext: () => void   // calls handleMarkComplete(currentStepId) in MobileWalkthrough
  onVoicePrev: () => void   // calls handleStepChange(prevStep.id)
  currentStepText: string   // so TTS can read it back on mode-switch
}

// In MobileWalkthrough, pass down:
<WalkthroughVoiceModal
  sopId={sop.id}
  onClose={() => setModalOpen(false)}
  onVoiceNext={() => currentStep && handleMarkComplete(currentStep.id)}
  onVoicePrev={() => prevStep && handleStepChange(prevStep.id)}
  currentStepText={currentStep?.text ?? ''}
/>
```

The safety acknowledgement gate (`!acknowledged` renders `<SafetyAcknowledgement>`) runs at the `MobileWalkthrough` render level. `handleMarkComplete` only fires if the user is past the gate — the gate is rendered as an overlay that blocks all interaction until acknowledged. Voice "next" before acknowledgement therefore has nothing to call (the walkthrough body is not rendered). [VERIFIED: codebase audit of `MobileWalkthrough.tsx` lines 317-325]

### Pattern 3: TTS server streaming route

**What:** `POST /api/voice/tts` accepts `{ text: string }`, calls `gpt-4o-mini-tts`, and streams the MP3 response body directly. Client fetches it, creates an object URL, plays via `<audio>`.

**When to use:** On step entry (read step text aloud) and after a voice Q&A answer arrives (read answer aloud).

```typescript
// src/app/api/voice/tts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

let openai: OpenAI | null = null
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { text } = await req.json()
  if (!text || text.length > 500) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const mp3 = await getOpenAI().audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'nova',
    input: text,
    instructions: 'Speak clearly at a measured pace for an industrial safety procedure in New Zealand.',
    response_format: 'mp3',
  })

  const arrayBuffer = await mp3.arrayBuffer()
  return new NextResponse(arrayBuffer, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  })
}
```

**Client-side hook pattern:**

```typescript
// src/components/sop/voice/useTtsPlayback.ts
export function useTtsPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speak = useCallback(async (text: string) => {
    if (!text) return
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return // fail silently — TTS is additive, not blocking
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.src = url
        void audioRef.current.play()
      }
    } catch { /* fail silently */ }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  return { speak, stop, audioRef }
}
```

### Pattern 4: Deepgram keyterm injection for SOP vocabulary

**What:** Pass SOP-specific terms (equipment names, hazard codes, PPE types extracted from the SOP) as `keyterm=` params to the Deepgram WebSocket URL. Up to 100 terms, up to 500 tokens total.

**When to use:** When initialising `startVoiceStream()` — derive keyterms from the packed SOP payload.

```typescript
// Extend VoiceStreamOpts in deepgram-stream.ts:
export interface VoiceStreamOpts {
  language: 'en-NZ' | 'en-AU' | 'en-US'
  numerals?: boolean
  keyterms?: string[]   // NEW — SOP vocabulary injection
}

// In startVoiceStream(), add to params:
if (opts.keyterms?.length) {
  for (const kt of opts.keyterms.slice(0, 100)) {
    params.append('keyterm', kt)
  }
}
```

Extract keyterms from `SopWithSections` by collecting: required_tools arrays across steps, section titles, warning/caution keywords, and known NZ industrial terms (PPE, kPa, SCBA, MSDS). [CITED: developers.deepgram.com/docs/keyterm]

### Pattern 5: Visual icon layer in ImmersiveStepCard

**What:** Below the step text, always render a visual icon derived from the step's block type or section type. If a `SopImage` exists for the step, render it as a thumbnail. Fall back to a Lucide icon mapped from `section_type`.

**Block-type-to-icon map:**

```typescript
// [ASSUMED — icons to confirm against project's Lucide set]
const SECTION_TYPE_ICONS: Record<string, LucideIcon> = {
  hazard: AlertTriangle,
  ppe: Shield,
  emergency: Siren,
  steps: ListChecks,
  signoff: ClipboardCheck,
}
```

**Data already available in `ImmersiveStepCard`:**
- `current.warning` / `current.caution` — flag hazard-level steps visually
- `current.required_tools` — render tool icon list
- `sop.sop_sections[n].section_type` — determines default icon
- `sop_images` (if joined) — step-level photos from SOP authoring

**Gap:** `SopWithSections` type as used in `ImmersiveStepCard` does not currently join `sop_images`. The `/sops/[sopId]/page.tsx` server component fetch needs to include `sop_images(*)` in the select. Check the existing query and add if missing. [ASSUMED — verify page.tsx select before planning]

### Anti-Patterns to Avoid

- **Calling `router.push()` for voice step navigation.** The CLAUDE.md 2026-05-13 learning is definitive: `router.push` on search-param changes triggers RSC payload fetch under Serwist, causing visible latency. Voice "next" MUST use `setLocalStepId(nextId)` + `window.history.replaceState(...)` — the same path `handleStepChange()` already uses in `MobileWalkthrough`.
- **Wiring voice directly to `walkthroughStore` without going through `handleMarkComplete`.** `handleMarkComplete` also starts the completion record (`completionStore.startCompletion`) and calls `completionStore.markStepCompleted`. Bypassing it would break the audit trail.
- **Autoplay TTS without user gesture context.** Both iOS Safari and Chrome require TTS audio to be triggered within (or shortly after) a user gesture. The push-to-talk button press IS a user gesture — start TTS within the same microtask chain. For step-entry auto-read, user must have tapped the voice button to enter voice mode; the subsequent step TTS reads are then within that activation context. Test on iOS.
- **Using browser `SpeechSynthesis` for production TTS.** iOS 17 degraded voice quality; Chrome cuts utterances after ~200 chars; voices are device-dependent; requires user gesture; `getVoices()` is asynchronous with a broken callback pattern. Use `gpt-4o-mini-tts` server route instead.
- **Wiring `WalkthroughVoiceModal` voice step-progression commands without a `modalOpen` guard.** The modal is lazily rendered — if `modalOpen === false`, the modal is unmounted and its callbacks are stale. Voice progression callbacks should live in `MobileWalkthrough` and be passed DOWN to the modal.
- **Importing TTS `<audio>` element or voice modal at module-level in the mobile worker route.** The Phase 15 lint guard (`tests/lint/no-static-desktop-import.spec.ts`) enforces that `WalkthroughVoiceModal` is only imported via `next/dynamic` in `WalkthroughSwitcher.tsx`. Any TTS hook used inside the modal is fine (it loads with the modal chunk). The lint guard must be extended if a new dynamically-imported component is added at switcher level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| STT streaming from browser | Custom WebSocket client | `deepgram-stream.ts` (already built) | Push-to-talk lifecycle, keepalive, format negotiation, error recovery already handled |
| Ephemeral Deepgram token | Pass API key to client | `/api/voice/token` route (existing) | API key must never leave server |
| TTS synthesis | `window.speechSynthesis` | `gpt-4o-mini-tts` via `/api/voice/tts` route | Voice quality, utterance length limits, iOS voice degradation |
| Audio format detection | Hard-code `audio/mp4` | `pickRecorderFormat()` in `media-recorder.ts` | iOS Safari supports `audio/mp4;aac`, not `audio/webm;opus` — the preference chain already handles this correctly |
| SOP context packing for voice Q&A | Re-serialise inline | `packSopForPrompt()` in `sop-pack.ts` | Cache key invariant — any change to serialization above the breakpoint costs 10x per question |
| Step text cleanup before TTS | Complex parser | Trim + strip markdown-style markers | SOP step text is plain text; warnings/caution labels can be prepended verbally ("Warning:" prefix) |
| Safety gate enforcement in voice | Custom ack check in voice handler | `walkthroughStore.isAcknowledged(sopId)` — already the gate | Single source of truth; bypassing it would create a voice-exploitable safety hole |

**Key insight:** 80% of the infrastructure already exists. Phase 22's real work is wiring connections between scaffolded pieces, not building new primitives.

---

## Common Pitfalls

### Pitfall 1: iOS Safari audio output rerouting on `getUserMedia()`

**What goes wrong:** When a microphone is activated via `getUserMedia()` on iOS Safari, the OS reroutes audio output from headphones/earpiece to the built-in speaker. TTS audio playing simultaneously will play loudly on the factory floor speaker.

**Why it happens:** iOS audio session management. `getUserMedia` activates the "voice chat" audio session category, which forces speaker output.

**How to avoid:** Two strategies: (a) sequence mic and TTS — stop the mic stream before playing TTS, restart after; (b) in push-to-talk mode, TTS naturally fires AFTER the user releases the button (mic stops), which avoids the overlap. Ensure `stop()` in `useDeepgramWebSocket` fully releases tracks before TTS begins.

**Warning signs:** TTS audio playing on speaker even when headphones are connected. [CITED: medium.com iOS Safari audio output article]

### Pitfall 2: Deepgram WebSocket token expiry during long walkthroughs

**What goes wrong:** The ephemeral Deepgram token from `/api/voice/token` expires (default `expires_in: 30` seconds per the existing route). A worker who presses the mic button 45 seconds after opening voice mode gets a WebSocket auth failure.

**Why it happens:** `startVoiceStream()` fetches the token at call time. If the modal stays open but idle, the token fetched on modal-open is stale by first mic press.

**How to avoid:** Fetch the token on each press of the mic button (inside `startListening()`), NOT on modal mount. `deepgram-stream.ts` already fetches the token inside `startVoiceStream()`, so as long as `startListening()` calls `startVoiceStream()` fresh each time, this is handled. Verify the existing modal's `startListening()` does not cache the handle across presses.

**Warning signs:** WebSocket connects but immediately closes with 401 on second mic press.

### Pitfall 3: CLAUDE.md model-ID rot for TTS

**What goes wrong:** `gpt-4o-mini-tts` is a named model that Anthropic/OpenAI can deprecate. Phase 8's `tts.ts` already hardcodes `gpt-4o-mini-tts`. If this becomes stale, TTS calls return 404 with no visible error to the worker (fail-open pattern).

**Why it happens:** Hardcoded model IDs across files diverge over time (per CLAUDE.md 2026-06-02 learning: voice-qa.ts VERIFY_MODEL rotted to a dead model, causing silent all-pass).

**How to avoid:** Define a single `TTS_MODEL` constant in `src/lib/voice/tts-constants.ts` (or use the existing one in `video-gen/tts.ts` via re-export). Both the video-gen TTS and the new voice TTS route should import from the same constant. Set `TTS_MODEL = process.env.TTS_MODEL ?? 'gpt-4o-mini-tts'` so it's overridable.

**Warning signs:** TTS route returns 200 but audio is silent / zero bytes. Monitor `content-length: 0` in the response.

### Pitfall 4: Voice "next" firing on Q&A transcripts

**What goes wrong:** A worker asks "What's next on the blank hanger?" — the word "next" is in the question. `classifyIntent()` incorrectly fires a step-advance command instead of routing to Q&A.

**Why it happens:** Naive keyword matching.

**How to avoid:** The `t.length < 60` guard in `classifyIntent()` (Pattern 1 above). Additionally, apply the `NEXT_PATTERNS` regex only if the transcript does NOT contain a question word (`what|how|why|where|when|can I|should I|is it`). Two-stage classification: if question-word present → always route to Q&A regardless of length. [ASSUMED — verify threshold against real SOP vocabulary during implementation]

**Warning signs:** Worker asks a question and the step advances without an answer.

### Pitfall 5: `<audio>` autoplay blocked by browser policy

**What goes wrong:** `audioRef.current.play()` in `useTtsPlayback` throws `NotAllowedError: play() failed because the user didn't interact with the document first`.

**Why it happens:** Browsers block programmatic audio autoplay unless triggered within a user gesture stack. The voice modal is opened by a tap (user gesture), but if TTS fires asynchronously (e.g., after a fetch completes), the browser may consider the gesture stack expired.

**How to avoid:** On first open of voice mode, play a 0-duration silent audio stub to "unlock" the audio context. This is the standard workaround. Alternatively, create the `<audio>` element and call `.play()` synchronously on the mic-button press before the async fetch starts. iOS Safari specifically requires a synchronous `.play()` within the gesture handler.

**Warning signs:** TTS works on desktop Chrome but silently fails on iOS Safari installed PWA.

### Pitfall 6: iOS `audio/mp4` is the only MediaRecorder format

**What goes wrong:** `pickRecorderFormat()` in `media-recorder.ts` tries `audio/webm;codecs=opus` first, then `audio/webm`, then `audio/ogg;codecs=opus`, then `audio/mp4`. On iOS, the first three return `false` from `isTypeSupported()`. The fallback to `audio/mp4` with `aac` encoding and `sample_rate: 44100` is correct, but Deepgram's `encoding: 'aac'` param must be used (not `opus`).

**Why it happens:** iOS Safari does not support WebM or Ogg containers.

**How to avoid:** The existing `PREFERENCE_CHAIN` in `media-recorder.ts` already handles this correctly. Do not modify the chain. Verify by running `MediaRecorder.isTypeSupported('audio/mp4')` returns `true` on an iOS 17+ device. The Deepgram params in `deepgram-stream.ts` already set `encoding: format.deepgramEncoding` which maps to `'aac'` for `audio/mp4`.

**Warning signs:** STT returns empty transcripts on iOS but works on Android.

---

## Code Examples

### Existing: `handleMarkComplete` in `MobileWalkthrough.tsx` (the gate to route through)

```typescript
// src/components/sop/walkthrough/MobileWalkthrough.tsx lines 177-198
const handleMarkComplete = useCallback(
  (stepId: string) => {
    walkthroughStore.markStepAcknowledged(sopId, stepId)   // D-02: ackTrace evidence
    walkthroughStore.markStepComplete(sopId, stepId)        // marks done
    const idx = allSteps.findIndex((s) => s.id === stepId)
    const next = allSteps.slice(idx + 1).find((s) => !completedSteps.has(s.id))
    if (next) void handleStepChange(next.id)               // URL + local state via replaceState
    // ... completion record persistence (fire-and-forget)
  }
)
```

Voice "next" MUST call `onVoiceNext` which calls this function. No shortcuts.

### Existing: `handleStepChange` pattern (URL-state hot path rule)

```typescript
// src/components/sop/walkthrough/MobileWalkthrough.tsx lines 145-161
const handleStepChange = useCallback((stepId: string) => {
  setLocalStepId(stepId)                      // instant React re-render
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    params.set('step', stepId)
    window.history.replaceState(               // NO router.push — avoids RSC fetch
      window.history.state, '',
      `${window.location.pathname}?${params.toString()}${window.location.hash}`
    )
  }
  void upsertWalkthroughProgress({ sopId: sop.id, stepId })  // fire-and-forget
}, [sop.id])
```

### Existing: Deepgram stream start with format negotiation

```typescript
// src/lib/voice/deepgram-stream.ts — already production-ready
// Key: token fetched per-call, WebSocket opened with Sec-WebSocket-Protocol auth,
// MediaRecorder format matched to Deepgram encoding, keepalive every 3s
const h = await startVoiceStream({ language: 'en-NZ', keyterms: extractedTerms })
h.onPartial((text) => setTranscript(text))
h.onFinal((text, confidence) => handleFinalTranscript(text, confidence))
h.onError((err) => setErrorMsg(err.message))
// ... stop() called on button release
```

### Existing: Lazy OpenAI init pattern (replicate in TTS route)

```typescript
// src/lib/video-gen/tts.ts lines 11-14 — use this exact pattern in /api/voice/tts
let openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser `webkitSpeechRecognition` (per sketch-findings skill) | Deepgram nova-3 WebSocket streaming | Phase 15 (2026-05) | Noise-robust encoder; keyterm prompting; consistent across browsers; works without Chrome permission |
| Deepgram nova-2 | Deepgram nova-3 | 2025 Deepgram release | 53% WER reduction; keyterm prompting for domain vocabulary; streaming latency improved |
| OpenAI `tts-1` / `tts-1-hd` | `gpt-4o-mini-tts` | 2025 OpenAI release | Controllable speech aspects via `instructions` param; already used in `video-gen/tts.ts` |
| Browser `SpeechSynthesis` | Avoided | — | Voice quality device-dependent; iOS 17 regression; 200-char Chrome cutoff; not suitable for production |

**Deprecated/outdated:**
- `webkitSpeechRecognition`: The sketch-findings skill (Phase 12.5 era) recommended this. It was superseded by Deepgram in Phase 15 research. Do not use — it requires Chrome/Edge, has no noise model, and is not available on Firefox.
- Deepgram `nova-2`: The scaffolded `deepgram-stream.ts` already uses `nova-3` — confirmed correct.
- `tts-1` / `tts-1-hd`: Superseded by `gpt-4o-mini-tts` for controllable TTS. The video-gen pipeline already uses the newer model.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Intent classifier `t.length < 60` threshold correctly separates navigation commands from questions containing "next"/"done" | Pattern 1 (Intent Classification) | False positives: workers' Q&A questions advance steps; false negatives: valid "next" commands treated as questions |
| A2 | `gpt-4o-mini-tts` is not deprecated and accepts the `instructions` field as currently documented | TTS route, Standard Stack | TTS route 404s silently; workers get no audio read-back |
| A3 | `/sops/[sopId]/page.tsx` server component fetch does NOT currently join `sop_images` — needs adding | Visual layer pattern, Gap note | If images are already joined, the gap task is a no-op (safe to verify before planning) |
| A4 | iOS autoplay unlock via silent-audio stub resolves `NotAllowedError` in installed PWA mode | Pitfall 5 | TTS never plays on iOS; VDW-LIT-03 / VDW-VOICE-02 fail in the primary target environment |
| A5 | `Deepgram /v1/auth/grant` ephemeral token TTL is 30 seconds (per existing route `expires_in ?? 30`) | Pitfall 2 | Token expires mid-session; second mic press fails with 401 WebSocket close |

---

## Open Questions

1. **Does the `/sops/[sopId]/page.tsx` query join `sop_images`?**
   - What we know: `ImmersiveStepCard` receives a `SopWithSections` prop; `SopWithSections` type in `src/types/sop.ts` may or may not include `sop_images`.
   - What's unclear: Whether image data is available at the step card level without a new query.
   - Recommendation: Planner adds a Wave 0 task to audit the page query and extend it if needed. No schema change required — `sop_images` table exists (Phase 2/3).

2. **Does the existing safety acknowledgement gate block the entire walkthrough body, or just the "Next" button?**
   - What we know: `MobileWalkthrough` renders `<SafetyAcknowledgement>` when `!acknowledged`, and the sticky action bar (which contains the "I've done this — Next" button) only renders when `acknowledged` is true (line 432).
   - What's unclear: Whether the voice modal can be opened before acknowledgement (the `WalkthroughVoiceButton` renders unconditionally in `WalkthroughSwitcher`).
   - Recommendation: Voice modal should check `isAcknowledged(sopId)` on "next" command and TTS "please acknowledge safety hazards first" if not yet acknowledged. The voice Q&A flow (asking questions) should remain available before acknowledgement.

3. **What is the correct Deepgram ephemeral token TTL in the current API?**
   - What we know: The existing `/api/voice/token` route returns `expires_in: json.expires_in ?? 30` — the `?? 30` suggests the actual Deepgram response may not always include this field.
   - What's unclear: Whether the real TTL is 30 seconds or longer. Deepgram docs describe ephemeral tokens but TTL may have changed.
   - Recommendation: Planner adds a task to verify TTL with a real API call. If > 30 seconds, the pitfall is lower risk.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `DEEPGRAM_API_KEY` env var | STT streaming, token grant | Assumed (Phase 15 shipped) | — | Phase degrades: mic button disabled with "Voice unavailable" |
| `OPENAI_API_KEY` env var | TTS `/api/voice/tts` | Yes (Phase 2+ in production) | — | TTS route returns 503; steps not read aloud but tap fallback works |
| Deepgram nova-3 model | STT | Available (live API) | nova-3 | Fall back to nova-2 in `deepgram-stream.ts` |
| `gpt-4o-mini-tts` model | TTS | Available (already in video-gen TTS) | gpt-4o-mini-tts | Fall back to `tts-1` |
| iOS Safari 14.5+ / MediaRecorder | STT on iOS | Available (iOS 14.5+) | — | Microphone button hidden via `isVoiceCaptureSupported()` check (already implemented in `VoiceCaptureControl`) |
| `getUserMedia` in installed PWA | STT on iOS home screen | Available (iOS 14.3+) | — | `isVoiceCaptureSupported()` returns false → mic hidden |

**Missing dependencies with no fallback:** None. All dependencies are either already in production or have graceful degradation paths.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase22-stubs` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VDW-LIT-01 | Low-literacy worker path: ImmersiveStepCard renders icon when no SopImage attached | unit/source-contract | `npx playwright test --project=phase22-stubs tests/phase22/visual-layer.spec.ts` | No — Wave 0 |
| VDW-LIT-02 | Step card always shows icon OR photo (never blank visual area) for each section type | source-contract | Same file | No — Wave 0 |
| VDW-LIT-03 | TTS route exists and is auth-gated | source-contract | `npx playwright test --project=phase22-stubs tests/phase22/tts-route.spec.ts` | No — Wave 0 |
| VDW-VOICE-01 | `deepgram-stream.ts` passes keyterms param to WebSocket URL | source-contract | `npx playwright test --project=phase22-stubs tests/phase22/stt-keyterms.spec.ts` | No — Wave 0 |
| VDW-VOICE-02 | `WalkthroughVoiceModal` calls `speak()` after `answerSopQuestion` resolves | source-contract | `npx playwright test --project=phase22-stubs tests/phase22/voice-modal.spec.ts` | No — Wave 0 |
| VDW-VOICE-03 | `classifyIntent('done')` returns `'next'`; `classifyIntent('what is next on the hanger')` returns `'question'` | unit | `npx playwright test --project=phase22-stubs tests/phase22/intent-classifier.spec.ts` | No — Wave 0 |
| VDW-VOICE-03 | `onVoiceNext` prop wired in `WalkthroughSwitcher` passes through to modal | source-contract | Same as VDW-VOICE-02 file | No — Wave 0 |
| D-02 | Voice "next" does NOT bypass `markStepAcknowledged` + `markStepComplete` path | source-contract | `tests/phase22/voice-safety-gate.spec.ts` | No — Wave 0 |
| SB-LINE-06 | `/api/voice/tts` route does not appear in mobile worker bundle | bundle-check | `npx tsx scripts/check-bundle-size.ts` | Yes (existing script) |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase22-stubs`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/phase22/visual-layer.spec.ts` — covers VDW-LIT-01, VDW-LIT-02
- [ ] `tests/phase22/tts-route.spec.ts` — covers VDW-LIT-03 (route existence + auth guard)
- [ ] `tests/phase22/stt-keyterms.spec.ts` — covers VDW-VOICE-01 (keyterms param appears in stream URL)
- [ ] `tests/phase22/voice-modal.spec.ts` — covers VDW-VOICE-02, VDW-VOICE-03 (TTS hook called, onVoiceNext wired)
- [ ] `tests/phase22/intent-classifier.spec.ts` — covers VDW-VOICE-03 (unit test of pure classifier function)
- [ ] `tests/phase22/voice-safety-gate.spec.ts` — covers D-02 invariant (source-contract: voice next prop routes through handleMarkComplete)
- [ ] `playwright.config.ts` — add `phase22-stubs` project with testMatch regex covering `tests/phase22/*.spec.ts` (per CLAUDE.md learning 2026-05-25: unregistered specs never run)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | All three new API routes (`/api/voice/tts`, existing `/api/voice/token`, `/api/voice/query`) gate on `supabase.auth.getUser()` before any AI call |
| V3 Session Management | no | Session handled by existing Supabase middleware |
| V4 Access Control | yes | TTS route: any authenticated worker can call it (D-15 principle — workers must be allowed); no admin-role check needed. Q&A route: existing RLS enforces single-org + sub-trade gate |
| V5 Input Validation | yes | TTS input: `text.length <= 500` server-side; no HTML/script injection risk (OpenAI TTS does not interpret HTML); validate with zod schema matching `voiceQuerySchema` pattern |
| V6 Cryptography | no | No new crypto surfaces |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| TTS prompt injection via SOP step text | Tampering | Step text is SOP-admin-authored content (not worker input); already passes through AI review gate (Phase 21). TTS `instructions` param is static. No worker-controlled input reaches the model prompt |
| DoS via TTS route (50 workers × 500-char requests) | DoS | Text length cap (500 chars); session auth required; per-user concurrency cap (mirror the existing `inFlight` Set pattern from `/api/voice/query`) |
| Deepgram token leakage | Information Disclosure | Token minted server-side via `/api/voice/token`, never logged. Already implemented in Phase 15 |
| Audio replay of safety acknowledgement bypass | Elevation of Privilege | TTS plays step text read-aloud; it does not trigger `acknowledgeSafety()`. Acknowledgement still requires explicit tap on the SafetyAcknowledgement component. No voice path bypasses this |

---

## Sources

### Primary (HIGH confidence)

- Codebase audit: `src/components/sop/walkthrough/MobileWalkthrough.tsx` — step state machine, `handleMarkComplete`, D-02 guard pattern
- Codebase audit: `src/components/sop/voice/WalkthroughVoiceModal.tsx` — existing state machine, stub comment locations
- Codebase audit: `src/lib/voice/deepgram-stream.ts` — complete Deepgram WebSocket client, format negotiation, keepalive
- Codebase audit: `src/stores/walkthrough.ts` — safety acknowledgement single source of truth
- Codebase audit: `src/lib/video-gen/tts.ts` — `gpt-4o-mini-tts` pattern with NZ industrial instructions
- Codebase audit: `src/components/sop/VoiceCaptureControl.tsx` — push-to-talk state machine reference implementation
- [CITED: developers.deepgram.com/docs/keyterm] — keyterm prompting: up to 100 terms / 500 tokens, available on nova-3 streaming
- [CITED: developers.openai.com/api/docs/guides/text-to-speech] — `gpt-4o-mini-tts` streaming support, `instructions` param

### Secondary (MEDIUM confidence)

- [CITED: deepgram.com/learn/introducing-nova-3-speech-to-text-api] — nova-3 noise-robust encoder, 53% WER reduction
- [CITED: deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech] — Aura-2 sub-200ms TTFB, WebSocket streaming
- [CITED: webkit.org/blog/11353/mediarecorder-api/] — iOS Safari MediaRecorder support from iOS 14.5
- [CITED: .planning/research/customer-interviews/2026-05-05-visy-findings.md] §7, §8 — noisy factory floor, literacy → voice/video

### Tertiary (LOW confidence)

- [ASSUMED: medium.com iOS Safari audio output rerouting] — audio output rerouting when getUserMedia active; single source, needs device testing
- [ASSUMED: magicbell.com PWA iOS Limitations 2026] — iOS PWA audio autoplay constraints; supplement with real device test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies are in production; no new packages; patterns verified in codebase
- Architecture: HIGH — all integration points confirmed in source files; step progression path traced end-to-end
- TTS provider selection: MEDIUM — `gpt-4o-mini-tts` is production-proven in video-gen but has not been tested in the streaming-per-step-read pattern; Aura-2 is an alternative not yet explored
- iOS audio constraints: LOW — MediaRecorder format chain is verified in code; autoplay unlock and audio routing rerouting need real device test

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (Deepgram and OpenAI model IDs change on their own schedule — verify before execution if > 30 days)
