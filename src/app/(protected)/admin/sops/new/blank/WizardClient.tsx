'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import type { SectionKind, Department } from '@/types/sop'
import { listSectionKinds } from '@/actions/sections'
import { createSopFromWizard } from '@/actions/sops'
import { setSopMachines } from '@/actions/site'
import { focusHref } from '@/lib/sop/focus-path'
import { SopMetadataFields } from '@/components/admin/SopMetadataFields'
import type { SopMetadataValue } from '@/components/admin/SopMetadataFields'

// Per SPEC SB-AUTH-01, the wizard exposes only the canonical section kinds.
// 'custom' and 'content' are not offered at wizard time — admin adds them
// inside the builder via AddSectionButton if needed.
const CANONICAL_WIZARD_SLUGS = ['hazards', 'ppe', 'steps', 'emergency', 'signoff'] as const

const TitleStepSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  sopNumber: z.string().max(60).optional(),
})
type TitleStepValues = z.infer<typeof TitleStepSchema>

interface WizardClientProps {
  /** Phase 25: departments for the department multi-select field (localOnly create mode). */
  departments: Department[]
  /** Phase 57 D-19: link the new SOP to this machine once it exists. */
  machineId?: string | null
  /** Phase 63: the words a search found no SOP for ("Write it"); only the title field's starting value. */
  initialTitle?: string
}

