# Phase 22: Voice-Driven Walkthrough - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 22-voice-driven-walkthrough
**Areas discussed:** Voice progression model, Capture mode, Multi-language scope + mechanism, Visual-only completion path

---

## Voice progression model

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm + re-read safety, then advance | AI reads step incl. warnings → "done"/"next" → re-state hazard + require explicit spoken "yes" on safety-critical steps (reuses D-02 re-ack) | |
| Lightweight — "next" just advances | Spoken "next" advances + reads next step; no per-step spoken confirmation | ✓ |
| Comprehension check on hazards only | Plain advance for normal steps; spoken comprehension question on hazard/decision steps | |

**User's choice:** Lightweight — "next" just advances.
**Notes:** Simon overrode the stricter recommendation — keep it fast/simple. Captured the safety nuance in CONTEXT D-02: voice is additive, routes through the same walkthrough state machine + existing on-screen safety acknowledgement; it does not get a weaker gate than the tap UI.

---

## Capture mode (hands-free vs PTT)

| Option | Description | Selected |
|--------|-------------|----------|
| Large push-to-talk button | Glove-friendly tap-to-toggle/press-hold mic; most noise-robust; matches existing "Speak" button | ✓ (PTT + tap controls) |
| Always-listening wake word | "Hey SafeStart" hands-free; fragile in noise, burns STT minutes | |
| Hybrid — PTT default + optional hands-free | PTT default with per-session wake-word toggle | |

**User's choice:** "Push to talk and optional tap controls."
**Notes:** PTT primary + always-available tap fallback for every voice affordance (CONTEXT D-03/D-04). No wake word.

---

## Multi-language scope + mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| EN + best-supported migrant langs, pre-translated | English + Tagalog/Mandarin/Hindi, pre-translated stored content; Te Reo research-gated | |
| All 4 now, on-the-fly AI translation | Te Reo+Tagalog+Hindi+Mandarin translated live | |
| English-only voice this phase, defer languages | Ship full voice loop in English now; languages fast-follow | ✓ |

**User's choice:** English-only voice this phase, defer languages.
**Notes:** Scope reduction — VDW-LIT-04 and VDW-VOICE-04 deferred out of Phase 22 (CONTEXT D-08). ROADMAP.md Phase 22 + REQUIREMENTS.md to be annotated so coverage stays honest. Te Reo STT/TTS vendor weakness + translation-correctness risk for safety warnings noted as reasons.

---

## Visual-only completion path

| Option | Description | Selected |
|--------|-------------|----------|
| Always-on visual layer, mobile-first | Photo/icon per step always shown; voice read-aloud on top; icons auto-derived; mobile immersive first | ✓ |
| Separate "Accessible mode" toggle | Distinct icon/voice mode worker enables | |
| Require photo/icon per step | Hard authoring gate | |

**User's choice:** Always-on visual layer, mobile-first.
**Notes:** No separate mode; graceful degradation on authoring (no per-step photo gate — contradicts Visy "don't force video on every SOP"); mobile immersive walkthrough is first surface, desktop/kiosk follows (CONTEXT D-05/06/07).

## Claude's Discretion

- STT provider: default to wiring the already-scaffolded Deepgram for real (research confirms PWA/iOS-Safari mic constraints).
- TTS provider for read-aloud: OPEN — research to pick on latency/quality/offline (browser SpeechSynthesis vs OpenAI TTS / Deepgram Aura / Phase 8 stack). English-only simplifies.
- Reuse the existing WalkthroughVoiceModal + /api/voice/query shell rather than rebuilding; extend it to emit step-progression commands.
- Preserve next/dynamic bundle isolation (SB-LINE-06) and the useState + history.replaceState hot-path pattern for voice "next".

## Deferred Ideas

- Multi-language voice + UI (VDW-LIT-04 / VDW-VOICE-04) — fast-follow phase; decide pre-translated vs on-the-fly + Te Reo feasibility then.
- Desktop/kiosk voice walkthrough surface (Visy shared-terminal reading).
- Comprehension-gated progression on hazard/decision steps — revisit only if field use shows unsafe voice-skipping.
