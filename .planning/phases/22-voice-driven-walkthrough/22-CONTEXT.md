# Phase 22: Voice-Driven Walkthrough - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the loop on **voice + visual literacy in the worker walkthrough** so a worker who can't read fluent English can still complete an SOP on the floor. Two bundled threads:

- **W-01 Literacy** — complete an SOP without fluent reading: an always-on visual layer (photos/icons per step) plus steps read aloud by AI voice.
- **X-02 Voice-driven mode** — voice input drives step progression ("done, next" advances the walkthrough), AI answers are read back aloud, robust in factory-floor noise.

This phase turns the Phase 15 voice **Q&A shell** (currently a stubbed mic + manual text box, Q&A-only) into a **real end-to-end voice loop** (live STT in, TTS read-back out) and extends it to **drive walkthrough step state**, not just answer questions.

**Multi-language is explicitly OUT of this phase** (deferred — see Deferred Ideas). Phase 22 ships the full voice loop in **English only**; languages are a fast-follow once the plumbing is proven.
</domain>

<decisions>
## Implementation Decisions

### Voice progression model
- **D-01:** Lightweight advancement — a spoken "next"/"done" simply advances to and reads the next step. **No** AI-driven per-step spoken comprehension gate or re-read-then-confirm ceremony. Keep it fast and simple (Simon's call, overriding the stricter recommendation; aligns with Visy "keep it simple — they're not the smartest tool").
- **D-02:** Voice is **additive, not a bypass.** The existing on-screen per-session safety re-acknowledgement (D-02 from the walkthrough store, Phase 3/12.5) still governs safety-critical steps. Voice "next" must NOT silently skip a step that the current UI requires an explicit acknowledgement for — the spoken command drives the same state machine the tap UI drives; it does not get a weaker gate. (Planner/researcher: confirm the walkthrough store's ack guard is the single source of truth and the voice command routes through it.)

### Capture mode (factory floor)
- **D-03:** **Push-to-talk is the primary input** — a large, glove-friendly mic button (tap-to-toggle or press-and-hold), with **optional tap controls** as the always-available fallback (tap "next", tap to answer). No always-listening wake word. This is the most robust path to the VDW-VOICE-01 ≥90% noise-accuracy target and matches the existing modal "Speak" button + glove-friendly tap-target convention.
- **D-04:** Every voice affordance has a visible tap equivalent — the worker is never stuck if the mic mis-hears or the environment is too loud.

### Visual-only completion (VDW-LIT-02)
- **D-05:** **Always-on visual layer**, not a separate mode the worker must find and enable. Every step card surfaces its photo/icon prominently; voice read-aloud sits on top as the accessibility layer. A low-literacy worker gets the visual + audio benefit by default.
- **D-06:** **Graceful degradation on authoring** — icons auto-derived from block type (Step/Hazard/PPE/Decision/etc. already have semantic types) + any existing step photo. Admins are **NOT** forced to add a photo per step (no hard publish gate — contradicts Visy "don't force video on every SOP"). A step with no photo falls back to its type icon.
- **D-07:** **Mobile immersive walkthrough is the first surface.** Desktop/kiosk voice mode follows (stretch / next phase) even though Visy reads at a desktop terminal — the voice-at-machine story is handheld, and the immersive mobile walkthrough already exists to build on.

### Scope
- **D-08:** **English-only voice this phase.** VDW-LIT-04 and VDW-VOICE-04 (multi-language input + output: Te Reo, Tagalog, Hindi, Mandarin) are deferred to a fast-follow. Rationale: prove the voice loop end-to-end first; multi-language adds translation-correctness risk (mistranslated safety warnings) and Te Reo STT/TTS vendor support is genuinely weak. **Phase 22 delivers VDW-LIT-01/02/03 and VDW-VOICE-01/02/03; VDW-LIT-04 and VDW-VOICE-04 are out of scope** — ROADMAP.md Phase 22 line and REQUIREMENTS.md should be annotated to reflect the deferral.

### Claude's Discretion
- **STT provider:** Deepgram is already scaffolded (`deepgram-stream.ts`, `media-recorder.ts`) and was the Phase 15 intended path — default to wiring it for real unless research surfaces a blocker. (Researcher: confirm streaming + noise model + PWA/iOS-Safari mic constraints.)
- **TTS provider for read-aloud:** OPEN — research to choose. Constraints: must work in the installed PWA, prefer low-latency streaming, English-only simplifies the choice. Candidates: browser `SpeechSynthesis` (free, offline, robotic), OpenAI TTS / Deepgram Aura / the Phase 8 video-gen TTS stack (better quality, cost + network). Pick on latency + quality + offline behaviour.
- **Reuse vs rebuild the Q&A shell:** wire real STT + TTS into the existing `WalkthroughVoiceModal` / `/api/voice/query` rather than rebuilding; extend the same voice surface to emit step-progression commands.
- **Bundle isolation:** keep the Phase 15 `next/dynamic` + lint-guard isolation so the mobile worker route bundle stays within budget (SB-LINE-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §"Walkthrough Literacy (W-01)" + §"Voice Q&A — Voice-Driven Mode (X-02)" — VDW-LIT-01..04, VDW-VOICE-01..04 (note D-08 deferral of -04 items).
- `.planning/ROADMAP.md` Phase 22 line — phase goal + bundle statement.

### Customer research (mandated reading per CLAUDE.md auto-load routing)
- `.planning/research/customer-interviews/2026-05-05-visy-findings.md` §4 (Voice Q&A request), §8 (literacy → voice/video is the answer), §7 (noisy/hot environment, desktop-primary), §9 (don't force video on every SOP) — primary-source justification for this phase.

### Existing voice infrastructure (Phase 15 — reuse, don't rebuild)
- `src/components/sop/voice/WalkthroughVoiceModal.tsx` — Q&A modal shell + state machine (idle/listening/transcribing/querying/answered/error); mic currently STUBBED ("for now we simulate"), no TTS, Q&A-only.
- `src/components/sop/voice/WalkthroughVoiceButton.tsx` — entry affordance.
- `src/lib/voice/deepgram-stream.ts`, `src/lib/voice/media-recorder.ts` — STT scaffolds (wiring deferred from Phase 15 to here).
- `src/lib/voice/voice-qa.ts`, `src/lib/voice/sop-pack.ts` — answer call + cache-keyed SOP payload (Anthropic, `cache_control:ephemeral`).
- `src/app/api/voice/query/` — answer route (RLS-respecting, sub-trade gated).
- `src/lib/validators/voice-query.ts` — request schema.

### Design system / interaction patterns (mandated for worker-facing UI)
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` + `references/interaction-patterns.md` — validated **voice state machine** + **mobile immersive walkthrough** patterns; paper/ink tokens.
- `.claude/skills/sketch-findings-SOPstart/references/screen-inventory.md` — voice + walkthrough screens.

### Walkthrough state & safety ack
- `src/stores/walkthrough.ts` (or equivalent) + walkthrough components — the step state machine voice must route through; per-session safety re-acknowledgement (D-02 invariant). (Researcher: confirm exact path.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **WalkthroughVoiceModal + /api/voice/query:** the Q&A loop is already built end-to-end except the mic and the read-back — wire Deepgram STT in front and TTS after, rather than starting fresh.
- **deepgram-stream.ts / media-recorder.ts:** STT scaffolds parked in Phase 15 specifically for this phase.
- **sop-pack.ts:** single source of truth for the cached SOP payload — reuse so the voice-driven answer + any verifier share byte-identical input above the cache breakpoint.
- **Immersive mobile walkthrough (3a713b3) + VoiceCaptureControl / voice state machine (f66840b):** the visual surface and the capture UX pattern already exist.

### Established Patterns
- **Bundle isolation:** desktop + voice code is code-split via `next/dynamic` with a lint guard (SB-LINE-06) — preserve.
- **URL-state hot paths:** walkthrough step changes use `useState` + `history.replaceState` (NOT `router.push`) to avoid RSC fetches under Serwist (CLAUDE.md learning 2026-05-13) — voice-driven "next" MUST follow the same pattern.
- **Fail-open verifier:** voice answers carry verifier flags but never block (Phase 15 D-18).

### Integration Points
- Voice "next" command → walkthrough step store (same path as the tap "next").
- TTS read-aloud → triggered on step entry + on answer arrival.
- Always-on visual layer → step card render in the immersive walkthrough.

</code_context>

<specifics>
## Specific Ideas

- "Press the mic, tell me how to change the blank side hanger" — the Visy mental model for voice Q&A; the answer should be read back aloud, not just shown.
- "Like getting dressed for school" — enforced sequence, no skipping; voice must respect existing sequence gates.
- Glove-friendly, noisy, hot glass-forming floor — big tap targets, push-to-talk, always a visible tap fallback.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-language voice + UI (VDW-LIT-04, VDW-VOICE-04):** Te Reo Māori, Tagalog, Hindi, Mandarin — input transcription + answer/step read-back + walkthrough UI rendering. Deferred to a fast-follow phase. When picked up: decide pre-translated stored content (deterministic, human-reviewable safety wording) vs on-the-fly AI translation, per-worker language preference, and gate Te Reo on vendor STT/TTS feasibility. **Action:** annotate ROADMAP.md Phase 22 + REQUIREMENTS.md so coverage stays honest.
- **Desktop/kiosk voice mode:** Visy reads at a shared desktop terminal — a kiosk-surface voice walkthrough is a natural follow-on once the mobile loop is proven (D-07).
- **Comprehension-gated progression:** AI asking a spoken comprehension question on hazard/decision steps (the stricter progression model rejected in D-01) — revisit only if field use shows workers voice-skipping unsafely.

</deferred>

---

*Phase: 22-voice-driven-walkthrough*
*Context gathered: 2026-06-23*
