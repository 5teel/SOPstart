'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { aiPromptSchema, type AiPromptInput } from '@/lib/validators/sop'
import ParseJobStatus from '@/components/admin/ParseJobStatus'

// Zod's `.default(3)` on detailLevel makes the input shape (form values) differ
// from the output shape (parsed values). Pin RHF to the parsed (output) shape so
// SubmitHandler<AiPromptInput> aligns with onSubmit(values: AiPromptInput).
type AiPromptFormInput = z.input<typeof aiPromptSchema>

type Props = { categories: string[] }

export function PromptClient({ categories }: Props) {
  const router = useRouter()
  const [sopId, setSopId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AiPromptFormInput, undefined, AiPromptInput>({
    resolver: zodResolver(aiPromptSchema),
    defaultValues: { promptText: '', categoryTag: null, detailLevel: 3 },
  })

  const detailLevel = watch('detailLevel') ?? 3

  const onSubmit: SubmitHandler<AiPromptInput> = async (values) => {
    setSubmitting(true)
    setServerError(null)
    try {
      const res = await fetch('/api/sops/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.sopId) {
        setServerError(json.error ?? 'Generation failed — try again')
        setSubmitting(false)
        return
      }
      setSopId(json.sopId)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Network error')
      setSubmitting(false)
    }
  }

  // Once we have a sopId, swap the form for the live stepper. ParseJobStatus
  // handles Realtime + 5s polling; on completion it invokes onCompleted to
  // route to the existing review page (D-03).
  if (sopId) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-[var(--ink-900)] mb-4">Drafting your SOP</h2>
        <ParseJobStatus
          sopId={sopId}
          initialIsVideo={false}
          onCompleted={() => router.push(`/admin/sops/builder/${sopId}`)}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label htmlFor="promptText" className="block text-sm font-medium text-[var(--ink-700)] mb-1">
          Your prompt
        </label>
        <textarea
          id="promptText"
          {...register('promptText')}
          rows={5}
          placeholder="e.g. PPE check for forklift operators at our Hamilton site"
          className="w-full bg-white border border-[var(--ink-100)] rounded-lg p-3 text-[var(--ink-900)] placeholder-[var(--ink-500)] focus:border-[var(--ink-900)] focus:outline-none"
        />
        {errors.promptText && (
          <p className="mt-1 text-sm text-red-400">{errors.promptText.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="categoryTag" className="block text-sm font-medium text-[var(--ink-700)] mb-1">
          Category (optional)
        </label>
        <select
          id="categoryTag"
          {...register('categoryTag')}
          className="w-full bg-white border border-[var(--ink-100)] rounded-lg p-2 text-[var(--ink-900)]"
        >
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="detailLevel" className="block text-sm font-medium text-[var(--ink-700)] mb-1">
          Detail level <span className="text-[var(--ink-500)]">(1 = minimal, 5 = maximum) — currently {detailLevel}</span>
        </label>
        <input
          id="detailLevel"
          type="range"
          min={1}
          max={5}
          step={1}
          {...register('detailLevel', { valueAsNumber: true })}
          className="w-full accent-[var(--ink-900)]"
        />
      </div>

      {serverError && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-200">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[var(--ink-900)] text-white font-semibold rounded-lg py-3 hover:bg-[var(--ink-700)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Generating…' : 'Generate draft'}
      </button>
    </form>
  )
}
