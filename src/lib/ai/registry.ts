/**
 * AI Model Registry — single source of truth for every AI model the app uses.
 *
 * Standalone feature: import `aiModel('<key>')` anywhere a model ID is needed.
 * Covers all capability types (llm, stt, tts, embedding, vision, ocr — plus
 * diffusion/video slots for future use). Every entry is env-overridable, so
 * swapping a model is a Railway env-var change, no code edit (CLAUDE.md
 * 2026-06-02 model-rot learning).
 *
 * This module is deliberately LEAN — it is imported by client bundles
 * (deepgram-stream, voice-queue), and the /sops/[sopId] page has a bundle-size
 * gate. Selector metadata (candidate model lists, labels) lives in
 * ./model-options.ts and is pulled in only by screens that render
 * <AiModelSelect> (src/components/ai/AiModelSelect.tsx).
 *
 * ## Adding a new model to an existing provider
 * Add an entry to AI_MODELS below (and its candidates in ./model-options.ts).
 * Done — `aiModel('your-key')` and every AiModelSelect pick it up.
 *
 * ## Adding a new provider (e.g. OpenRouter/GLM, Replicate, ElevenLabs)
 * 1. Add the provider name to `AiProvider` and its API key env var to
 *    `PROVIDER_ENV_KEYS`.
 * 2. Add a lazy client factory in the calling module (pattern: see
 *    `getAnthropic()` in sop-parser.ts / `getVoyageClient()` in voyage-client.ts
 *    — lazy-init so module load never throws during Next.js static analysis).
 * 3. Register the models here.
 * Current non-app precedent: the `.autoresearch/` R&D lab calls GLM 5.2 via
 * OpenRouter (`z-ai/glm-5.2`, OPENROUTER_API_KEY) — the provider slot exists
 * below so promoting it into the app is step 3 only.
 *
 * ## Notes
 * - `envVar` overrides only apply server-side. In client bundles process.env
 *   is shimmed, so `aiModel()` returns the default — fine for the client
 *   callers (deepgram-stream, voice-queue), which treat the ID as a constant.
 * - Anthropic model IDs: prefer dateless aliases (`claude-haiku-4-5`) for new
 *   entries; existing dated pins are kept to avoid behavior drift.
 */

export type AiCapability =
  | 'llm'
  | 'stt'
  | 'tts'
  | 'embedding'
  | 'vision'
  | 'ocr'
  | 'diffusion'
  | 'video'

export type AiProvider =
  | 'anthropic'
  | 'openai'
  | 'deepgram'
  | 'voyage'
  | 'openrouter'
  | 'local'

/** Which env var must be set for each provider's API access. */
export const PROVIDER_ENV_KEYS: Record<AiProvider, string | null> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
  voyage: 'VOYAGE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  local: null, // runs in-process (tesseract.js), no key
}

export interface AiModelDef {
  capability: AiCapability
  provider: AiProvider
  /** Provider model ID used when the env override is not set. */
  defaultId: string
  /** Env var that overrides defaultId (server-side only). */
  envVar?: string
  /** What this model does in the app + the module that calls it. */
  description: string
}

