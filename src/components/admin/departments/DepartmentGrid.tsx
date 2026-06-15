'use client'

/**
 * Phase 25 Plan 04 — DepartmentGrid
 *
 * Client component rendered by /admin/departments/page.tsx.
 * Renders:
 *  - 2-col grid (1-col on mobile < 768px) of DepartmentCards
 *  - Dashed add-card ("＋" / "NEW DEPARTMENT") — opens DepartmentFormModal
 *  - "Show archived" toggle when archived departments exist
 *  - Empty state copy when zero active departments
 *  - DepartmentFormModal wired for create + edit
 *  - Archive confirmation inline
 *
 * Consumes: createDepartment / updateDepartment / archiveDepartment from Plan 03.
 * Receives: departments prop (DepartmentWithCounts[]) pre-fetched by the SSR page.
 * Receives: orgMembers prop for the form modal owner selector.
 */

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { DepartmentCard } from './DepartmentCard'
import { DepartmentFormModal } from './DepartmentFormModal'
import { archiveDepartment } from '@/actions/departments'
import type { Department, DepartmentWithCounts } from '@/types/sop'

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
}

interface DepartmentGridProps {
  departments: DepartmentWithCounts[]
  orgMembers?: OrgMember[]
}

export function DepartmentGrid({ departments, orgMembers = [] }: DepartmentGridProps) {
  const [depts, setDepts] = useState<DepartmentWithCounts[]>(departments)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<DepartmentWithCounts | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const activeDepts = depts.filter((d) => !d.archived)
  const archivedDepts = depts.filter((d) => d.archived)
  const hasArchived = archivedDepts.length > 0

  function openCreateModal() {
    setEditingDept(null)
    setModalOpen(true)
  }

  function openEditModal(dept: DepartmentWithCounts) {
    setEditingDept(dept)
    setModalOpen(true)
  }

  function handleModalSuccess(dept: Department) {
    setDepts((prev) => {
      const idx = prev.findIndex((d) => d.id === dept.id)
      if (idx >= 0) {
        // Edit: replace in-place, preserve counts
        const updated = [...prev]
        updated[idx] = { ...updated[idx], ...dept }
        return updated
      }
      // Create: add with zero counts
      return [
        ...prev,
        {
          ...dept,
          people_count: 0,
          sop_count: 0,
          block_count: 0,
          // Resolved on next SSR load; optimistic create shows no-owner line until refresh.
          owner_name: null,
          owner_role: null,
        },
      ]
    })
    setModalOpen(false)
    setEditingDept(null)
  }

  function handleArchive(deptId: string) {
    const dept = depts.find((d) => d.id === deptId)
    if (!dept) return
    const confirmed = window.confirm(
      `Archive ${dept.name}? This hides the department from active filters but preserves all historical junction records.`,
    )
    if (!confirmed) return

    setArchiveError(null)
    startTransition(async () => {
      const result = await archiveDepartment(deptId)
      if ('error' in result) {
        setArchiveError(result.error)
        return
      }
      setDepts((prev) =>
        prev.map((d) => (d.id === deptId ? { ...d, archived: true } : d)),
      )
    })
  }

  const displayedDepts = showArchived ? depts : activeDepts

  return (
    <>
      {/* Page header row: h1 + New department CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--ink-900)',
            margin: 0,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          Departments
        </h1>
        <button
          type="button"
          onClick={openCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--ink-900)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            minHeight: '44px',
            flexShrink: 0,
          }}
        >
          <Plus size={14} aria-hidden="true" />
          New department
        </button>
      </div>

      {/* Archive error banner */}
      {archiveError && (
        <p
          role="alert"
          style={{
            fontSize: '13px',
            color: 'var(--accent-hazard)',
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid var(--accent-hazard)',
            borderRadius: '6px',
          }}
        >
          {archiveError}
        </p>
      )}

      {/* Empty state — no active departments */}
      {activeDepts.length === 0 && !showArchived && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--ink-500)',
          }}
        >
          <p
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--ink-900)',
              marginBottom: '8px',
            }}
          >
            No departments yet
          </p>
          <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto 24px' }}>
            Create your first department to start organising SOPs, blocks, and team members.
          </p>
          <p style={{ fontSize: '12px', maxWidth: '380px', margin: '0 auto', fontStyle: 'italic' }}>
            Each department has a named owner accountable for its procedures.
          </p>
        </div>
      )}

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '14px',
        }}
        className="dept-grid"
      >
        {displayedDepts.map((dept) => (
          <DepartmentCard
            key={dept.id}
            department={dept}
            owner={
              dept.owner_user_id && dept.owner_name
                ? { name: dept.owner_name, role: dept.owner_role ?? '' }
                : null
            }
            onEdit={openEditModal}
            onArchive={handleArchive}
          />
        ))}

        {/* Add-new dashed card */}
        {!showArchived && (
          <button
            type="button"
            onClick={openCreateModal}
            aria-label="Create new department"
            style={{
              border: '1.5px dashed var(--ink-300)',
              borderRadius: '8px',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--ink-500)',
              background: 'rgba(0,0,0,0.01)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
            }}
            className="add-dept-card"
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--accent-step)'
              el.style.color = 'var(--accent-step)'
              el.style.background = 'rgba(59,130,246,0.03)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--ink-300)'
              el.style.color = 'var(--ink-500)'
              el.style.background = 'rgba(0,0,0,0.01)'
            }}
          >
            <span style={{ fontSize: '26px', lineHeight: 1 }}>＋</span>
            <span
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}
            >
              NEW DEPARTMENT
            </span>
          </button>
        )}
      </div>

      {/* Show archived toggle */}
      {hasArchived && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            style={{
              fontSize: '11px',
              color: 'var(--ink-500)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              minHeight: '44px',
            }}
          >
            {showArchived
              ? `Hide archived (${archivedDepts.length})`
              : `Show archived (${archivedDepts.length})`}
          </button>
        </div>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 767px) {
          .dept-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Create / Edit modal */}
      <DepartmentFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingDept(null)
        }}
        department={editingDept}
        orgMembers={orgMembers}
        onSuccess={handleModalSuccess}
      />
    </>
  )
}
