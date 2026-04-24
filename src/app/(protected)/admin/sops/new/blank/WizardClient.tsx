'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { SectionKind } from '@/types/sop'
import { listSectionKinds } from '@/actions/sections'
import { createSopFromWizard } from '@/actions/sops'

// Per SPEC SB-AUTH-01, the wizard exposes only the canonical section kinds.
// 'custom' and 'content' are not offered at wizard time — admin adds them
// inside the builder via AddSectionButton if needed.
const CANONICAL_WIZARD_SLUGS = ['hazards', 'ppe', 'steps', 'emergency', 'signoff'] as const

const TitleStepSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  sopNumber: z.string().max(60).optional(),
})
type TitleStepValues = z.infer<typeof TitleStepSchema>

export function WizardClient() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [titleValues, setTitleValues] = useState<TitleStepValues | null>(null)
  const [kinds, setKinds] = useState<SectionKind[]>([])
  const [kindsLoading, setKindsLoading] = useState(true)
  const [selectedKindIds, setSelectedKindIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleForm = useForm<TitleStepValues>({
    resolver: zodResolver(TitleStepSchema),
    defaultValues: titleValues ?? { title: '', sopNumber: '' },
  })

  // Fetch section_kinds lazily when the admin reaches step 2. listSectionKinds
  // already RLS-scopes the result to globals + own-org — no extra filtering
  // needed for data visibility.
  useEffect(() => {
    if (step !== 2) return
    let mounted = true
    setKindsLoading(true)
    listSectionKinds()
      .then((data) => {
        if (!mounted) return
        const canonical = data.filter((k) =>
          (CANONICAL_WIZARD_SLUGS as readonly string[]).includes(k.slug)
        )
        setKinds(canonical)
        setKindsLoading(false)
      })
      .catch((e: unknown) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'Failed to load section kinds')
        setKindsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [step])

  async function handleSubmitFinal() {
    if (!titleValues || selectedKindIds.length === 0) return
    setSubmitting(true)
    setError(null)
    setStep(4)
    const result = await createSopFromWizard({
      title: titleValues.title,
      sopNumber: titleValues.sopNumber || null,
      kindIds: selectedKindIds,
    })
    if ('error' in result) {
      setError(result.error)
      setSubmitting(false)
      setStep(3)
      return
    }
    router.push(`/admin/sops/builder/${result.sopId}`)
  }

  return (
    <div className="rounded-xl border border-steel-700 bg-steel-800 p-6" data-testid="wizard-client">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-steel-400">
        <span className={step === 1 ? 'text-brand-yellow' : ''}>1 Title</span>
        <span>→</span>
        <span className={step === 2 ? 'text-brand-yellow' : ''}>2 Sections</span>
        <span>→</span>
        <span className={step === 3 ? 'text-brand-yellow' : ''}>3 Review</span>
        <span>→</span>
        <span className={step === 4 ? 'text-brand-yellow' : ''}>4 Create</span>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {step === 1 && (
        <form
          onSubmit={titleForm.handleSubmit((values) => {
            setTitleValues(values)
            setStep(2)
          })}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel-300">Title *</span>
            <input
              {...titleForm.register('title')}
              className="rounded border border-steel-600 bg-steel-900 px-3 py-2 text-steel-100"
              placeholder="e.g. Forklift pre-start checklist"
              data-testid="wizard-title-input"
            />
            {titleForm.formState.errors.title && (
              <span className="text-xs text-red-400">
                {titleForm.formState.errors.title.message}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-steel-300">SOP number (optional)</span>
            <input
              {...titleForm.register('sopNumber')}
              className="rounded border border-steel-600 bg-steel-900 px-3 py-2 text-steel-100"
              placeholder="e.g. SOP-042"
              data-testid="wizard-sop-number-input"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded bg-brand-yellow px-4 py-2 text-sm font-bold text-steel-900"
              data-testid="wizard-next-1"
            >
              Next
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-steel-300">
            Pick the sections you want to include. You can add more later.
          </p>
          {kindsLoading ? (
            <div className="text-steel-400 text-sm">Loading sections…</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {kinds.map((k) => {
                const checked = selectedKindIds.includes(k.id)
                return (
                  <li key={k.id}>
                    <label
                      className="flex items-start gap-3 rounded border border-steel-700 p-3 hover:bg-steel-900 cursor-pointer"
                      data-kind-slug={k.slug}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedKindIds((prev) =>
                            e.target.checked
                              ? [...prev, k.id]
                              : prev.filter((id) => id !== k.id)
                          )
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-steel-100">
                          {k.display_name}
                        </div>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded border border-steel-600 px-4 py-2 text-sm text-steel-300"
              data-testid="wizard-back-2"
            >
              Back
            </button>
            <button
              type="button"
              disabled={selectedKindIds.length === 0}
              onClick={() => setStep(3)}
              className="rounded bg-brand-yellow px-4 py-2 text-sm font-bold text-steel-900 disabled:opacity-40"
              data-testid="wizard-next-2"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && titleValues && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-steel-100">Review</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-steel-400">Title</dt>
              <dd className="text-steel-100">{titleValues.title}</dd>
            </div>
            {titleValues.sopNumber && (
              <div>
                <dt className="text-steel-400">SOP number</dt>
                <dd className="text-steel-100">{titleValues.sopNumber}</dd>
              </div>
            )}
            <div>
              <dt className="text-steel-400">Sections</dt>
              <dd className="text-steel-100">
                <ul className="list-disc pl-5">
                  {selectedKindIds.map((id) => {
                    const k = kinds.find((x) => x.id === id)
                    return k ? <li key={id}>{k.display_name}</li> : null
                  })}
                </ul>
              </dd>
            </div>
          </dl>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded border border-steel-600 px-4 py-2 text-sm text-steel-300"
              data-testid="wizard-back-3"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitFinal}
              className="rounded bg-brand-yellow px-4 py-2 text-sm font-bold text-steel-900 disabled:opacity-40"
              data-testid="wizard-create-draft"
            >
              Create draft
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="text-steel-300 text-sm" data-testid="wizard-submitting">
          Creating your SOP…
        </div>
      )}
    </div>
  )
}