export function WizardClient({ departments, machineId = null, initialTitle = '' }: WizardClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [titleValues, setTitleValues] = useState<TitleStepValues | null>(null)
  const [titleError, setTitleError] = useState<string | undefined>(undefined)
  const [sopNumber, setSopNumber] = useState('')
  // Phase 40 DUP-02: one shared metadata value (title + departments + category)
  // driving SopMetadataFields — replaces the old departmentIds/allDepartments
  // state and the dead SOP-level-category state that used to sit here
  // (previously set once at declaration and never mutated by any control).
  const [meta, setMeta] = useState<SopMetadataValue>({
    title: initialTitle,
    departmentIds: [],
    allDepartments: false,
    categorySlug: null,
  })
  const [kinds, setKinds] = useState<SectionKind[]>([])
  const [kindsLoading, setKindsLoading] = useState(true)
  const [selectedKindIds, setSelectedKindIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // Phase 25/40: pass departmentIds + allDepartments + categorySlug from meta (localOnly picker).
    const result = await createSopFromWizard({
      title: titleValues.title,
      sopNumber: titleValues.sopNumber || null,
      kindIds: selectedKindIds,
      categorySlug: meta.categorySlug,
      departmentIds: meta.departmentIds,
      allDepartments: meta.allDepartments,
    })
    if ('error' in result) {
      setError(result.error)
      setSubmitting(false)
      setStep(3)
      return
    }

    // D-19: place the SOP on its machine. If the link fails the SOP still exists,
    // so carry on to the editor, where the admin can place it by hand.
    if (machineId) await setSopMachines({ sopId: result.sopId, machineIds: [machineId] })

    router.push(focusHref(result.sopId, { mode: 'edit', from: 'workshop' }))
  }

  return (
    <div className="rounded-lg border border-[var(--ink-100)] bg-white p-6" data-testid="wizard-client">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--ink-500)]">
        <span className={step === 1 ? 'text-[var(--ink-900)]' : ''}>1 Title</span>
        <span>→</span>
        <span className={step === 2 ? 'text-[var(--ink-900)]' : ''}>2 Sections</span>
        <span>→</span>
        <span className={step === 3 ? 'text-[var(--ink-900)]' : ''}>3 Review</span>
        <span>→</span>
        <span className={step === 4 ? 'text-[var(--ink-900)]' : ''}>4 Create</span>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded border border-accent-escalate/30 bg-accent-escalate/10 p-3 text-sm text-accent-escalate"
        >
          {error}
        </div>
      )}

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const parsed = TitleStepSchema.safeParse({
              title: meta.title,
              sopNumber: sopNumber || undefined,
            })
            if (!parsed.success) {
              const titleIssue = parsed.error.issues.find((i) => i.path[0] === 'title')
              setTitleError(titleIssue?.message ?? 'Title is required')
              return
            }
            setTitleError(undefined)
            setTitleValues(parsed.data)
            setStep(2)
          }}
          className="flex flex-col gap-4"
        >
          {/* Phase 40 DUP-02: shared title + departments + category picker.
              Replaces the old separate title input + department block. */}
          <SopMetadataFields
            value={meta}
            onChange={setMeta}
            departments={departments}
            titleError={titleError}
            idPrefix="wizard"
          />

          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--ink-500)]">SOP number (optional)</span>
            <input
              value={sopNumber}
              onChange={(e) => setSopNumber(e.target.value)}
              className="rounded border border-[var(--ink-300)] bg-[var(--paper)] px-3 py-2 text-[var(--ink-900)]"
              placeholder="e.g. SOP-042"
              data-testid="wizard-sop-number-input"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded bg-[var(--ink-900)] px-4 py-2 text-sm font-bold text-white"
              data-testid="wizard-next-1"
            >
              Next
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--ink-500)]">
            Pick the sections you want to include. You can add more later.
          </p>
          {kindsLoading ? (
            <div className="text-[var(--ink-500)] text-sm">Loading sections…</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {kinds.map((k) => {
                const checked = selectedKindIds.includes(k.id)
                return (
                  <li key={k.id}>
                    <div
                      className="flex flex-col gap-2 rounded border border-[var(--ink-100)] p-3 hover:bg-[var(--paper)]"
                      data-kind-slug={k.slug}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
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
                          <div className="text-sm font-semibold text-[var(--ink-900)]">
                            {k.display_name}
                          </div>
                        </div>
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded border border-[var(--ink-300)] px-4 py-2 text-sm text-[var(--ink-500)]"
              data-testid="wizard-back-2"
            >
              Back
            </button>
            <button
              type="button"
              disabled={selectedKindIds.length === 0}
              onClick={() => setStep(3)}
              className="rounded bg-[var(--ink-900)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              data-testid="wizard-next-2"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && titleValues && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[var(--ink-900)]">Review</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-[var(--ink-500)]">Title</dt>
              <dd className="text-[var(--ink-900)]">{titleValues.title}</dd>
            </div>
            {titleValues.sopNumber && (
              <div>
                <dt className="text-[var(--ink-500)]">SOP number</dt>
                <dd className="text-[var(--ink-900)]">{titleValues.sopNumber}</dd>
              </div>
            )}
            {/* Phase 25/40: show department selection in review, read from meta */}
            {(meta.departmentIds.length > 0 || meta.allDepartments) && (
              <div>
                <dt className="text-[var(--ink-500)]">Departments</dt>
                <dd className="text-[var(--ink-900)]">
                  {meta.allDepartments ? (
                    <span>All departments</span>
                  ) : (
                    <span>
                      {meta.departmentIds
                        .map(id => departments.find(d => d.id === id)?.name ?? id)
                        .join(', ')}
                    </span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[var(--ink-500)]">Sections</dt>
              <dd className="text-[var(--ink-900)]">
                <ul className="list-disc pl-5">
                  {selectedKindIds.map((id) => {
                    const k = kinds.find((x) => x.id === id)
                    if (!k) return null
                    return (
                      <li key={id}>
                        {k.display_name}
                      </li>
                    )
                  })}
                </ul>
              </dd>
            </div>
          </dl>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded border border-[var(--ink-300)] px-4 py-2 text-sm text-[var(--ink-500)]"
              data-testid="wizard-back-3"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitFinal}
              className="rounded bg-[var(--ink-900)] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              data-testid="wizard-create-draft"
            >
              Create draft
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="text-[var(--ink-500)] text-sm" data-testid="wizard-submitting">
          Creating your SOP…
        </div>
      )}
    </div>
  )
}
