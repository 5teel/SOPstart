/**
 * Phase 26.5 — shared, env-overridable model constants for the agent-metadata layer.
 *
 * Single source of truth for model IDs (CLAUDE.md 2026-06-02 model-rot learning:
 * hardcoded model IDs silently rot when the vendor retires the model — mirrors
 * the VERIFY_MODEL / TTS_MODEL precedent). Never hardcode these literal strings
 * anywhere else in the phase.
 */

// D-03: default is the current-generation 3.5 model — retrieval-specialised, SAME
// price/context (32k) as voyage-3; provider unchanged from the locked D-03 decision.
// Set VOYAGE_EMBED_MODEL=voyage-3 to pin the bare model.
export const EMBED_MODEL = process.env.VOYAGE_EMBED_MODEL ?? 'voyage-3.5'

// D-16: Claude Haiku 4.5 for synthesis (tags, entities, assessment reasoning).
// Env-overridable per CLAUDE.md 2026-06-02 model-rot learning.
export const SYNTHESIS_MODEL = process.env.SYNTHESIS_MODEL ?? 'claude-haiku-4-5-20251001'
