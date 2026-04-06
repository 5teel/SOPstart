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

const ROLE_LABELS: Record<AppRole, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  admin: 'Admin',
  safety_manager: 'Safety Manager',
}

const ALL_ROLES: AppRole[] = ['worker', 'supervisor', 'admin', 'safety_manager']

export default function RoleAssignmentTable({ orgId, inviteCode: initialCode }: { orgId: string; inviteCode: string }) {
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

  if (loading) {
    return <div className="text-steel-400 py-8 text-center">Loading team members...</div>
  }

  return (
    <div className="space-y-6">
      {/* Org invite code */}
      <div className="rounded-xl bg-steel-800 border border-steel-700 p-4">
        <p className="text-sm text-steel-400 mb-2 font-medium">Organisation Invite Code</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-lg font-bold text-brand-yellow tracking-widest">
            {inviteCode}
          </span>
          <button
            onClick={handleCopyCode}
            className="h-9 px-3 text-sm rounded-lg bg-steel-700 hover:bg-steel-600 text-steel-100 transition-colors"
          >
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleRegenerateCode}
            disabled={regenerating}
            className="h-9 px-3 text-sm rounded-lg bg-steel-700 hover:bg-steel-600 text-brand-orange transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Generate new code — old code will stop working"
          >
            <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating...' : 'New code'}
          </button>
        </div>
        <p className="text-xs text-steel-400 mt-2">
          Share this code with workers. Regenerating creates a new code and the old one stops working.
        </p>
      </div>

      {/* Invite by email */}
      <div className="rounded-xl bg-steel-800 border border-steel-700 p-4">
        <p className="text-sm text-steel-400 mb-2 font-medium">Invite by Email</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="worker@company.co.nz"
            className="flex-1 px-4 py-3 rounded-lg bg-steel-900 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow text-sm"
          />
          <button
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
            className="h-[44px] px-4 bg-brand-yellow hover:bg-brand-orange disabled:opacity-60 text-steel-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
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
      <div className="rounded-xl bg-steel-800 border border-steel-700 p-4">
        <p className="text-sm text-steel-400 mb-2 font-medium">Add Existing Member to Role</p>
        <p className="text-xs text-steel-600 mb-3">Add someone who already has a SOPstart account to your organisation with a specific role.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={addEmail}
            onChange={e => setAddEmail(e.target.value)}
            placeholder="user@example.co.nz"
            className="flex-1 min-w-[180px] px-4 py-3 rounded-lg bg-steel-900 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow text-sm"
          />
          <select
            value={addRole}
            onChange={e => setAddRole(e.target.value as AppRole)}
            className="px-3 py-3 rounded-lg bg-steel-900 border border-steel-700 text-steel-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer"
          >
            {ALL_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            onClick={handleAddMember}
            disabled={addLoading || !addEmail.trim()}
            className="h-[44px] px-4 bg-brand-yellow hover:bg-brand-orange disabled:opacity-60 text-steel-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
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
        <div className="rounded-xl bg-brand-orange/10 border border-brand-orange/30 p-4 flex items-center gap-3 flex-wrap">
          <AlertTriangle size={18} className="text-brand-orange flex-shrink-0" />
          <span className="text-sm text-steel-100 flex-1">
            {confirmAction.type === 'remove'
              ? `Remove ${members.find(m => m.id === confirmAction.memberId)?.email ?? 'this member'} from the organisation?`
              : `Change role to ${ROLE_LABELS[confirmAction.newRole as AppRole]}?`}
          </span>
          <button
            onClick={() => {
              if (confirmAction.type === 'remove') executeRemove(confirmAction.memberId)
              else if (confirmAction.newRole) executeRoleChange(confirmAction.memberId, confirmAction.newRole)
            }}
            className="h-9 px-3 bg-brand-orange text-white font-semibold text-xs rounded-lg"
          >
            Yes
          </button>
          <button
            onClick={() => {
              setConfirmAction(null)
              // Reset select if role change was cancelled
              fetchMembers()
            }}
            className="h-9 px-3 bg-steel-700 text-steel-100 text-xs rounded-lg"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl bg-steel-800 border border-steel-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-steel-700">
          <h3 className="font-semibold text-steel-100">Team Members ({members.length})</h3>
        </div>

        {members.length === 0 ? (
          <div className="px-4 py-8 text-center text-steel-400">
            No team members yet. Invite workers above to get started.
          </div>
        ) : (
          <div className="divide-y divide-steel-700">
            {members.map(member => {
              const isCurrentUser = member.user_id === currentUserId
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3 min-h-[60px]"
                >
                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-steel-100 truncate">
                        {member.email ?? member.user_id.slice(0, 8) + '...'}
                      </p>
                      {isCurrentUser && (
                        <span className="text-[10px] text-brand-yellow font-semibold bg-brand-yellow/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          You
                        </span>
                      )}
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
                    className="w-[130px] px-2 py-2 rounded-lg bg-steel-700 border border-steel-600 text-steel-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer h-9"
                    aria-label={`Role for ${member.email ?? member.user_id}`}
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>

                  {/* Remove button */}
                  {!isCurrentUser ? (
                    <button
                      onClick={() => setConfirmAction({ type: 'remove', memberId: member.id })}
                      className="h-9 w-9 flex items-center justify-center rounded-lg bg-steel-700 border border-steel-600 text-steel-400 hover:text-red-400 hover:border-red-500/30 transition-colors flex-shrink-0"
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
