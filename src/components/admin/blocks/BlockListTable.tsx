'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Archive } from 'lucide-react'
import { archiveBlock } from '@/actions/blocks'
import { DChip } from '@/components/admin/departments/DChip'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
import type { Block } from '@/types/sop'
import type { Department } from '@/types/sop'

interface Props {
  blocks: Array<Block & { currentContent?: unknown; departmentIds?: string[]; allDepartments?: boolean }>
  departments: Department[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Popover wrapper for the DepartmentPicker in block-row mode.
 * Closes on outside click (per UI-SPEC popover behaviour).
 */
function BlockDeptPopover({
  block,
  departments,
  onClose,
}: {
  block: { id: string; departmentIds?: string[]; allDepartments?: boolean }
  departments: Department[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-20 w-[230px] rounded-lg shadow-lg"
      style={{
        background: 'var(--paper)',
        border: '1.5px solid var(--ink-900)',
        borderRadius: '8px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="px-3 pb-2 pt-[10px]"
        style={{
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-500)',
          borderBottom: '1px solid var(--ink-100)',
        }}
      >
        IN DEPARTMENTS
      </div>
      {/* Picker body */}
      <div className="p-3">
        <DepartmentPicker
          mode="block"
          blockId={block.id}
          departments={departments}
          selectedIds={block.departmentIds ?? []}
          allDepartments={block.allDepartments ?? false}
          onChange={() => {
            router.refresh()
          }}
        />
      </div>
      {/* Footer */}
      <div
        className="px-2 py-2 flex justify-end"
        style={{ borderTop: '1px solid var(--ink-100)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-semibold text-white rounded-[5px] px-3 py-[7px] transition-colors hover:opacity-80"
          style={{ background: 'var(--ink-900)', border: 'none' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function BlockListTable({ blocks, departments }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [openPickerId, setOpenPickerId] = useState<string | null>(null)

  const deptMap = new Map(departments.map((d) => [d.id, d]))

  function handleArchive(blockId: string) {
    if (!confirm('Archive this item? It will no longer appear in the picker, but existing SOPs keep their snapshot.')) {
      return
    }
    startTransition(async () => {
      const res = await archiveBlock(blockId)
      if ('error' in res) {
        alert(`Failed to archive: ${res.error}`)
        return
      }
      router.refresh()
    })
  }

  if (blocks.length === 0) {
    return (
      <div className="bg-white border border-[var(--ink-100)] rounded-lg p-8 text-center">
        <p className="text-base font-semibold text-[var(--ink-900)] mb-1">Nothing in your library yet</p>
        <p className="text-sm text-[var(--ink-500)]">
          Save your first item from the builder via the three-dot menu on any hazard, PPE, or step.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--ink-100)]">
      <table className="w-full text-sm bg-white text-[var(--ink-900)]">
        <thead className="bg-[var(--paper)] text-xs uppercase tracking-wider text-[var(--ink-500)]">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Kind</th>
            <th className="px-4 py-3 text-left">Departments</th>
            <th className="px-4 py-3 text-left">Updated</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => {
            const isArchived = b.archived_at !== null
            const selectedDeptIds = b.departmentIds ?? []
            return (
              <tr key={b.id} className="border-t border-[var(--ink-100)] hover:bg-[var(--paper-2)]/50 relative">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/blocks/${b.id}`}
                    className="font-medium text-[var(--ink-900)] hover:text-[var(--ink-700)]"
                  >
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--paper)] border border-[var(--ink-100)] text-[var(--ink-500)]">
                    {b.kind_slug}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {b.allDepartments ? (
                      <DChip variant="all-departments" />
                    ) : selectedDeptIds.length > 0 ? (
                      selectedDeptIds.map((dId) => {
                        const dept = deptMap.get(dId)
                        return dept ? (
                          <DChip key={dId} variant="department" department={dept} />
                        ) : null
                      })
                    ) : (
                      <span className="text-xs text-[var(--ink-500)]">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--ink-500)]">{formatDate(b.updated_at)}</td>
                <td className="px-4 py-3">
                  {isArchived ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-950/40 border border-red-700/40 text-red-300">
                      Archived
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-950/40 border border-green-700/40 text-green-300">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 relative">
                    {/* Departments ▾ picker button (UI-SPEC .abtn.ghost) */}
                    <button
                      type="button"
                      onClick={() => setOpenPickerId(openPickerId === b.id ? null : b.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--ink-500)] border border-transparent hover:text-[var(--ink-900)] hover:border-[var(--ink-300)] transition-colors"
                    >
                      Departments ▾
                    </button>
                    {openPickerId === b.id && (
                      <BlockDeptPopover
                        block={b}
                        departments={departments}
                        onClose={() => setOpenPickerId(null)}
                      />
                    )}
                    {!isArchived && (
                      <button
                        type="button"
                        onClick={() => handleArchive(b.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--ink-500)] hover:text-red-300 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                        aria-label={`Archive ${b.name}`}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
