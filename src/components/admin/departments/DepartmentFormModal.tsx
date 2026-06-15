'use client'

/**
 * Phase 25 Plan 04 — DepartmentFormModal
 *
 * Create / edit modal for a department. Fields per UI-SPEC §"Create / Edit Department":
 *  - Name (text, required)
 *  - Code (≤6 chars, auto-uppercased, required)
 *  - Colour (fixed 8-swatch radio picker — the UI-SPEC palette only, no free input, V5/T-25-08)
 *  - Icon (optional emoji/char, rendered in the .cdot)
 *  - Owner (searchable org-member selector, optional at creation)
 *
 * Wires createDepartment / updateDepartment / setDepartmentOwner from Plan 03.
 * Duplicate-code error copy from UI-SPEC copywriting section.
 * Modal pattern mirrors VideoFormatSelectionModal (existing admin modal).
 */

import { useState, useTransition } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createDepartment, updateDepartment, setDepartmentOwner } from '@/actions/departments'
import type { Department, DepartmentWithCounts } from '@/types/sop'

// The 8 allowed department colours from UI-SPEC colour table (V5 — no free-form input).
const DEPT_COLOURS = [
  { hex: '#f97316', label: 'Orange' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#10b981', label: 'Green' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#fbbf24', label: 'Amber' },
  { hex: '#8b5cf6', label: 'Violet' },
] as const

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
}

interface DepartmentFormModalProps {
  open: boolean
  onClose: () => void
  /** When set, form is in edit mode; otherwise create mode */
  department?: DepartmentWithCounts | null
  /** Org member list for the owner selector (pre-fetched by parent) */
  orgMembers?: OrgMember[]
  onSuccess: (dept: Department) => void
}

