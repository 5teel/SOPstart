/**
 * Selector metadata for the AI model registry — the vetted candidate models
 * per use case, consumed by <AiModelSelect> (src/components/ai/AiModelSelect.tsx).
 *
 * Kept separate from ./registry.ts on purpose: the registry is imported by
 * client bundles on the worker walkthrough hot path (bundle-size gated), so
 * this metadata only loads on screens that actually render a model picker.
 *
 * To add a selectable model to a use case, append it to the list below.
 */
import { AI_MODELS, aiModel, type AiModelKey } from './registry'

export interface AiModelOption {
  /** Provider model ID. */
  id: string
  /** Human label shown by AiModelSelect. */
  label: string
  /** Short tier/trade-off hint, shown alongside the label. */
  note?: string
  /** Provider, when it differs from the use case's default provider. */
  provider?: string
}

// Cross-provider LLM candidates — the llm adapter (./llm.ts) routes by model
// ID shape, so any option here works wherever llmToolCall/llmText is the call
// path (the parse pipeline + voice-draft). GLM 5.2 was validated for SOP work
// by the .autoresearch R&D loop (2026-07-06).
const CROSS_PROVIDER_LLM_OPTIONS: readonly AiModelOption[] = [
  { id: 'z-ai/glm-5.2', label: 'GLM 5.2', note: 'via OpenRouter · very cheap', provider: 'openrouter' },
  { id: 'gpt-4o-2024-08-06', label: 'GPT-4o', note: 'OpenAI', provider: 'openai' },
]

const ANTHROPIC_LLM_OPTIONS: readonly AiModelOption[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', note: 'fast · cheapest' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', note: 'balanced' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', note: 'most capable Sonnet' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', note: 'highest quality · $$$' },
]

const OPENAI_TTS_OPTIONS: readonly AiModelOption[] = [
  { id: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS', note: 'fast · cheap' },
  { id: 'tts-1', label: 'TTS-1', note: 'low latency' },
  { id: 'tts-1-hd', label: 'TTS-1 HD', note: 'highest audio quality' },
]

const DEEPGRAM_STT_OPTIONS: readonly AiModelOption[] = [
  { id: 'nova-2', label: 'Deepgram Nova 2', note: 'proven · cheaper' },
  { id: 'nova-3', label: 'Deepgram Nova 3', note: 'best accuracy · keyterms' },
]

export const AI_MODEL_OPTIONS: Record<AiModelKey, readonly AiModelOption[]> = {
  'parse-triage': [...ANTHROPIC_LLM_OPTIONS, ...CROSS_PROVIDER_LLM_OPTIONS],
  'parse-simple': [...ANTHROPIC_LLM_OPTIONS, ...CROSS_PROVIDER_LLM_OPTIONS],
  'parse-complex': [...ANTHROPIC_LLM_OPTIONS, ...CROSS_PROVIDER_LLM_OPTIONS],
  'draft-verify': ANTHROPIC_LLM_OPTIONS,
  'voice-qa': ANTHROPIC_LLM_OPTIONS,
  'sop-ask': ANTHROPIC_LLM_OPTIONS,
  synthesis: ANTHROPIC_LLM_OPTIONS,
  'voice-draft': ANTHROPIC_LLM_OPTIONS,
  'vision-image-describe': [
    { id: 'gpt-4o-2024-08-06', label: 'GPT-4o', note: 'current default' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'cheaper · lower detail' },
  ],
  embed: [
    { id: 'voyage-3.5', label: 'Voyage 3.5', note: 'retrieval-specialised' },
    { id: 'voyage-3', label: 'Voyage 3', note: 'previous generation' },
  ],
  'stt-batch': DEEPGRAM_STT_OPTIONS,
  'stt-stream': DEEPGRAM_STT_OPTIONS,
  'tts-voice': OPENAI_TTS_OPTIONS,
  'tts-video': OPENAI_TTS_OPTIONS,
  'ocr-fallback': [{ id: 'eng', label: 'Tesseract (English)', note: 'runs locally · free' }],
}

/** Human-readable default labels per use case (AiModelSelect label prop fallback). */
export const AI_MODEL_LABELS: Record<AiModelKey, string> = {
  'parse-triage': 'Parse triage model',
  'parse-simple': 'Parse model (simple docs)',
  'parse-complex': 'Parse model (complex docs)',
  'draft-verify': 'Draft verification model',
  'voice-qa': 'Voice Q&A model',
  'sop-ask': 'SOP ask model',
  synthesis: 'Synthesis model',
  'voice-draft': 'Voice draft interviewer model',
  'vision-image-describe': 'Image description model',
  embed: 'Embedding model',
  'stt-batch': 'Transcription model',
  'stt-stream': 'Live speech model',
  'tts-voice': 'Narration voice model',
  'tts-video': 'Video narration model',
  'ocr-fallback': 'OCR engine',
}

/**
 * Selectable candidates for a use case. Always includes the currently-resolved
 * model, even if an env override points at an ID not in the vetted list.
 */
export function aiModelOptions(key: AiModelKey): AiModelOption[] {
  const current = aiModel(key)
  const opts = [...AI_MODEL_OPTIONS[key]]
  if (!opts.some((o) => o.id === current)) {
    opts.unshift({ id: current, label: current, note: 'current' })
  }
  return opts
}

export { AI_MODELS, aiModel }
export type { AiModelKey }
