'use client'

/**
 * Phase 25: Department multi-select picker — three modes.
 *
 * Near-verbatim mirror of SubTradePicker.tsx with three deltas (per PATTERNS):
 *  1. `departments` prop passed in (pre-fetched by server component — no internal fetch)
 *  2. `selectedIds` prop passed in (no internal state fetch)
 *  3. Colour swatch per pill (7px×7px, rounded-sm, dept.colour)
 *
 * Mode 'member': toggle calls assignMemberDepartments; no all-departments option.
 *   - Shows inline "Set owner / ★ Owner" affordance per assigned dept (D-03)
 * Mode 'block'|'sop': toggle calls assignBlock/SopDepartments; exposes "All departments"
 *   toggle mutually exclusive with individual IDs (D-04).
 *
 * localOnly (create/wizard mode, A4): when true, toggle updates local state and
 * fires onChange ONLY — NO server action is called. Used in the create-SOP wizard
 * where the SOP doesn't exist yet and sop_departments is written in createSopFromWizard.
 *
 * UI-SPEC: 25-UI-SPEC.md §"Department Picker Popover" + §"Surface 3: Team Management"
 * PATTERNS: 25-PATTERNS.md §DepartmentPicker
 */

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import {
  assignMemberDepartments,
  assignBlockDepartments,
  assignSopDepartments,
  setDepartmentOwner,
} from '@/actions/departments'
import type { Department } from '@/types/sop'

// Discriminated props by mode

type MemberProps = {
  mode: 'member'
  memberId: string
  departments: Department[]
  selectedIds: string[]
  /** When true, no server action is fired on toggle — only onChange (A4) */
  localOnly?: boolean
  onChange?: (ids: string[]) => void
}

type BlockProps = {
  mode: 'block'
  blockId: string
  departments: Department[]
  selectedIds: string[]
  allDepartments?: boolean
  /** When true, no server action is fired on toggle — only onChange (A4) */
  localOnly?: boolean
  onChange?: (ids: string[], all: boolean) => void
}

type SopProps = {
  mode: 'sop'
  sopId: string
  departments: Department[]
  selectedIds: string[]
  allDepartments?: boolean
  /** When true, no server action is fired on toggle — only onChange (A4) */
  localOnly?: boolean
  onChange?: (ids: string[], all: boolean) => void
}

type Props = MemberProps | BlockProps | SopProps

