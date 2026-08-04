'use client'

/**
 * SopMetadataDialog — one decision at a time, on a recessed screen.
 *
 * The house pattern for a required decision that needs NO surrounding context
 * to make: put it in a modal, dim everything else, and ask for one thing at a
 * time. Answered steps stay on screen but recede — you can still read the
 * department you picked while you choose a category — and any of them can be
 * re-opened with a click. Steps you have not reached yet are visible but faint,
 * so the length of the run is never a surprise.
 *
 * Order is deliberate: Department -> Category -> Title. The two low-effort
 * picks come first (tap a chip, tap a card); the one that needs composition
 * comes last, by which point the earlier answers are on screen to write against.
 *
 * When NOT to use this pattern: a decision that needs the page behind it to be
 * readable — reviewing a parsed block against its source, say, or anything the
 * user must compare with surrounding content. Dimming the context you need is
 * worse than an inline field.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import type { Department } from '@/types/sop'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import { DChip } from '@/components/admin/departments/DChip'
import { SOP_CATEGORIES } from '@/lib/sop-categories'
import type { SopMetadataValue } from '@/components/admin/SopMetadataFields'

export type MetadataStep = 'departments' | 'category' | 'title'

const SORTED_CATEGORIES = [...SOP_CATEGORIES].sort((a, b) => a.sort - b.sort)

const STEP_LABEL: Record<MetadataStep, string> = {
  departments: 'Who can see it',
  category: 'What kind of SOP',
  title: 'What it is called',
}

type Props = {
  value: SopMetadataValue
  onChange: (next: SopMetadataValue) => void
  onClose: () => void
  departments: Department[]
  steps: MetadataStep[]
  /** Step to open on; defaults to the first unanswered one. */
  initialStep?: MetadataStep
  idPrefix: string
}

/** A one-line human summary of an answered step, shown in the recessed trail. */
function summarise(step: MetadataStep, value: SopMetadataValue, departments: Department[]): string {
  if (step === 'departments') {
    if (value.allDepartments) return 'Everyone in the organisation'
    if (value.departmentIds.length === 0) return 'Everyone in the organisation'
    const names = value.departmentIds
      .map((id) => departments.find((d) => d.id === id)?.name)
      .filter(Boolean) as string[]
    return names.join(', ') || 'Selected departments'
  }
  if (step === 'category') {
    if (!value.categorySlug) return 'No category'
    return SORTED_CATEGORIES.find((c) => c.slug === value.categorySlug)?.label ?? value.categorySlug
  }
  return value.title.trim() || 'Untitled'
}

