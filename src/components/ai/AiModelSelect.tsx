'use client'

/**
 * AiModelSelect — drop-in AI model picker, scoped by use case.
 *
 * The `useCase` prop is a key from the AI model registry
 * (src/lib/ai/registry.ts); the dropdown shows ONLY that use case's vetted
 * candidates (src/lib/ai/model-options.ts), so a picker on the upload screen
 * offers parse models and a picker in voice settings offers TTS models —
 * same component, different key.
 *
 * Controlled or uncontrolled:
 *   <AiModelSelect useCase="parse-complex" value={model} onChange={setModel} />
 *   <AiModelSelect useCase="tts-voice" name="ttsModel" />  // form-post usage
 *
 * The selection is a plain model-ID string — persisting it (org setting,
 * form field, API param) is the caller's job.
 */

import { useState } from 'react'
import { AI_MODELS, aiModel, aiModelOptions, AI_MODEL_LABELS, type AiModelKey } from '@/lib/ai/model-options'

export interface AiModelSelectProps {
  /** Registry key — decides which models are shown. */
  useCase: AiModelKey
  /** Controlled value (model ID). Omit for uncontrolled with registry default. */
  value?: string
  onChange?: (modelId: string) => void
  /** Visible label. Defaults to a name derived from the use case; false hides it. */
  label?: string | false
  /** Show trade-off notes in options + provider hint below. Default true. */
  showNotes?: boolean
  name?: string
  id?: string
  disabled?: boolean
  className?: string
}

export default function AiModelSelect({
  useCase,
  value,
  onChange,
  label,
  showNotes = true,
  name,
  id,
  disabled,
  className = '',
}: AiModelSelectProps) {
  const options = aiModelOptions(useCase)
  const [internal, setInternal] = useState(() => aiModel(useCase))
  const selected = value ?? internal

  const selectId = id ?? `ai-model-${useCase}`
  const labelText = label === false ? null : (label ?? AI_MODEL_LABELS[useCase])

  return (
    <div className={className}>
      {labelText && (
        <label htmlFor={selectId} className="block text-xs font-medium text-[var(--ink-500)] mb-1">
          {labelText}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={selected}
        disabled={disabled}
        onChange={(e) => {
          setInternal(e.target.value)
          onChange?.(e.target.value)
        }}
        className="h-[48px] w-full bg-white border border-[var(--ink-100)] rounded-xl text-sm text-[var(--ink-900)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--ink-300)] disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {showNotes && o.note ? ` — ${o.note}` : ''}
          </option>
        ))}
      </select>
      {showNotes && (
        <p className="mt-1 text-[11px] text-[var(--ink-400)]">
          {AI_MODELS[useCase].provider}
          {selected === aiModel(useCase) ? ' · default' : ''}
        </p>
      )}
    </div>
  )
}
