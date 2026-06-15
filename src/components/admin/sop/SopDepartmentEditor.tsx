'use client'

/**
 * Phase 25 follow-up — inline department editor for an EXISTING SOP.
 *
 * Closes the D-01 gap surfaced in UAT: the migration assigned every existing SOP
 * to "General", but department tagging was only wired on the create-SOP wizard.
 * This collapsible row (on /admin/sops) reuses DepartmentPicker (mode='sop') so an
 * admin can re-tag any SOP; toggles fire assignSopDepartments directly (not localOnly).
 */

import { useState } from 'react'
import { Tags } from 'lucide-react'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import type { Department } from '@/types/sop'

export function SopDepartmentEditor({
  sopId,
  departments,
  selectedIds,
  allDepartments,
}: {
  sopId: string
  departments: Department[]
  selectedIds: string[]
  allDepartments: boolean
}) {
  const [open, setOpen] = useState(false)
  const [ids, setIds] = useState<string[]>(selectedIds)
  const [all, setAll] = useState<boolean>(allDepartments)

  const summary = all
    ? 'All departments'
    : ids.length === 0
      ? 'No departments'
      : departments
          .filter((d) => ids.includes(d.id))
          .map((d) => d.name)
          .join(', ')

  return (
    <div className="px-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors"
        aria-expanded={open}
      >
        <Tags className="h-3.5 w-3.5" />
        <span className="mono uppercase tracking-wider">Departments</span>
        <span className="text-[var(--ink-700)] normal-case">· {summary}</span>
      </button>

      {open && (
        <div className="mt-2 pb-1">
          <DepartmentPicker
            mode="sop"
            sopId={sopId}
            departments={departments}
            selectedIds={ids}
            allDepartments={all}
            onChange={(nextIds, nextAll) => {
              setIds(nextIds)
              setAll(nextAll)
            }}
          />
        </div>
      )}
    </div>
  )
}
