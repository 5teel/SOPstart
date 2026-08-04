'use client'

/**
 * Phase 40 DUP-02 (D-09..D-12) — the one composite title + departments +
 * category field group shared by every SOP creation surface (typed-brief AI
 * draft, voice draft, blank wizard). Consolidates three near-identical
 * copies that had drifted: only WizardClient collected a title, PromptClient
 * had a free-text category `<select>` fed by a live `DISTINCT sops.category`
 * query (an anti-pattern per DAT-01 — deleted here), and VoiceDraftClient had
 * no category UI at all. See 40-PATTERNS.md for the full comparison.
 *
 * These three fields are no longer inline inputs. They are collected up front
 * by SopMetadataDialog — one decision at a time on a recessed screen — and
 * this component is what remains on the page afterwards: a compact, quiet
 * summary of the answers with one way back in. The dialog opens by itself the
 * first time, when nothing has been set yet, because these are decisions the
 * surface cannot proceed sensibly without.
 *
 * The props contract is UNCHANGED from the inline version, which is the point:
 * all three call sites picked up the new interaction without an edit. That is
 * the DUP-02 consolidation paying for itself.
 *
 * D-10: this is ONE composite component rendering all fields with uniform
 * layout — not a field kit of three independently-composable parts. The
 * `showTitle`/`showCategory`/`showDepartments` props are escape hatches for a
 * surface that genuinely lacks a field, not a per-surface theming API. Hiding
 * a field is a deviation from the norm and must be justified in a comment at
 * the call site. A hidden field is also dropped from the dialog's step run.
 *
 * D-11: `localOnly` on `DepartmentPicker` is mandatory and non-negotiable.
 * This component NEVER calls a server action and NEVER writes
 * `sop_departments` directly — it only reports the selection via `onChange`.
 * The parent owns `value` and commits the real write (`assignSopDepartments`)
 * on final submit, exactly as all three pre-existing copies already did.
 */

import { useEffect, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import type { Department } from '@/types/sop'
import { SOP_CATEGORIES } from '@/lib/sop-categories'
import { SopMetadataDialog, STEP_LABEL, type MetadataStep } from '@/components/admin/SopMetadataDialog'

export type SopMetadataValue = {
  title: string
  departmentIds: string[]
  allDepartments: boolean
  categorySlug: string | null
}

type Props = {
  value: SopMetadataValue
  onChange: (next: SopMetadataValue) => void
  /** Pre-fetched by the server component — this component never fetches. */
  departments: Department[]
  /**
   * Escape hatch (D-10) — hide the title field. Only for a surface that
   * genuinely lacks a title step; document why at the call site.
   */
  showTitle?: boolean
  /**
   * Escape hatch (D-10) — hide the category field. Only for a surface that
   * genuinely lacks a category step; document why at the call site.
   */
  showCategory?: boolean
  /**
   * Escape hatch (D-10) — hide the department field. Only for a surface that
   * genuinely lacks a department step; document why at the call site.
   */
  showDepartments?: boolean
  titleError?: string
  disabled?: boolean
  /** Distinguishes htmlFor/id pairs when two instances render on one page. */
  idPrefix?: string
}

const SORTED_CATEGORIES = [...SOP_CATEGORIES].sort((a, b) => a.sort - b.sort)

export function SopMetadataFields({
  value,
  onChange,
  departments,
  showTitle = true,
  showCategory = true,
  showDepartments = true,
  titleError,
  disabled,
  idPrefix = 'sop-meta',
}: Props) {
  // A field the surface has hidden is not a step the user gets asked about.
  const steps = useMemo<MetadataStep[]>(() => {
    const s: MetadataStep[] = []
    if (showDepartments && departments.length > 0) s.push('departments')
    if (showCategory) s.push('category')
    if (showTitle) s.push('title')
    return s
  }, [showDepartments, showCategory, showTitle, departments.length])

  // Auto-open once, only when there is genuinely nothing to show yet. Editing
  // an existing draft (title already present) does not get ambushed by a modal.
  const [open, setOpen] = useState(false)
  const [autoOpened, setAutoOpened] = useState(false)
  const [reopenAt, setReopenAt] = useState<MetadataStep | undefined>(undefined)

  useEffect(() => {
    if (autoOpened || disabled || steps.length === 0) return
    const untouched =
      value.title.trim() === '' &&
      value.categorySlug === null &&
      value.departmentIds.length === 0 &&
      !value.allDepartments
    setAutoOpened(true)
    if (untouched) setOpen(true)
  }, [autoOpened, disabled, steps.length, value])

  const categoryLabel = value.categorySlug
    ? SORTED_CATEGORIES.find((c) => c.slug === value.categorySlug)?.label ?? value.categorySlug
    : 'No category'

  const audience = value.allDepartments || value.departmentIds.length === 0
    ? 'Everyone in the organisation'
    : (value.departmentIds
        .map((id) => departments.find((d) => d.id === id)?.name)
        .filter(Boolean) as string[]).join(', ')

  const openAt = (step: MetadataStep) => {
    if (disabled) return
    setReopenAt(step)
    setOpen(true)
  }

  // Labels come from STEP_LABEL, not a second list — one name per field.
  const rows: { step: MetadataStep; text: string; testid: string }[] = []
  if (steps.includes('departments')) {
    rows.push({ step: 'departments', text: audience, testid: 'summary-departments' })
  }
  if (steps.includes('category')) {
    rows.push({ step: 'category', text: categoryLabel, testid: 'summary-category' })
  }
  if (steps.includes('title')) {
    rows.push({ step: 'title', text: value.title.trim() || 'Not set yet', testid: 'summary-title' })
  }

  return (
    <div className="flex flex-col gap-2" data-testid="sop-metadata-fields">
      <div className="rounded border border-[var(--ink-100)] bg-[var(--paper-2)]">
        {rows.map((r, i) => (
          <button
            key={r.step}
            type="button"
            disabled={disabled}
            onClick={() => openAt(r.step)}
            data-testid={`sop-metadata-${r.testid}`}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
              i > 0 ? 'border-t border-[var(--ink-100)]' : ''
            }`}
          >
            <span className="w-44 shrink-0 text-xs uppercase tracking-wider text-[var(--ink-500)]">
              {STEP_LABEL[r.step]}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                r.text === 'Not set yet' ? 'text-[var(--ink-300)]' : 'text-[var(--ink-900)]'
              }`}
            >
              {r.text}
            </span>
            <Pencil size={13} className="shrink-0 text-[var(--ink-500)]" aria-hidden="true" />
          </button>
        ))}
      </div>

      {titleError && <span className="text-xs text-red-400">{titleError}</span>}

      {open && (
        <SopMetadataDialog
          value={value}
          onChange={onChange}
          onClose={() => {
            setOpen(false)
            setReopenAt(undefined)
          }}
          departments={departments}
          steps={steps}
          initialStep={reopenAt}
          idPrefix={idPrefix}
        />
      )}
    </div>
  )
}