export const AI_MODELS = {
  // ---- LLM (Anthropic) ------------------------------------------------
  'parse-triage': {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-haiku-4-5-20251001',
    envVar: 'PARSE_TRIAGE_MODEL',
    description: 'SOP parse complexity triage (parsers/sop-parser.ts)',
  },
  'parse-simple': {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-haiku-4-5-20251001',
    envVar: 'PARSE_SIMPLE_MODEL',
    description: 'Full SOP parse for simple documents (parsers/sop-parser.ts)',
  },
  'parse-complex': {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-sonnet-4-6',
    envVar: 'PARSE_COMPLEX_MODEL',
    description: 'Full SOP parse for complex documents (parsers/sop-parser.ts)',
  },
  'draft-verify': {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-haiku-4-5-20251001',
    envVar: 'ANTHROPIC_VERIFY_MODEL',
    description: 'Draft SOP verification + AI reviewer jobs (parsers/verify-sop.ts, ai-reviewer/orchestrator.ts)',
  },
  'voice-qa': {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-haiku-4-5-20251001',
    envVar: 'VOICE_QA_MODEL',
    description:
      'Worker voice Q&A answer AND verifier calls (voice/voice-qa.ts, parsers/verify-sop.ts). ' +
      'One key on purpose: D-08 requires both calls on the same model ID so the verifier reuses the answer call’s prompt-cache write.',
  },
  'sop-ask': {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-haiku-4-5-20251001',
    envVar: 'SOP_ASK_MODEL',
    description: 'SOP question-answering endpoint (api/sops/[sopId]/ask)',
  },
  synthesis: {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-haiku-4-5-20251001',
    envVar: 'SYNTHESIS_MODEL',
    description: 'Agent-metadata synthesis: tags, entities, assessment (agent-layer/synthesis.ts)',
  },
  'voice-draft': {
    capability: 'llm',
    provider: 'anthropic',
    defaultId: 'claude-haiku-4-5-20251001',
    envVar: 'VOICE_DRAFT_MODEL',
    description: 'Conversational voice SOP-drafting interviewer (api/sops/voice-draft)',
  },

  // ---- Vision (OpenAI) -------------------------------------------------
  'vision-image-describe': {
    capability: 'vision',
    provider: 'openai',
    defaultId: 'gpt-4o-2024-08-06',
    envVar: 'VISION_DESCRIBE_MODEL',
    description: 'Describe extracted document images for step matching (parsers/extract-image.ts)',
  },

  // ---- Embeddings (Voyage) ---------------------------------------------
  embed: {
    capability: 'embedding',
    provider: 'voyage',
    defaultId: 'voyage-3.5',
    envVar: 'VOYAGE_EMBED_MODEL',
    description: 'SOP similarity embeddings (agent-layer/voyage-client.ts, synthesis.ts)',
  },

  // ---- STT (Deepgram) ----------------------------------------------------
  'stt-batch': {
    capability: 'stt',
    provider: 'deepgram',
    defaultId: 'nova-2',
    envVar: 'STT_BATCH_MODEL',
    description: 'Batch video/audio transcription (parsers/transcribe-audio.ts)',
  },
  'stt-stream': {
    capability: 'stt',
    provider: 'deepgram',
    defaultId: 'nova-3',
    envVar: 'STT_STREAM_MODEL',
    description: 'Live voice walkthrough streaming STT — client-side WS, env override has no effect in browser (voice/deepgram-stream.ts, offline/voice-queue.ts)',
  },

  // ---- TTS (OpenAI) ------------------------------------------------------
  'tts-voice': {
    capability: 'tts',
    provider: 'openai',
    defaultId: 'gpt-4o-mini-tts',
    envVar: 'TTS_MODEL',
    description: 'Walkthrough voice narration (api/voice/tts, voice/tts-constants.ts)',
  },
  'tts-video': {
    capability: 'tts',
    provider: 'openai',
    defaultId: 'gpt-4o-mini-tts',
    envVar: 'VIDEO_TTS_MODEL',
    description: 'Generated training-video narration (video-gen/tts.ts)',
  },

  // ---- OCR (local) -------------------------------------------------------
  'ocr-fallback': {
    capability: 'ocr',
    provider: 'local',
    defaultId: 'eng', // tesseract.js language pack
    envVar: 'OCR_LANGUAGE',
    description: 'Tesseract OCR for scanned/photographed documents (parsers/ocr-fallback.ts)',
  },

  // ---- Diffusion / video generation ---------------------------------------
  // No image-diffusion or AI-video models in the app yet. Register them here
  // when added (capability: 'diffusion' | 'video') — see header for provider steps.
} as const satisfies Record<string, AiModelDef>

export type AiModelKey = keyof typeof AI_MODELS

/** Resolve a registry key to its model ID (env override wins, server-side). */
export function aiModel(key: AiModelKey): string {
  const def = AI_MODELS[key] as AiModelDef
  return (def.envVar && process.env[def.envVar]) || def.defaultId
}

/** All registry entries of one capability (e.g. list every LLM in use). */
export function aiModelsByCapability(capability: AiCapability): Array<{ key: AiModelKey; def: AiModelDef }> {
  return (Object.keys(AI_MODELS) as AiModelKey[])
    .filter((k) => (AI_MODELS[k] as AiModelDef).capability === capability)
    .map((k) => ({ key: k, def: AI_MODELS[k] as AiModelDef }))
}
