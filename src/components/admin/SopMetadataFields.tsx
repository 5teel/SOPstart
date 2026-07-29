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
 * D-10: this is ONE composite component rendering all fields with uniform
 * layout — not a field kit of three independently-composable parts. The
 * `showTitle`/`showCategory`/`showDepartments` props are escape hatches for a
 * surface that genuinely lacks a field, not a per-surface theming API. Hiding
 * a field is a deviation from the norm and must be justified in a comment at
 * the call site.
 *
 * D-11: `localOnly` on `DepartmentPicker` is mandatory and non-negotiable.
 * This component NEVER calls a server action and NEVER writes
 * `sop_departments` directly — it only reports the selection via `onChange`.
 * The parent owns `value` and commits the real write (`assignSopDepartments`)
 * on final submit, exactly as all three pre-existing copies already did.
 *
 * Uncontrolled RHF `register()` is deliberately NOT used for the title field:
 * two of the three call sites (PromptClient, VoiceDraftClient) don't use
 * react-hook-form for this field at all, so this component is driven purely
 * by controlled `value`/`onChange` props.
 */

import type { Department } from '@/types/sop'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import { DChip } from '@/components/admin/departments/DChip'
import { SOP_CATEGORIES } from '@/lib/sop-categories'

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
  return (
    <div className="flex flex-col gap-4" data-testid="sop-metadata-fields">
      {showTitle && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--ink-500)]">Title *</span>
          <input
            id={`${idPrefix}-title`}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            disabled={disabled}
            className="rounded border border-[var(--ink-300)] bg-[var(--paper)] px-3 py-2 text-[var(--ink-900)]"
            placeholder="e.g. Forklift pre-start checklist"
            data-testid="sop-metadata-title-input"
          />
          {titleError && <span className="text-xs text-red-400">{titleError}</span>}
        </label>
      )}

      {/* Departments — localOnly (D-11): parent owns the selection, the write
          happens on final submit through assignSopDepartments. This component
          must never call a server action and must never write sop_departments
          directly. */}
      {showDepartments && departments.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="sop-metadata-dept-field">
          <span className="text-sm font-semibold" style={{ color: 'var(--ink-900)' }}>
            Department <span className="font-normal text-[var(--ink-500)]">(optional)</span>
          </span>
          {(value.departmentIds.length > 0 || value.allDepartments) && (
            <div className="flex flex-wrap gap-1 mb-1">
              {value.allDepartments ? (
                <DChip variant="all-departments" />
              ) : (
                value.departmentIds.map((id) => {
                  const dept = departments.find((d) => d.id === id)
                  return dept ? <DChip key={id} variant="department" department={dept} /> : null
                })
              )}
            </div>
          )}
          <DepartmentPicker
            mode="sop"
            sopId="__new__"
            localOnly
            departments={departments}
            selectedIds={value.departmentIds}
            allDepartments={value.allDepartments}
            onChange={(ids, all) => onChange({ ...value, departmentIds: ids, allDepartments: all })}
          />
          <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
            Leave empty to make visible to all members, or select departments to restrict visibility.
          </span>
        </div>
      )}

      {/* Category — fixed SOP_CATEGORIES vocabulary (DAT-01). The live
          `DISTINCT sops.category` query PromptClient used to populate this
          dropdown queried a column DAT-01 retires and must not survive. */}
      {showCategory && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--ink-500)]">Category (optional)</span>
          <select
            id={`${idPrefix}-category`}
            value={value.categorySlug ?? ''}
            onChange={(e) => onChange({ ...value, categorySlug: e.target.value || null })}
            disabled={disabled}
            className="w-full bg-white border border-[var(--ink-100)] rounded-lg p-2 text-[var(--ink-900)]"
            data-testid="sop-metadata-category-select"
          >
            <option value="">— None —</option>
            {SORTED_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
