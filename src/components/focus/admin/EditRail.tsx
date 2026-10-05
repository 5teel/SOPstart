'use client'

/**
 * Phase 58 (58-12) -- the editor's left rail: sections with their steps in source
 * order (not walk order), each step showing its tick state at the right, a
 * "＋ Add section" row, and a `footer` slot pinned under the list for "This SOP".
 * Same container as FocusRail (300 px; a full-screen sheet below lg).
 */
import { useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { addDefaultSection } from '@/components/focus/admin/EditDocument'
import { scrollToStep } from '@/components/focus/FocusRail'
import { KIND_DOT } from '@/components/focus/KindChip'
import { useRegisterOverlay } from '@/hooks/useFocusBack'
import { useFocusSop } from '@/hooks/useFocusSop'
import type { FocusSop } from '@/lib/sop/focus-read'

export interface EditRailProps {
  sopId: string
  initial: FocusSop
  /** Below lg the rail is a full-screen sheet; this is its open state. */
  open: boolean
  onClose(): void
  /** Steps with an open AI finding get a violet dot. */
  flaggedStepIds?: ReadonlySet<string>
  /** Pinned under the list (58-13 passes ThisSopBlock). */
  footer?: ReactNode
}

export function EditRail({ sopId, initial, open, onClose, flaggedStepIds, footer }: EditRailProps) {
  useRegisterOverlay(open, onClose)
  const { focus, invalidate } = useFocusSop(sopId, initial)
  const [error, setError] = useState<string | null>(null)
  const readOnly = focus.sop.status !== 'draft'

  async function addSection() {
    setError(null)
    const res = await addDefaultSection(sopId)
    if ('error' in res) return setError(res.error)
    await invalidate()
  }

  return (
    <nav
      data-testid="edit-rail"
      aria-label="Steps"
      className={`${open ? 'flex' : 'hidden'} w-75 shrink-0 flex-col overflow-y-auto border-r border-ink-200 bg-paper-2 max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:w-auto lg:flex`}
    >
      <button
        type="button"
        onClick={onClose}
        className="flex min-h-tap items-center gap-2 px-4 text-ui text-ink-700 lg:hidden"
      >
        <X className="size-4" aria-hidden="true" />
        Close
      </button>

      {focus.sections.map((section, i) => (
        <div key={section.id}>
          <p className="mono px-4 pb-1 pt-4 text-meta uppercase text-ink-500">
            {String(i + 1).padStart(2, '0')} · {section.title}
          </p>
          {focus.steps
            .filter((s) => s.section_id === section.id)
            .map((step) => {
              const flagged = flaggedStepIds?.has(step.id) ?? false
              const ticked = !!step.verified_by_admin_id
              return (
                <button
                  key={step.id}
                  type="button"
                  data-testid="edit-rail-row"
                  data-ticked={ticked ? 'true' : 'false'}
                  onClick={() => {
                    scrollToStep(step.id)
                    onClose()
                  }}
                  className="flex min-h-tap w-full items-center gap-2 px-4 text-left text-ui text-ink-700"
                >
                  <span className={`size-2 shrink-0 rounded-full ${KIND_DOT[step.kind]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{step.text || 'New step'}</span>
                  {flagged && <span className="size-2 shrink-0 rounded-full bg-ai" data-testid="edit-rail-flag" aria-label="Flagged" />}
                  {ticked ? (
                    <Check className="size-4 shrink-0 text-accent-ok" aria-label="Checked" />
                  ) : (
                    <span className="size-4 shrink-0 rounded-full border border-ink-300" aria-label="Not checked yet" />
                  )}
                </button>
              )
            })}
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          data-testid="edit-rail-add-section"
          onClick={() => void addSection()}
          className="mx-4 my-3 flex min-h-tap items-center rounded border border-dashed border-ink-300 px-3 text-ui text-ink-500 hover:border-accent-step hover:text-accent-step"
        >
          ＋ Add section
        </button>
      )}
      {error && (
        <p role="alert" className="px-4 pb-2 text-ui text-accent-escalate">
          {error}
        </p>
      )}

      {footer && <div className="sticky bottom-0 mt-auto border-t border-ink-200 bg-paper-2">{footer}</div>}
    </nav>
  )
}
