/**
 * Phase 22 — shared TTS model constant.
 *
 * Single overridable source of truth for the OpenAI TTS model ID.
 * Importing from this module prevents the silent model-ID rot pattern documented in
 * CLAUDE.md Learnings 2026-06-02: "Hardcoded Anthropic model IDs silently rot when
 * Anthropic retires the model" — same pattern applies to OpenAI TTS models.
 *
 * Usage:
 *   import { TTS_MODEL } from '@/lib/voice/tts-constants'
 *
 * Override for testing or model migration:
 *   TTS_MODEL=gpt-4o-tts npm run dev
 *
 * Monitoring: watch for Content-Length: 0 in /api/voice/tts responses — zero-byte
 * audio is the silent rot signature (200 OK, 0 bytes of MP3 = model retired).
 */
import { aiModel } from '@/lib/ai/registry'

export const TTS_MODEL = aiModel('tts-voice')
