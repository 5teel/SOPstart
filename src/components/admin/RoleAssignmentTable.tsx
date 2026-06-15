'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, UserMinus, Shield, AlertTriangle } from 'lucide-react'
import {
  updateMemberRoleSafe,
  inviteWorker,
  addMemberByEmail,
  regenerateInviteCode,
  removeMember,
  getTeamMembersWithEmails,
  type TeamMember,
} from '@/actions/auth'
import type { AppRole } from '@/types/auth'
import type { Department } from '@/types/sop'
import { DChip } from '@/components/admin/departments/DChip'
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'

const ROLE_LABELS: Record<AppRole, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  admin: 'Admin',
  safety_manager: 'Safety Manager',
}

const ALL_ROLES: AppRole[] = ['worker', 'supervisor', 'admin', 'safety_manager']

export default function RoleAssignmentTable({
  orgId,
  inviteCode: initialCode,
  departments,
}: {
  orgId: string
  inviteCode: string
  departments: Department[]
}) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Add existing member state
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<AppRole>('worker')
  const [addLoading, setAddLoading] = useState(false)
  const [addFeedback, setAddFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Invite code state
  const [inviteCode, setInviteCode] = useState(initialCode)
  const [codeCopied, setCodeCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Confirm actions
  const [confirmAction, setConfirmAction] = useState<{ type: 'role' | 'remove'; memberId: string; newRole?: string } | null>(null)

  // Department filter bar state — null = All
  const [activeDeptFilter, setActiveDeptFilter] = useState<string | null>(null)

  // Open picker per member
  const [openPickerMemberId, setOpenPickerMemberId] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    const result = await getTeamMembersWithEmails()
    if ('members' in result && result.members) {
      setMembers(result.members)
      setCurrentUserId(result.currentUserId ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const executeRoleChange = async (memberId: string, role: string) => {
    setConfirmAction(null)
    setFeedback(null)
    const result = await updateMemberRoleSafe({ memberId, role })
    if (result?.error) {
      setFeedback({ id: memberId, message: result.error, type: 'error' })
    } else {
      setFeedback({ id: memberId, message: 'Role updated', type: 'success' })
      setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, role: role as AppRole } : m)))
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  const executeRemove = async (memberId: string) => {
    setConfirmAction(null)
    setFeedback(null)
    const result = await removeMember(memberId)
    if ('error' in result && result.error) {
      setFeedback({ id: memberId, message: result.error, type: 'error' })
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId))
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteFeedback(null)
    const result = await inviteWorker({ email: inviteEmail.trim() })
    if (result?.error) {
      setInviteFeedback({ message: result.error, type: 'error' })
    } else {
      setInviteFeedback({ message: result?.success ?? 'Invite sent!', type: 'success' })
      setInviteEmail('')
    }
    setInviteLoading(false)
  }

  const handleAddMember = async () => {
    if (!addEmail.trim()) return
    setAddLoading(true)
    setAddFeedback(null)
    const result = await addMemberByEmail(addEmail.trim(), addRole)
    if ('error' in result && result.error) {
      setAddFeedback({ message: result.error, type: 'error' })
    } else {
      setAddFeedback({ message: 'Member added!', type: 'success' })
      setAddEmail('')
      fetchMembers()
    }
    setAddLoading(false)
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const handleRegenerateCode = async () => {
    setRegenerating(true)
    const result = await regenerateInviteCode()
    if ('code' in result && result.code) {
      setInviteCode(result.code)
    }
    setRegenerating(false)
  }

  // Build dept map for chips
  const deptMap = new Map(departments.map(d => [d.id, d]))

  // Filtered members for display
  const visibleMembers = activeDeptFilter
    ? members.filter(m => (m.department_ids ?? []).includes(activeDeptFilter))
    : members

  // Count members per department
  const deptMemberCount: Record<string, number> = {}
  for (const d of departments) {
    deptMemberCount[d.id] = members.filter(m => (m.department_ids ?? []).includes(d.id)).length
  }

  if (loading) {
    return <div className="text-[var(--ink-500)] py-8 text-center">Loading team members...</div>
  }

  return (
    <div className="space-y-6">
      {/* Org invite code */}
      <div className="rounded-xl bg-white border border-[var(--ink-100)] p-4">
        <p className="text-sm text-[var(--ink-500)] mb-2 font-medium">Organisation Invite Code</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-lg font-bold text-[var(--ink-900)] tracking-widest">
            {inviteCode}
          </span>
          <button
            onClick={handleCopyCode}
            className="h-9 px-3 text-sm rounded-lg bg-[var(--paper-2)] hover:bg-[var(--paper-2)] text-[var(--ink-900)] transition-colors"
          >
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleRegenerateCode}
            disabled={regenerating}
            className="h-9 px-3 text-sm rounded-lg bg-[var(--paper-2)] hover:bg-[var(--paper-2)] text-[var(--accent-voice)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Generate new code — old code will stop working"
          >
            <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating...' : 'New code'}
          </button>
        </div>
        <p className="text-xs text-[var(--ink-500)] mt-2">
          Share this code with workers. Regenerating creates a new code and the old one stops working.
        </p>
      </div>

      {/* Invite by email */}
      <div className="rounded-xl bg-white border border-[var(--ink-100)] p-4">
        <p className="text-sm text-[var(--ink-500)] mb-2 font-medium">Invite by Email</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="worker@company.co.nz"
            className="flex-1 px-4 py-3 rounded-lg bg-[var(--paper)] border border-[var(--ink-100)] text-[var(--ink-900)] placeholder-[var(--ink-500)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] text-sm"
          />
          <button
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
            className="h-[44px] px-4 bg-[var(--ink-900)] hover:bg-[var(--accent-voice)] disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            {inviteLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        {inviteFeedback && (
          <p className={`mt-2 text-sm ${inviteFeedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {inviteFeedback.message}
          </p>
        )}
      </div>

      {/* Add existing member with role */}
      <div className="rounded-xl bg-white border border-[var(--ink-100)] p-4">
        <p className="text-sm text-[var(--ink-500)] mb-2 font-medium">Add Existing Member to Role</p>
        <p className="text-xs text-[var(--ink-300)] mb-3">Add someone who already has a SOPstart account to your organisation with a specific role.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={addEmail}
            onChange={e => setAddEmail(e.target.value)}
            placeholder="user@example.co.nz"
            className="flex-1 min-w-[180px] px-4 py-3 rounded-lg bg-[var(--paper)] border border-[var(--ink-100)] text-[var(--ink-900)] placeholder-[var(--ink-500)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] text-sm"
          />
          <select
            value={addRole}
            onChange={e => setAddRole(e.target.value as AppRole)}
            className="px-3 py-3 rounded-lg bg-[var(--paper)] border border-[var(--ink-100)] text-[var(--ink-900)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] cursor-pointer"
          >
            {ALL_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            onClick={handleAddMember}
            disabled={addLoading || !addEmail.trim()}
            className="h-[44px] px-4 bg-[var(--ink-900)] hover:bg-[var(--accent-voice)] disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            {addLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
        {addFeedback && (
          <p className={`mt-2 text-sm ${addFeedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {addFeedback.message}
          </p>
        )}
      </div>

      {/* Confirmation bar */}
      {confirmAction && (
        <div className="rounded-xl bg-[var(--accent-voice)]/10 border border-[var(--accent-voice)]/30 p-4 flex items-center gap-3 flex-wrap">
          <AlertTriangle size={18} className="text-[var(--accent-voice)] flex-shrink-0" />
          <span className="text-sm text-[var(--ink-900)] flex-1">
            {confirmAction.type === 'remove'
              ? `Remove ${members.find(m => m.id === confirmAction.memberId)?.email ?? 'this member'} from the organisation?`
              : `Change role to ${ROLE_LABELS[confirmAction.newRole as AppRole]}?`}
          </span>
          <button
            onClick={() => {
              if (confirmAction.type === 'remove') executeRemove(confirmAction.memberId)
              else if (confirmAction.newRole) executeRoleChange(confirmAction.memberId, confirmAction.newRole)
            }}
            className="h-9 px-3 bg-[var(--accent-voice)] text-white font-semibold text-xs rounded-lg"
          >
            Yes
          </button>
          <button
            onClick={() => {
              setConfirmAction(null)
              fetchMembers()
            }}
            className="h-9 px-3 bg-[var(--paper-2)] text-[var(--ink-900)] text-xs rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Members list with department filter + column */}
      <div className="rounded-xl bg-white border border-[var(--ink-100)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--ink-100)]">
          <h3 className="font-semibold text-[var(--ink-900)]">Team Members ({members.length})</h3>
          <p className="text-xs text-[var(--ink-500)] mt-1">
            Invite people, set their role, and place them in one or more departments. A person&apos;s departments decide which SOPs they see; a department owner is accountable for that department&apos;s procedures.
          </p>
        </div>

        {/* Department filter bar */}
        {departments.length > 0 && (
          <div className="px-4 py-3 border-b border-[var(--ink-100)] flex items-center gap-2 flex-wrap">
            <span
              className="text-[9px] uppercase tracking-[0.10em] flex-shrink-0"
              style={{ color: 'var(--ink-500)', marginRight: '4px' }}
            >
              Department
            </span>
            {/* All button */}
            <button
              type="button"
              onClick={() => setActiveDeptFilter(null)}
              className="inline-flex items-center gap-2 rounded-md text-xs font-medium transition-colors"
              style={{
                padding: '8px 13px',
                minHeight: '44px',
                border: '1.5px solid',
                borderColor: activeDeptFilter === null ? 'var(--ink-900)' : 'var(--ink-300)',
                background: activeDeptFilter === null ? 'var(--ink-900)' : 'var(--paper)',
                color: activeDeptFilter === null ? '#fff' : 'var(--ink-500)',
              }}
            >
              All
              <span
                className="text-[10px] font-bold rounded-full px-[7px] py-px"
                style={{
                  background: activeDeptFilter === null ? 'var(--steel-700, #3f3f46)' : 'var(--paper-2)',
                  color: activeDeptFilter === null ? '#fff' : 'var(--ink-700)',
                }}
              >
                {members.length}
              </span>
            </button>
            {/* Per-department buttons */}
            {departments.map(dept => (
              <button
                key={dept.id}
                type="button"
                onClick={() => setActiveDeptFilter(activeDeptFilter === dept.id ? null : dept.id)}
                className="inline-flex items-center gap-2 rounded-md text-xs font-medium transition-colors"
                style={{
                  padding: '8px 13px',
                  minHeight: '44px',
                  border: '1.5px solid',
                  borderColor: activeDeptFilter === dept.id ? 'var(--ink-900)' : 'var(--ink-300)',
                  background: activeDeptFilter === dept.id ? 'var(--ink-900)' : 'var(--paper)',
                  color: activeDeptFilter === dept.id ? '#fff' : 'var(--ink-500)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: dept.colour,
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                {dept.name}
                <span
                  className="text-[10px] font-bold rounded-full px-[7px] py-px"
                  style={{
                    background: activeDeptFilter === dept.id ? 'var(--steel-700, #3f3f46)' : 'var(--paper-2)',
                    color: activeDeptFilter === dept.id ? '#fff' : 'var(--ink-700)',
                  }}
                >
                  {deptMemberCount[dept.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Context line */}
        {departments.length > 0 && (
          <div className="px-4 py-2 border-b border-[var(--ink-100)]">
            <p className="text-[11px]" style={{ color: 'var(--ink-500)', lineHeight: 1.5 }}>
              {activeDeptFilter
                ? `People assigned to ${deptMap.get(activeDeptFilter)?.name ?? ''}.`
                : 'Everyone in the organisation. A member in several departments appears under each.'}
            </p>
          </div>
        )}

        {/* Column headers */}
        <div
          className="hidden md:flex items-center px-4 py-2 border-b border-[var(--ink-100)] gap-3"
          style={{ minHeight: '36px' }}
        >
          <div className="flex-1 text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--ink-500)' }}>
            Member
          </div>
          <div
            className="text-[9px] uppercase tracking-[0.08em]"
            style={{ width: 130, flexShrink: 0, color: 'var(--ink-500)' }}
          >
            Role
          </div>
          <div
            className="text-[9px] uppercase tracking-[0.08em]"
            style={{ width: 230, flexShrink: 0, color: 'var(--ink-500)' }}
          >
            Departments
          </div>
          <div style={{ width: 36, flexShrink: 0 }} />
        </div>

        {visibleMembers.length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--ink-500)]">
            {activeDeptFilter
              ? `No members assigned to ${deptMap.get(activeDeptFilter)?.name ?? 'this department'}.`
              : 'No team members yet. Invite workers above to get started.'}
          </div>
        ) : (
          <div className="divide-y divide-[var(--ink-100)]">
            {visibleMembers.map(member => {
              const isCurrentUser = member.user_id === currentUserId
              const memberDeptIds = member.department_ids ?? []

              // Departments this member owns — tracked via departments list.
              // owner_user_id is on the Department type (set by setDepartmentOwner).
              const ownedDepts = departments.filter(d => d.owner_user_id === member.user_id)

              return (
                <div
                  key={member.id}
                  className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 min-h-[60px]"
                >
                  {/* Identity + owner badge(s) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--ink-900)] truncate">
                        {member.email ?? member.user_id.slice(0, 8) + '...'}
                      </p>
                      {isCurrentUser && (
                        <span className="text-[10px] text-[var(--ink-900)] font-semibold bg-[var(--ink-900)]/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          You
                        </span>
                      )}
                      {/* ★ Owns {DeptName} badge per owned department (REQ-5, D-03) */}
                      {ownedDepts.map(d => (
                        <span
                          key={d.id}
                          className="text-[8px] font-bold uppercase tracking-[0.05em] inline-flex items-center gap-0.5 px-1 py-px rounded border flex-shrink-0"
                          style={{
                            color: '#a16207',
                            background: 'rgba(251,191,36,0.16)',
                            border: '1px solid var(--accent-signoff)',
                            borderRadius: '3px',
                          }}
                        >
                          ★ Owns {d.name}
                        </span>
                      ))}
                    </div>
                    {feedback?.id === member.id && (
                      <p className={`text-xs mt-0.5 ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.message}
                      </p>
                    )}
                  </div>

                  {/* Role selector */}
                  <select
                    value={member.role}
                    onChange={e => {
                      const newRole = e.target.value
                      setConfirmAction({ type: 'role', memberId: member.id, newRole })
                    }}
                    className="rounded-lg bg-[var(--paper-2)] border border-[var(--ink-300)] text-[var(--ink-900)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] cursor-pointer h-9 px-2 py-2"
                    style={{ width: 130, flexShrink: 0 }}
                    aria-label={`Role for ${member.email ?? member.user_id}`}
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>

                  {/* Departments column (REQ-4) */}
                  <div
                    className="flex flex-wrap gap-1 items-center"
                    style={{ width: 230, flexShrink: 0 }}
                    data-testid={`dept-col-${member.id}`}
                  >
                    {memberDeptIds.length === 0 && openPickerMemberId !== member.id && (
                      <span
                        className="text-[10px]"
                        style={{ color: 'var(--ink-500)', fontStyle: 'italic' }}
                      >
                        No department
                      </span>
                    )}
                    {memberDeptIds.map(dId => {
                      const dept = deptMap.get(dId)
                      if (!dept) return null
                      const isOwner = dept.owner_user_id === member.user_id
                      return (
                        <DChip
                          key={dId}
                          variant="department"
                          department={dept}
                          showOwnerStar={isOwner}
                        />
                      )
                    })}

                    {/* Dashed add chip — opens member-mode DepartmentPicker */}
                    {departments.length > 0 && (
                      <DChip
                        variant="add"
                        onClick={() =>
                          setOpenPickerMemberId(
                            openPickerMemberId === member.id ? null : member.id
                          )
                        }
                      />
                    )}

                    {/* DepartmentPicker popover (member mode) */}
                    {openPickerMemberId === member.id && (
                      <div className="w-full mt-2">
                        <DepartmentPicker
                          mode="member"
                          memberId={member.user_id}
                          departments={departments}
                          selectedIds={memberDeptIds}
                          onChange={(ids) => {
                            setMembers(prev =>
                              prev.map(m =>
                                m.id === member.id ? { ...m, department_ids: ids } : m
                              )
                            )
                            // Refresh members to pick up owner changes
                            fetchMembers()
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setOpenPickerMemberId(null)}
                          className="mt-2 text-[11px] font-semibold rounded-md px-3 py-1"
                          style={{
                            background: 'var(--ink-900)',
                            color: '#fff',
                            border: 'none',
                          }}
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  {!isCurrentUser ? (
                    <button
                      onClick={() => setConfirmAction({ type: 'remove', memberId: member.id })}
                      className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--paper-2)] border border-[var(--ink-300)] text-[var(--ink-500)] hover:text-red-400 hover:border-red-500/30 transition-colors flex-shrink-0"
                      title="Remove from organisation"
                      aria-label={`Remove ${member.email ?? 'member'}`}
                    >
                      <UserMinus size={14} />
                    </button>
                  ) : (
                    <div className="w-9 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
