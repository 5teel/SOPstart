/**
 * Phase 22 — VDW-VOICE-03: Intent classifier for voice-driven walkthrough.
 *
 * Pure TS module — no 'use client', no framework import.
 * Classifies a worker's spoken transcript into one of four navigation intents.
 *
 * Gate ordering (PATTERNS.md § intent-classifier.ts — Pitfall 4 fix):
 *   1. QUESTION_WORDS gate runs FIRST — so "what is next on the hanger" → 'question'
 *      even though it contains the word "next" (avoids unintended step advance).
 *   2. PREV_PATTERNS gate — explicit backward navigation.
 *   3. NEXT_PATTERNS gate — gated on `t.length < 60` to avoid long utterances
 *      with embedded "next" being misclassified (length gate per RESEARCH Pitfall 4).
 *   4. Default → 'question' (safe fallback — sends to Q&A rather than advancing).
 */

/** The four possible voice intents in the walkthrough. */
export type VoiceIntent = 'next' | 'done' | 'prev' | 'question'

const QUESTION_WORDS = /\b(what|how|why|where|when|can i|should i|is it|do i)\b/i
const NEXT_PATTERNS = /\b(next|done|complete|finished|move on|i('ve| have) done (this|it)|proceed)\b/i
const PREV_PATTERNS = /\b(back|previous|go back|last step)\b/i

/**
 * Classify a spoken transcript into a voice intent.
 *
 * @param transcript - Raw text from Deepgram STT (may be partial; trim is applied internally).
 * @returns VoiceIntent — 'next' (advance step), 'done' (same as next), 'prev' (go back), or 'question' (send to Q&A).
 *
 * Note: 'done' is never returned — the classifier maps all "done" utterances to 'next'
 * for uniform handling by the modal's intent dispatcher.
 */
export function classifyIntent(transcript: string): VoiceIntent {
  const t = transcript.trim().toLowerCase()

  // Gate 1: Question-word check FIRST — prevents "what is next on the hanger" triggering
  // step advance (RESEARCH Pitfall 4; PATTERNS.md lines 124-141).
  if (QUESTION_WORDS.test(t)) return 'question'

  // Gate 2: Backward navigation.
  if (PREV_PATTERNS.test(t)) return 'prev'

  // Gate 3: Forward navigation — length-gated to 60 chars.
  // Long utterances that happen to contain "next" are usually questions or
  // narration, not navigation commands (e.g. "I'm about to do the next thing on
  // the machine" should not advance the step).
  if (NEXT_PATTERNS.test(t) && t.length < 60) return 'next'

  // Default: treat as a question / Q&A fallback.
  return 'question'
}
