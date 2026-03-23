'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateMemberRole, inviteWorker } from '@/actions/auth'
import type { AppRole } from '@/types/auth'

interface Member {
  id: string
  user_id: string
  role: AppRole
  email?: string
}

const ROLE_LABELS: Record<AppRole, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  admin: 'Admin',
  safety_manager: 'Safety Manager',
}

const ALL_ROLES: AppRole[] = ['worker', 'supervisor', 'admin', 'safety_manager']

// Displays the org invite_code and allows role management for all members
export default function RoleAssignmentTable({ orgId, inviteCode }: { orgId: string; inviteCode: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null)

  // Invite worker state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Invite code copy state
  const [codeCopied, setCodeCopied] = useState(false)

  const fetchMembers = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('organisation_members')
      .select('id, user_id, role')
      .eq('organisation_id', orgId)
      .order('role')

    if (data) {
      setMembers(data as Member[])
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleRoleChange = async (memberId: string, role: string) => {
    setFeedback(null)
    const result = await updateMemberRole({ memberId, role })
    if (result?.error) {
      setFeedback({ id: memberId, message: result.error, type: 'error' })
    } else {
      setFeedback({ id: memberId, message: 'Role updated', type: 'success' })
      // Update local state
      setMembers(prev =>
        prev.map(m => (m.id === memberId ? { ...m, role: role as AppRole } : m))
      )
      setTimeout(() => setFeedback(null), 2000)
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

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  if (loading) {
    return <div className="text-steel-400 py-8 text-center">Loading team members...</div>
  }

  return (
    <div className="space-y-6">
      {/* Org invite code */}
      <div className="rounded-xl bg-steel-800 border border-steel-700 p-4">
        <p className="text-sm text-steel-400 mb-2 font-medium">Organisation Invite Code</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-bold text-brand-yellow tracking-widest">
            {inviteCode}
          </span>
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 text-sm rounded-lg bg-steel-700 hover:bg-steel-600 text-steel-100 transition-colors min-h-[44px]"
          >
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-steel-400 mt-2">
          Share this code with workers so they can join your organisation
        </p>
      </div>

      {/* Invite by email */}
      <div className="rounded-xl bg-steel-800 border border-steel-700 p-4">
        <p className="text-sm text-steel-400 mb-2 font-medium">Invite a Worker by Email</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="worker@company.co.nz"
            className="flex-1 px-4 py-3 rounded-lg bg-steel-900 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow text-base"
          />
          <button
            onClick={handleInvite}
            disabled={inviteLoading || !inviteEmail.trim()}
            className="px-4 py-3 min-h-[var(--min-tap-target)] bg-brand-yellow hover:bg-brand-orange disabled:opacity-60 disabled:cursor-not-allowed text-steel-900 font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            {inviteLoading ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
        {inviteFeedback && (
          <p className={`mt-2 text-sm ${inviteFeedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {inviteFeedback.message}
          </p>
        )}
      </div>

      {/* Members table */}
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
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between px-4 py-3 min-h-[var(--min-tap-target)]"
              >
                <div className="min-w-0">
                  <p className="text-steel-100 text-sm font-medium truncate">
                    {member.email ?? member.user_id.slice(0, 8) + '...'}
                  </p>
                  {feedback?.id === member.id && (
                    <p className={`text-xs mt-0.5 ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {feedback.message}
                    </p>
                  )}
                </div>
                <select
                  value={member.role}
                  onChange={e => handleRoleChange(member.id, e.target.value)}
                  className="ml-4 px-3 py-2 rounded-lg bg-steel-700 border border-steel-600 text-steel-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer min-h-[44px]"
                  aria-label={`Role for member ${member.user_id}`}
                >
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
