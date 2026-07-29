'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { aiPromptSchema, type AiPromptInput } from '@/lib/validators/sop'
import ParseJobStatus from '@/components/admin/ParseJobStatus'
import type { Department } from '@/types/sop'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import { DChip } from '@/components/admin/departments/DChip'

// Zod's `.default(3)` on detailLevel makes the input shape (form values) differ
// from the output shape (parsed values). Pin RHF to the parsed (output) shape so
// SubmitHandler<AiPromptInput> aligns with onSubmit(values: AiPromptInput).
type AiPromptFormInput = z.input<typeof aiPromptSchema>

type Props = {
  categories: string[]
  /** Phase 25: departments for the department multi-select field (localOnly create mode). */
  departments: Department[]
}

export function PromptClient({ categories, departments }: Props) {
  const router = useRouter()
  const [sopId, setSopId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Phase 25: department multi-select — localOnly (A3: passed in POST body to ai-prompt route).
  const [departmentIds, setDepartmentIds] = useState<string[]>([])
  const [allDepartments, setAllDepartments] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AiPromptFormInput, undefined, AiPromptInput>({
    resolver: zodResolver(aiPromptSchema),
    defaultValues: { promptText: '', categorySlug: null, detailLevel: 3 },
  })

  const detailLevel = watch('detailLevel') ?? 3

  const onSubmit: SubmitHandler<AiPromptInput> = async (values) => {
    setSubmitting(true)
    setServerError(null)
    try {
      const res = await fetch('/api/sops/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Phase 25: include departmentIds + allDepartments (A3).
        // The ai-prompt route reads these and writes sop_departments post-insert.
        body: JSON.stringify({ ...values, departmentIds, allDepartments }),
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

      {/* Phase 25: Department multi-select (localOnly — A3: written in ai-prompt route post-insert) */}
      {departments.length > 0 && (
        <div data-testid="ai-prompt-dept-field">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ink-700)' }}>
            Department <span className="font-normal text-[var(--ink-500)]">(optional)</span>
          </label>
          {/* Show selected dept chips */}
          {(departmentIds.length > 0 || allDepartments) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {allDepartments ? (
                <DChip variant="all-departments" />
              ) : (
                departmentIds.map(id => {
                  const dept = departments.find(d => d.id === id)
                  return dept ? (
                    <DChip key={id} variant="department" department={dept} />
                  ) : null
                })
              )}
            </div>
          )}
          <DepartmentPicker
            mode="sop"
            sopId="__new__"
            localOnly
            departments={departments}
            selectedIds={departmentIds}
            allDepartments={allDepartments}
            onChange={(ids, all) => {
              setDepartmentIds(ids)
              setAllDepartments(all)
            }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-500)' }}>
            Leave empty to make visible to all members, or select departments to restrict visibility.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="categorySlug" className="block text-sm font-medium text-[var(--ink-700)] mb-1">
          Category (optional)
        </label>
        <select
          id="categorySlug"
          {...register('categorySlug')}
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
