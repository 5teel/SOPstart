'use client'

/**
 * Phase 25 Plan 04 — DepartmentCard
 *
 * Renders a single department card per UI-SPEC §"Surface 1: /admin/departments Page"
 * §"Department Card Anatomy":
 *  - 6px left colour stripe (department.colour)
 *  - .cdot: 26×26px colour dot with icon/letter
 *  - Name (h3, 15px/700) + code line ("CODE · department", 10px uppercase)
 *  - ⋯ overflow button (edit / archive)
 *  - Owner block: filled (avatar initials + "OWNER" label + name·role)
 *                 OR .owner.empty warning (red dashed, "No owner assigned — set one")
 *  - Stats row: 3 equal cells People / SOPs / Blocks
 *  - Archived: opacity 0.5, greyed stripe, "ARCHIVED" label instead of ⋯
 *
 * The "No owner assigned" state is a deliberate feature (D-03, REQ-5),
 * surfacing the Visy governance gap — not an error to suppress.
 */

import type { DepartmentWithCounts } from '@/types/sop'

interface OwnerInfo {
  name: string
  role: string
}

interface DepartmentCardProps {
  department: DepartmentWithCounts
  owner?: OwnerInfo | null
  onEdit?: (dept: DepartmentWithCounts) => void
  onArchive?: (deptId: string) => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DepartmentCard({ department, owner, onEdit, onArchive }: DepartmentCardProps) {
  const isArchived = department.archived
  const stripeColour = isArchived ? 'var(--ink-300)' : department.colour

  return (
    <div
      style={{
        border: '1.5px solid var(--ink-300)',
        borderRadius: '8px',
        background: 'var(--paper)',
        display: 'flex',
        overflow: 'hidden',
        opacity: isArchived ? 0.5 : 1,
      }}
    >
      {/* Left colour stripe */}
      <div
        aria-hidden="true"
        style={{
          width: '6px',
          flex: '0 0 6px',
          background: stripeColour,
        }}
      />

      {/* Card inner */}
      <div style={{ padding: '18px 18px 16px', flex: 1, minWidth: 0 }}>
        {/* Top row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          {/* Left: cdot + name block */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
            {/* Colour dot */}
            <div
              aria-hidden="true"
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: department.colour,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '13px',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {department.icon ?? department.name.slice(0, 1).toUpperCase()}
            </div>

            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--ink-900)',
                  margin: 0,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {department.name}
              </h3>
              <p
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-500)',
                  marginTop: '2px',
                  margin: '2px 0 0',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {department.code} · department
              </p>
            </div>
          </div>

          {/* Right: overflow menu or ARCHIVED label */}
          {isArchived ? (
            <span
              style={{
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--ink-500)',
                fontWeight: 600,
                flexShrink: 0,
                paddingTop: '4px',
              }}
            >
              ARCHIVED
            </span>
          ) : (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                aria-label={`Options for ${department.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  // Simple inline dropdown: show edit/archive options
                  const menu = document.getElementById(`dept-menu-${department.id}`)
                  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none'
                }}
                style={{
                  color: 'var(--ink-500)',
                  fontSize: '16px',
                  background: 'none',
                  border: 'none',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⋯
              </button>
              <div
                id={`dept-menu-${department.id}`}
                style={{
                  display: 'none',
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: 'var(--paper)',
                  border: '1px solid var(--ink-300)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  zIndex: 20,
                  minWidth: '120px',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const menu = document.getElementById(`dept-menu-${department.id}`)
                    if (menu) menu.style.display = 'none'
                    onEdit?.(department)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--ink-900)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-[var(--paper-2)]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const menu = document.getElementById(`dept-menu-${department.id}`)
                    if (menu) menu.style.display = 'none'
                    onArchive?.(department.id)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--accent-hazard)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-[var(--paper-2)]"
                >
                  Archive
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Owner block */}
        <div
          style={{
            marginTop: '14px',
            padding: '9px 10px',
            background: 'var(--paper-2)',
            border: department.owner_user_id
              ? '1px solid var(--ink-100)'
              : '1px dashed var(--accent-hazard)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
          }}
        >
          {department.owner_user_id && owner ? (
            <>
              {/* Filled state: avatar initials */}
              <div
                aria-hidden="true"
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--ink-900)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {getInitials(owner.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ink-500)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  OWNER
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--ink-900)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}
                >
                  {owner.name} · {owner.role}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* No-owner warning state (D-03, REQ-5) — this is a feature, not an error */}
              <div
                aria-hidden="true"
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(239,68,68,0.10)',
                  color: 'var(--accent-hazard)',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                !
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--ink-500)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  OWNER
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--accent-hazard)',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  No owner assigned — set one
                </p>
              </div>
            </>
          )}
        </div>

        {/* Stats row: People / SOPs / Blocks */}
        <div
          style={{
            display: 'flex',
            marginTop: '14px',
            border: '1px solid var(--ink-100)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {[
            { label: 'PEOPLE', value: department.people_count },
            { label: 'SOPS', value: department.sop_count },
            { label: 'BLOCKS', value: department.block_count },
          ].map((stat, i, arr) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '10px 6px',
                borderRight: i < arr.length - 1 ? '1px solid var(--ink-100)' : 'none',
              }}
            >
              <p
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: 'var(--ink-900)',
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </p>
              <p
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ink-500)',
                  marginTop: '2px',
                  margin: '2px 0 0',
                }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
