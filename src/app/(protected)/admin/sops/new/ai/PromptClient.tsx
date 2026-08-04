'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { aiPromptSchema, type AiPromptInput } from '@/lib/validators/sop'
import ParseJobStatus from '@/components/admin/ParseJobStatus'
import type { Department } from '@/types/sop'
import { SopMetadataFields } from '@/components/admin/SopMetadataFields'
import type { SopMetadataValue } from '@/components/admin/SopMetadataFields'

// Zod's `.default(3)` on detailLevel makes the input shape (form values) differ
// from the output shape (parsed values). Pin RHF to the parsed (output) shape so
// SubmitHandler<AiPromptInput> aligns with onSubmit(values: AiPromptInput).
type AiPromptFormInput = z.input<typeof aiPromptSchema>

/**
 * Plain-language summary of each detail level. The authoritative versions are
 * the DETAIL_LEVEL_HINTS prompt blocks in src/lib/parsers/sop-parser.ts — these
 * are the one-line UI paraphrases of them. They are duplicated deliberately:
 * sop-parser.ts is a server module and importing it here would drag the parser
 * into the client bundle. If a hint changes materially, change its line here.
 *
 * A bare 1-5 slider asked the admin to guess what "2" meant while the system
 * held a precise description of it — this is that description, surfaced.
 */
const DETAIL_LEVELS: Record<number, { name: string; blurb: string }> = {
  1: { name: 'Minimal', blurb: 'A short checklist. One line per step, and only genuinely dangerous hazards.' },
  2: { name: 'Brief', blurb: 'Concise. Key hazards and PPE, one or two sentences per step, minor tips skipped.' },
  3: { name: 'Standard', blurb: 'All hazards, PPE and steps with clear descriptions, plus the tools needed.' },
  4: { name: 'Detailed', blurb: 'Explains why each step matters. Tips, time estimates, full hazard mitigations, quality checks.' },
  5: { name: 'Maximum', blurb: 'Sub-steps, hazard severity ratings, emergency procedures, regulatory references, sign-off requirements.' },
}

const LEVELS = [1, 2, 3, 4, 5] as const

type Props = {
  /** Phase 25: departments for the department multi-select field (localOnly create mode). */
  departments: Department[]
}

export function PromptClient({ departments }: Props) {
  const router = useRouter()
  const [sopId, setSopId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Phase 40 DUP-02: one shared metadata value (title + departments + category)
  // driving SopMetadataFields — replaces the three separate pieces of state
  // this form used to carry.
  const [meta, setMeta] = useState<SopMetadataValue>({
    title: '',
    departmentIds: [],
    allDepartments: false,
    categorySlug: null,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AiPromptFormInput, undefined, AiPromptInput>({
    resolver: zodResolver(aiPromptSchema),
    defaultValues: { promptText: '', detailLevel: 3 },
  })

  // Coerced on read as well as on write: a radio hands back a STRING, and a
  // string here silently breaks two things at once — the selected-box highlight
  // (=== against a number is never true) and zod's z.number() on submit.
  const detailLevel = Number(watch('detailLevel') ?? 3)

  const onSubmit: SubmitHandler<AiPromptInput> = async (values) => {
    setSubmitting(true)
    setServerError(null)
    try {
      const res = await fetch('/api/sops/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Phase 25/40: departmentIds + allDepartments (A3) — the ai-prompt route
        // reads these and writes sop_departments post-insert via assignSopDepartments.
        body: JSON.stringify({
          ...values,
          title: meta.title || null,
          categorySlug: meta.categorySlug,
          departmentIds: meta.departmentIds,
          allDepartments: meta.allDepartments,
        }),
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
      {/* Setup first — who it's for, what it's called, how deep to go. Then the
          prompt, sitting directly above the button that acts on it. */}

      {/* Phase 40 DUP-02: shared title + departments + category picker.
          Title is not offered by RHF here — meta.title flows straight into the POST body. */}
      <SopMetadataFields value={meta} onChange={setMeta} departments={departments} idPrefix="ai-prompt" />

      {/* Real radios, not buttons: a radiogroup gives arrow-key selection and
          screen-reader semantics for free. The descriptions sit behind a native
          <details> — no JS, keyboard-operable, collapsed until asked for. */}
      <fieldset>
        <legend className="block text-sm font-medium text-[var(--ink-700)] mb-1">
          How much detail should the draft have?
        </legend>
        <div className="grid grid-cols-5 gap-1.5">
          {LEVELS.map((level) => {
            const selected = detailLevel === level
            return (
              <label
                key={level}
                data-testid={`detail-level-${level}`}
                data-selected={selected ? 'true' : undefined}
                className={`cursor-pointer rounded border px-2 py-2 text-center transition-colors ${
                  selected
                    ? 'border-[var(--ink-900)] bg-[var(--paper-2)]'
                    : 'border-[var(--ink-100)] hover:border-[var(--ink-300)]'
                }`}
              >
                <input
                  type="radio"
                  value={level}
                  checked={selected}
                  // setValueAs, NOT valueAsNumber — the latter only applies to
                  // <input type="number">, so a radio would store "2" and fail
                  // aiPromptSchema's z.number() on submit.
                  {...register('detailLevel', { setValueAs: (v) => Number(v) })}
                  className="sr-only"
                />
                <span className="mono block text-[10px] text-[var(--ink-500)]">{level}</span>
                <span
                  className={`block text-[11px] leading-tight ${
                    selected ? 'font-semibold text-[var(--ink-900)]' : 'text-[var(--ink-700)]'
                  }`}
                >
                  {DETAIL_LEVELS[level].name}
                </span>
              </label>
            )
          })}
        </div>

        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-[var(--ink-500)] hover:text-[var(--ink-900)]">
            What these mean
          </summary>
          <dl className="mt-2 flex flex-col gap-1.5">
            {LEVELS.map((level) => (
              <div key={level} className="flex gap-2 text-sm">
                <dt
                  className={`w-20 shrink-0 ${
                    detailLevel === level
                      ? 'font-semibold text-[var(--ink-900)]'
                      : 'text-[var(--ink-500)]'
                  }`}
                >
                  {DETAIL_LEVELS[level].name}
                </dt>
                <dd className="min-w-0 flex-1 text-[var(--ink-500)]">
                  {DETAIL_LEVELS[level].blurb}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </fieldset>

      <div>
        <label htmlFor="promptText" className="block text-sm font-medium text-[var(--ink-700)] mb-1">
          Your prompt
        </label>
        <p className="mb-2 text-sm text-[var(--ink-500)]">
          Describe the procedure in a sentence or two — AI drafts structured sections, steps,
          hazards and PPE for you to review in the builder.
        </p>
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