export function DepartmentPicker(props: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(props.selectedIds)
  const [allDepts, setAllDepts] = useState<boolean>(
    props.mode !== 'member' ? (props.allDepartments ?? false) : false
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Track owner per dept (member mode only) — seed from departments with matching owner.
  // In real usage, owner state comes from the dept list; we track local optimistic state.
  const [ownerDeptId, setOwnerDeptId] = useState<string | null>(null)

  function toggle(id: string) {
    const prev = [...selectedIds]
    const prevSet = new Set(prev)
    const nextSet = new Set(prev)
    if (nextSet.has(id)) nextSet.delete(id)
    else nextSet.add(id)
    const next = Array.from(nextSet)

    // If unchecking in member mode and this member was the owner of that dept,
    // clear owner optimistically (D-03: owner removed when member removed from dept).
    if (props.mode === 'member' && !nextSet.has(id) && ownerDeptId === id) {
      setOwnerDeptId(null)
    }

    // Mutually exclusive with allDepts (block/sop modes only).
    if (props.mode !== 'member') {
      setAllDepts(false)
    }
    setSelectedIds(next)

    if (props.localOnly) {
      // localOnly: fire onChange only — no server action (A4, wizard create mode).
      if (props.mode === 'member') {
        props.onChange?.(next)
      } else {
        props.onChange?.(next, false)
      }
      return
    }

    startTransition(async () => {
      setError(null)
      let result: { success: true } | { error: string }

      if (props.mode === 'member') {
        result = await assignMemberDepartments(props.memberId, next)
        if ('error' in result) {
          setError(result.error)
          setSelectedIds(prev)
        } else {
          props.onChange?.(next)
        }
      } else if (props.mode === 'block') {
        result = await assignBlockDepartments(props.blockId, next, false)
        if ('error' in result) {
          setError(result.error)
          setSelectedIds(prev)
        } else {
          props.onChange?.(next, false)
        }
      } else {
        result = await assignSopDepartments(props.sopId, next, false)
        if ('error' in result) {
          setError(result.error)
          setSelectedIds(prev)
        } else {
          props.onChange?.(next, false)
        }
      }
    })
  }

  function toggleAllDepts() {
    if (props.mode === 'member') return // no all-departments in member mode

    const prevAll = allDepts
    const prevIds = [...selectedIds]
    const nextAll = !prevAll

    setAllDepts(nextAll)
    if (nextAll) setSelectedIds([]) // clear individual selections

    if (props.localOnly) {
      props.onChange?.(nextAll ? [] : prevIds, nextAll)
      return
    }

    startTransition(async () => {
      setError(null)
      let result: { success: true } | { error: string }

      if (props.mode === 'block') {
        result = await assignBlockDepartments(props.blockId, [], nextAll)
      } else {
        result = await assignSopDepartments(props.sopId, [], nextAll)
      }

      if ('error' in result) {
        setError(result.error)
        setAllDepts(prevAll)
        if (!nextAll) setSelectedIds(prevIds)
      } else {
        props.onChange?.(nextAll ? [] : prevIds, nextAll)
      }
    })
  }

  function handleSetOwner(deptId: string) {
    if (props.mode !== 'member') return
    const prevOwnerDeptId = ownerDeptId

    setOwnerDeptId(deptId)

    startTransition(async () => {
      const result = await setDepartmentOwner(deptId, props.memberId)
      if ('error' in result) {
        setError(result.error)
        setOwnerDeptId(prevOwnerDeptId)
      }
    })
  }

  const testId =
    props.mode === 'member'
      ? `dept-picker-member-${props.memberId}`
      : props.mode === 'block'
        ? `dept-picker-block-${props.blockId}`
        : `dept-picker-sop-${props.sopId}`

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={testId}
    >
      {/* All departments toggle (block/sop modes only) */}
      {props.mode !== 'member' && (
        <button
          type="button"
          onClick={toggleAllDepts}
          disabled={pending}
          aria-pressed={allDepts}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            allDepts
              ? 'border-[var(--accent-mcu)] text-[var(--accent-mcu)] bg-[var(--paper)]'
              : 'bg-[var(--paper)] text-[var(--ink-700)] border-[var(--ink-200)] hover:border-[var(--ink-500)]'
          } disabled:opacity-60`}
          style={allDepts ? { background: 'rgba(6,182,212,0.06)' } : {}}
        >
          {allDepts && <Check className="h-3 w-3" aria-hidden="true" />}
          ◇ All departments
        </button>
      )}

      {/* Per-department pills */}
      {props.departments.map(dept => {
        const isOn = selectedIds.includes(dept.id)
        const isOwner = props.mode === 'member' && ownerDeptId === dept.id
        return (
          <span key={dept.id} className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggle(dept.id)}
              disabled={pending || allDepts}
              aria-pressed={isOn}
              data-testid={`dept-pill-${dept.id}`}
              className={`pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                isOn
                  ? 'bg-[var(--ink-900)] text-[var(--paper)] border-[var(--ink-900)]'
                  : 'bg-[var(--paper)] text-[var(--ink-700)] border-[var(--ink-200)] hover:border-[var(--ink-500)]'
              } disabled:opacity-60`}
            >
              {/* Colour swatch — key delta from SubTradePicker (PATTERNS §delta 3) */}
              <span
                style={{ background: dept.colour }}
                className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                aria-hidden
              />
              {isOn && <Check className="h-3 w-3" aria-hidden="true" />}
              {dept.name}
            </button>

            {/* Inline owner-set affordance (member mode, assigned depts only, D-03) */}
            {props.mode === 'member' && isOn && (
              <button
                type="button"
                onClick={() => !isOwner && handleSetOwner(dept.id)}
                disabled={pending || isOwner}
                className={`text-[8px] font-bold uppercase tracking-[0.05em] px-1 py-px rounded border transition-colors ${
                  isOwner
                    ? 'cursor-default'
                    : 'cursor-pointer hover:opacity-80'
                }`}
                style={{
                  color: '#a16207',
                  background: 'rgba(251,191,36,0.16)',
                  border: '1px solid var(--accent-signoff)',
                }}
                aria-label={isOwner ? 'Already owner' : `Set as owner of ${dept.name}`}
              >
                {isOwner ? '★ Owner' : 'Set owner'}
              </button>
            )}
          </span>
        )
      })}

      {error && (
        <span className="text-xs text-red-600 ml-2" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
