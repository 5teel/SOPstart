'use client'

/**
 * Phase 32-07 — Columns alt view (D-08 alternative to the Node Chart).
 * Horizontal overflow-x flex board: one `flex: 0 0 250px` column per
 * department, roles as cards, people (named + vacancy) as chips. Reuses
 * OrgChartCanvas's `.node`/`.person-chip`/`.pill`/`.org-add-ghost` CSS
 * verbatim (share, don't fork — org-model-views.md § Column Builder).
 *
 * Absorbs the Phase 15/25 member roster (RoleAssignmentTable — invite,
 * org-privilege role, department picker) as a collapsible sub-panel so
 * that role-edit capability stays reachable, not deleted (plan Task 1).
 */

import { useCallback, useEffect, useState } from 'react'
import { NODE_HEIGHT } from '@/lib/org-model/auto-layout'
import { createRole, assignRoleMembers } from '@/actions/org-model'
import { createDepartment } from '@/actions/departments'
import { getTeamMembersWithEmails, type TeamMember } from '@/actions/auth'
import RoleAssignmentTable from '@/components/admin/RoleAssignmentTable'
import type { OrgTree, OrgTreeDepartment, OrgTreeRole } from '@/types/org-model'
import type { Department } from '@/types/sop'

interface OrgColumnsBoardProps {
  tree: OrgTree
  orgId: string
  inviteCode: string
  departments: Department[]
  /** Called after any add/assign mutation succeeds — caller decides how to refetch. */
  onChange?: () => void
}

const NEW_DEPT_COLOUR = '#f97316'

function allDepartments(tree: OrgTree): OrgTreeDepartment[] {
  return [...tree.areas.flatMap((a) => a.departments), ...tree.ungroupedDepartments]
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

export function OrgColumnsBoard({ tree, orgId, inviteCode, departments, onChange }: OrgColumnsBoardProps) {
  const [members, setMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    getTeamMembersWithEmails().then((result) => {
      if ('members' in result && result.members) setMembers(result.members)
    })
  }, [])

  const depts = allDepartments(tree)

  const handleAddRole = useCallback(async (departmentId: string) => {
    const name = window.prompt('New role name')
    if (!name?.trim()) return
    const result = await createRole({ departmentId, name: name.trim(), budgetedCount: 1 })
    if ('error' in result) { console.error('[OrgColumnsBoard] createRole failed', result.error); return }
    onChange?.()
  }, [onChange])

  const handleAddDepartment = useCallback(async () => {
    const name = window.prompt('New department name')
    if (!name?.trim()) return
    const code = (name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'DEPT')
    const result = await createDepartment({ name: name.trim(), code, colour: NEW_DEPT_COLOUR })
    if ('error' in result) { console.error('[OrgColumnsBoard] createDepartment failed', result.error); return }
    onChange?.()
  }, [onChange])

  const handleAddPerson = useCallback(async (role: OrgTreeRole) => {
    const email = window.prompt('Member email to add to this role')
    if (!email?.trim()) return
    const match = members.find((m) => m.email?.toLowerCase() === email.trim().toLowerCase())
    if (!match) { window.alert('No team member found with that email'); return }
    const currentIds = role.people.filter((p) => !p.isVacancy && p.id).map((p) => p.id as string)
    if (currentIds.includes(match.user_id)) return
    const result = await assignRoleMembers(role.id, [...currentIds, match.user_id])
    if ('error' in result) { console.error('[OrgColumnsBoard] assignRoleMembers failed', result.error); return }
    onChange?.()
  }, [members, onChange])

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto flex gap-4 pb-2 scroll-thin" style={{ minHeight: 360 }}>
        {depts.map((dept) => (
          <div key={dept.id} className="flex flex-col gap-2" style={{ flex: '0 0 250px' }}>
            <div className="node" style={{ position: 'static' }}>
              <div className="kicker mono">DEPARTMENT</div>
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-900)]">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: dept.colour }} />
                {dept.name}
              </div>
            </div>

            {dept.roles.map((role) => (
              <div key={role.id} className="node" style={{ position: 'static' }}>
                <div className="flex items-center justify-between">
                  <div className="kicker mono">ROLE</div>
                  <span className="pill">{role.filledCount}/{role.budgetedCount}</span>
                </div>
                <div className="text-[13px] font-medium text-[var(--ink-900)] mb-1.5">{role.name}</div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {role.people.map((person, i) => (
                    <span key={person.id ?? `vacant-${i}`} className={`person-chip${person.isVacancy ? ' vacant' : ''}`}>
                      <span className="avatar">{person.isVacancy ? '+' : initials(person.name)}</span>
                      {person.isVacancy ? 'Vacant' : person.name}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddPerson(role)}
                  className="org-add-ghost mono w-full"
                  style={{ minHeight: 28 }}
                >
                  + person
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => void handleAddRole(dept.id)}
              className="org-add-ghost mono w-full"
              style={{ minHeight: NODE_HEIGHT }}
            >
              + Add role
            </button>
          </div>
        ))}

        <div className="flex flex-col" style={{ flex: '0 0 250px' }}>
          <button
            type="button"
            onClick={() => void handleAddDepartment()}
            className="org-add-ghost mono w-full"
            style={{ minHeight: NODE_HEIGHT }}
          >
            + ADD DEPARTMENT
          </button>
        </div>
      </div>

      {/* Old member roster absorbed here — org-privilege role / invite / department-picker
          editing stays reachable via this sub-panel, never deleted (plan Task 1). */}
      <details className="rounded-xl bg-white border border-[var(--ink-100)]">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-[var(--ink-900)]">
          Manage members, invites &amp; org roles
        </summary>
        <div className="px-4 pb-4">
          <RoleAssignmentTable orgId={orgId} inviteCode={inviteCode} departments={departments} />
        </div>
      </details>
    </div>
  )
}