export function DepartmentFormModal({
  open,
  onClose,
  department,
  orgMembers = [],
  onSuccess,
}: DepartmentFormModalProps) {
  const isEdit = !!department
  const [name, setName] = useState(department?.name ?? '')
  const [code, setCode] = useState(department?.code ?? '')
  const [colour, setColour] = useState<string>(department?.colour ?? '#3b82f6')
  const [icon, setIcon] = useState(department?.icon ?? '')
  const [ownerMemberId, setOwnerMemberId] = useState<string>(
    department?.owner_user_id ?? '',
  )
  const [ownerSearch, setOwnerSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  function handleClose() {
    setError(null)
    onClose()
  }

  function handleCodeChange(val: string) {
    setCode(val.toUpperCase().slice(0, 6))
  }

  const filteredMembers = orgMembers.filter((m) => {
    const q = ownerSearch.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    )
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!code.trim()) {
      setError('Code is required.')
      return
    }
    if (!colour) {
      setError('Please select a colour.')
      return
    }

    startTransition(async () => {
      let result: { department: Department } | { error: string }

      if (isEdit && department) {
        result = await updateDepartment({
          id: department.id,
          name: name.trim(),
          code: code.trim(),
          colour: colour as typeof DEPT_COLOURS[number]['hex'],
          icon: icon.trim() || null,
          ownerUserId: ownerMemberId || null,
        })
      } else {
        result = await createDepartment({
          name: name.trim(),
          code: code.trim(),
          colour: colour as typeof DEPT_COLOURS[number]['hex'],
          icon: icon.trim() || undefined,
          ownerUserId: ownerMemberId || null,
        })
      }

      if ('error' in result) {
        // Map duplicate code server error to UI-SPEC copy
        if (result.error.toLowerCase().includes('unique') || result.error.toLowerCase().includes('conflict') || result.error.toLowerCase().includes('duplicate')) {
          setError('That code is already in use. Choose a unique code for this department.')
        } else {
          setError(result.error)
        }
        return
      }

      // If owner changed separately after create (setDepartmentOwner needs dept id)
      // createDepartment already sets owner_user_id via the insert, so no extra call needed.
      onSuccess(result.department)
      handleClose()
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dept-form-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        style={{
          background: 'var(--paper)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '480px',
          width: '100%',
          margin: '0 16px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2
            id="dept-form-modal-title"
            style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}
          >
            {isEdit ? 'Edit department' : 'New department'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-500)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              minHeight: '44px',
              minWidth: '44px',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="dept-name"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '6px' }}
            >
              Name <span style={{ color: 'var(--accent-hazard)' }}>*</span>
            </label>
            <input
              id="dept-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Forming"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                border: '1px solid var(--ink-300)',
                borderRadius: '6px',
                background: 'var(--paper)',
                color: 'var(--ink-900)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Code */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="dept-code"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '6px' }}
            >
              Code <span style={{ color: 'var(--accent-hazard)' }}>*</span>
              <span style={{ fontWeight: 400, color: 'var(--ink-500)', marginLeft: '6px', fontSize: '11px' }}>
                (max 6 chars, auto-uppercased)
              </span>
            </label>
            <input
              id="dept-code"
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="e.g. FRM"
              maxLength={6}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                fontFamily: 'var(--font-mono, monospace)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                border: '1px solid var(--ink-300)',
                borderRadius: '6px',
                background: 'var(--paper)',
                color: 'var(--ink-900)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Colour — fixed 8-swatch radio picker (V5, T-25-08) */}
          <div style={{ marginBottom: '16px' }}>
            <p
              style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '8px' }}
            >
              Colour <span style={{ color: 'var(--accent-hazard)' }}>*</span>
            </p>
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="sr-only">Department colour</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {DEPT_COLOURS.map((c) => {
                  const isSelected = colour === c.hex
                  return (
                    <label
                      key={c.hex}
                      title={c.label}
                      style={{
                        position: 'relative',
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: c.hex,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isSelected ? '2.5px solid var(--ink-900)' : '2px solid transparent',
                        boxSizing: 'border-box',
                        outline: isSelected ? '1px solid var(--ink-900)' : 'none',
                        outlineOffset: '2px',
                      }}
                    >
                      <input
                        type="radio"
                        name="dept-colour"
                        value={c.hex}
                        checked={isSelected}
                        onChange={() => setColour(c.hex)}
                        className="sr-only"
                      />
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          style={{
                            color: '#fff',
                            fontSize: '14px',
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </div>

          {/* Icon (optional) */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="dept-icon"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '6px' }}
            >
              Icon
              <span style={{ fontWeight: 400, color: 'var(--ink-500)', marginLeft: '6px', fontSize: '11px' }}>
                (optional — emoji or single char)
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                id="dept-icon"
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                placeholder="e.g. 🔥"
                maxLength={4}
                style={{
                  width: '80px',
                  padding: '10px 12px',
                  fontSize: '18px',
                  textAlign: 'center',
                  border: '1px solid var(--ink-300)',
                  borderRadius: '6px',
                  background: 'var(--paper)',
                  color: 'var(--ink-900)',
                  outline: 'none',
                }}
              />
              {/* Preview cdot */}
              <div
                aria-hidden="true"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: colour,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                {icon || name.slice(0, 1).toUpperCase() || '?'}
              </div>
            </div>
          </div>

          {/* Owner (optional) — searchable member selector */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="dept-owner-search"
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '6px' }}
            >
              Owner
              <span style={{ fontWeight: 400, color: 'var(--ink-500)', marginLeft: '6px', fontSize: '11px' }}>
                (optional — accountability label, no extra permissions)
              </span>
            </label>
            {orgMembers.length > 0 ? (
              <>
                <input
                  id="dept-owner-search"
                  type="text"
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  placeholder="Search members…"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1px solid var(--ink-300)',
                    borderRadius: '6px 6px 0 0',
                    background: 'var(--paper)',
                    color: 'var(--ink-900)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    borderBottom: 'none',
                  }}
                />
                <div
                  style={{
                    border: '1px solid var(--ink-300)',
                    borderRadius: '0 0 6px 6px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    background: 'var(--paper)',
                  }}
                >
                  {/* Clear option */}
                  <button
                    type="button"
                    onClick={() => setOwnerMemberId('')}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 12px',
                      fontSize: '12px',
                      color: ownerMemberId === '' ? 'var(--ink-900)' : 'var(--ink-500)',
                      background: ownerMemberId === '' ? 'var(--paper-2)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontStyle: 'italic',
                    }}
                  >
                    No owner
                  </button>
                  {filteredMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setOwnerMemberId(m.id)
                        setOwnerSearch(m.name)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 12px',
                        fontSize: '12px',
                        color: 'var(--ink-900)',
                        background: ownerMemberId === m.id ? 'var(--paper-2)' : 'none',
                        border: 'none',
                        borderTop: '1px solid var(--ink-100)',
                        cursor: 'pointer',
                      }}
                      className="hover:bg-[var(--paper-2)]"
                    >
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                      <span style={{ color: 'var(--ink-500)', marginLeft: '6px' }}>· {m.role}</span>
                    </button>
                  ))}
                  {filteredMembers.length === 0 && ownerSearch && (
                    <p style={{ padding: '9px 12px', fontSize: '12px', color: 'var(--ink-500)', fontStyle: 'italic', margin: 0 }}>
                      No members match
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--ink-500)', fontStyle: 'italic', margin: 0 }}>
                No org members available.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p
              role="alert"
              style={{ fontSize: '12px', color: 'var(--accent-hazard)', marginBottom: '12px', margin: '0 0 12px' }}
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--ink-700)',
                background: 'var(--paper-2)',
                border: '1px solid var(--ink-300)',
                borderRadius: '6px',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                background: isPending ? 'var(--ink-500)' : 'var(--ink-900)',
                border: 'none',
                borderRadius: '6px',
                cursor: isPending ? 'not-allowed' : 'pointer',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Create department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