export function SopMetadataDialog({
  value,
  onChange,
  onClose,
  departments,
  steps,
  initialStep,
  idPrefix,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [answered, setAnswered] = useState<Set<MetadataStep>>(new Set())
  const [active, setActive] = useState<MetadataStep>(initialStep ?? steps[0])
  const panelRef = useRef<HTMLDivElement>(null)

  // Portal target only exists on the client. Seeding `mounted` false and
  // flipping it in an effect keeps first render identical on both sides
  // (CLAUDE.md [2026-06-08] — never derive first paint from a browser global).
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [active])

  const advance = useCallback(
    (from: MetadataStep) => {
      setAnswered((prev) => new Set(prev).add(from))
      const next = steps[steps.indexOf(from) + 1]
      if (next) setActive(next)
      else onClose()
    },
    [steps, onClose]
  )

  const isAnswered = useCallback(
    (s: MetadataStep) => answered.has(s) && s !== active,
    [answered, active]
  )

  const trail = useMemo(
    () =>
      steps.map((s) => ({
        step: s,
        state: s === active ? 'active' : isAnswered(s) ? 'done' : ('pending' as const),
      })),
    [steps, active, isAnswered]
  )

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => {
        // Backdrop click closes; keeps whatever has been answered so far.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idPrefix}-dialog-heading`}
        data-testid="sop-metadata-dialog"
        className="w-full max-w-lg rounded-md border border-[var(--ink-300)] bg-white p-6 shadow-lg"
      >
        <h2
          id={`${idPrefix}-dialog-heading`}
          className="mono text-lg font-semibold text-[var(--ink-900)]"
        >
          Set up this SOP
        </h2>
        <p className="mt-1 mb-5 text-sm text-[var(--ink-500)]">
          Three quick things. You can change any of them by clicking it.
        </p>

        <ol className="flex flex-col gap-2">
          {trail.map(({ step, state }) => {
            // ── Answered: recessed, still readable, one click to revisit ──
            if (state === 'done') {
              return (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => setActive(step)}
                    data-testid={`sop-metadata-step-${step}-done`}
                    className="flex w-full items-center gap-3 rounded border border-[var(--ink-100)] px-3 py-2 text-left opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--ink-900)]"
                  >
                    <Check size={14} className="shrink-0 text-[var(--ink-500)]" aria-hidden="true" />
                    <span className="shrink-0 text-xs uppercase tracking-wider text-[var(--ink-500)]">
                      {STEP_LABEL[step]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-900)]">
                      {summarise(step, value, departments)}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--ink-500)] underline">Change</span>
                  </button>
                </li>
              )
            }

            // ── Not reached yet: visible, faint, inert ──
            if (state === 'pending') {
              return (
                <li
                  key={step}
                  aria-hidden="true"
                  className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-300)] opacity-40"
                >
                  {STEP_LABEL[step]}
                </li>
              )
            }

            // ── Active: the one decision being asked for ──
            return (
              <li
                key={step}
                data-testid={`sop-metadata-step-${step}-active`}
                className="rounded border border-[var(--ink-900)] p-4"
              >
                <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">
                  {STEP_LABEL[step]}
                </span>

                {step === 'departments' && (
                  <div className="mt-3 flex flex-col gap-2">
                    {(value.departmentIds.length > 0 || value.allDepartments) && (
                      <div className="flex flex-wrap gap-1">
                        {value.allDepartments ? (
                          <DChip variant="all-departments" />
                        ) : (
                          value.departmentIds.map((id) => {
                            const dept = departments.find((d) => d.id === id)
                            return dept ? (
                              <DChip key={id} variant="department" department={dept} />
                            ) : null
                          })
                        )}
                      </div>
                    )}
                    {/* localOnly (D-11) — reports the selection, never writes. */}
                    <DepartmentPicker
                      mode="sop"
                      sopId="__new__"
                      localOnly
                      departments={departments}
                      selectedIds={value.departmentIds}
                      allDepartments={value.allDepartments}
                      onChange={(ids, all) =>
                        onChange({ ...value, departmentIds: ids, allDepartments: all })
                      }
                    />
                    <p className="text-xs text-[var(--ink-500)]">
                      Pick the departments who need this. Choose none and everyone in the
                      organisation can see it.
                    </p>
                    <button
                      type="button"
                      data-autofocus
                      onClick={() => advance('departments')}
                      data-testid="sop-metadata-step-departments-continue"
                      className="mt-1 self-start rounded bg-[var(--ink-900)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {step === 'category' && (
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {SORTED_CATEGORIES.map((c, i) => (
                      <button
                        key={c.slug}
                        type="button"
                        data-autofocus={i === 0 ? true : undefined}
                        onClick={() => {
                          onChange({ ...value, categorySlug: c.slug })
                          advance('category')
                        }}
                        data-testid={`sop-metadata-category-${c.slug}`}
                        className={`rounded border px-3 py-2 text-left text-sm transition-colors hover:border-[var(--ink-900)] ${
                          value.categorySlug === c.slug
                            ? 'border-[var(--ink-900)] bg-[var(--paper-2)] font-semibold'
                            : 'border-[var(--ink-100)]'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ ...value, categorySlug: null })
                        advance('category')
                      }}
                      data-testid="sop-metadata-category-none"
                      className="rounded border border-dashed border-[var(--ink-300)] px-3 py-2 text-left text-sm text-[var(--ink-500)] hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
                    >
                      No category
                    </button>
                  </div>
                )}

                {step === 'title' && (
                  <div className="mt-3 flex flex-col gap-2">
                    <input
                      id={`${idPrefix}-title`}
                      data-autofocus
                      value={value.title}
                      onChange={(e) => onChange({ ...value, title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && value.title.trim()) {
                          e.preventDefault()
                          advance('title')
                        }
                      }}
                      placeholder="e.g. Forklift pre-start checklist"
                      data-testid="sop-metadata-title-input"
                      className="rounded border border-[var(--ink-300)] bg-[var(--paper)] px-3 py-2 text-[var(--ink-900)]"
                    />
                    <p className="text-xs text-[var(--ink-500)]">
                      What a worker will look for in the library.
                    </p>
                    <button
                      type="button"
                      disabled={!value.title.trim()}
                      onClick={() => advance('title')}
                      data-testid="sop-metadata-step-title-continue"
                      className="mt-1 self-start rounded bg-[var(--ink-900)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Done
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>,
    document.body
  )
}
