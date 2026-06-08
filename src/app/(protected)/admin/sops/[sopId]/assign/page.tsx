'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, History, Video } from 'lucide-react'
import Link from 'next/link'
import { AssignmentRow } from '@/components/admin/AssignmentRow'
import { SubTradePicker } from '@/components/admin/SubTradePicker'
import {
  getAssignments,
  getOrgMembers,
  assignSopToRole,
  assignSopToUser,
  removeAssignment,
  type SopAssignment,
  type OrgMemberWithProfile,
} from '@/actions/assignments'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES: { value: string; label: string }[] = [
  { value: 'worker', label: 'Worker' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
  { value: 'safety_manager', label: 'Safety Manager' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function AssignSopPage() {
  const params = useParams()
  const router = useRouter()
  const sopId = params.sopId as string

  const [sopTitle, setSopTitle] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<SopAssignment[]>([])
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([])
  const [search, setSearch] = useState('')
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [isPageLoading, setIsPageLoading] = useState(true)

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsPageLoading(true)
    try {
      const [assignmentsResult, membersResult] = await Promise.all([
        getAssignments(sopId),
        getOrgMembers(),
      ])

      if (assignmentsResult.success) {
        setAssignments(assignmentsResult.assignments)
      }
      if (membersResult.success) {
        setMembers(membersResult.members)
      }

      // Fetch SOP title from Supabase (admin page — always online)
      const supabase = createClient()
      const { data: sopData } = await supabase
        .from('sops')
        .select('title, source_file_name')
        .eq('id', sopId)
        .maybeSingle()

      if (sopData) {
        setSopTitle(
          (sopData as { title: string | null; source_file_name: string }).title ??
          (sopData as { title: string | null; source_file_name: string }).source_file_name
        )
      }
    } finally {
      setIsPageLoading(false)
    }
  }, [sopId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function setLoading(key: string, value: boolean) {
    setLoadingStates(prev => ({ ...prev, [key]: value }))
  }

  function getRoleAssignment(role: string): SopAssignment | undefined {
    return assignments.find(
      a => a.assignment_type === 'role' && a.role === role
    )
  }

  function getUserAssignment(userId: string): SopAssignment | undefined {
    return assignments.find(
      a => a.assignment_type === 'individual' && a.user_id === userId
    )
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleAssignRole(role: string) {
    const key = `role-${role}`
    setLoading(key, true)

    // Optimistic insert
    const tempAssignment: SopAssignment = {
      id: `temp-${role}`,
      sop_id: sopId,
      organisation_id: '',
      assignment_type: 'role',
      role: role as SopAssignment['role'],
      user_id: null,
      assigned_by: '',
      created_at: new Date().toISOString(),
    }
    setAssignments(prev => [...prev, tempAssignment])

    const result = await assignSopToRole(sopId, role)

    if (result.success) {
      // Replace temp with real assignment
      setAssignments(prev =>
        prev.map(a =>
          a.id === `temp-${role}` ? { ...a, id: result.id } : a
        )
      )
    } else {
      // Revert on error
      setAssignments(prev => prev.filter(a => a.id !== `temp-${role}`))
      console.error('Failed to assign role:', result.error)
    }

    setLoading(key, false)
  }

  async function handleAssignUser(userId: string) {
    const key = `user-${userId}`
    setLoading(key, true)

    // Optimistic insert
    const tempAssignment: SopAssignment = {
      id: `temp-user-${userId}`,
      sop_id: sopId,
      organisation_id: '',
      assignment_type: 'individual',
      role: null,
      user_id: userId,
      assigned_by: '',
      created_at: new Date().toISOString(),
    }
    setAssignments(prev => [...prev, tempAssignment])

    const result = await assignSopToUser(sopId, userId)

    if (result.success) {
      setAssignments(prev =>
        prev.map(a =>
          a.id === `temp-user-${userId}` ? { ...a, id: result.id } : a
        )
      )
    } else {
      setAssignments(prev => prev.filter(a => a.id !== `temp-user-${userId}`))
      console.error('Failed to assign user:', result.error)
    }

    setLoading(key, false)
  }

  async function handleRemove(assignmentId: string, key: string) {
    setLoading(key, true)

    // Optimistic remove
    const previous = assignments.find(a => a.id === assignmentId)
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))

    const result = await removeAssignment(assignmentId)

    if (!result.success) {
      // Revert on error
      if (previous) {
        setAssignments(prev => [...prev, previous])
      }
      console.error('Failed to remove assignment:', result.error)
    }

    setLoading(key, false)
  }

  // ─── Filtered members ──────────────────────────────────────────────────────

  const filteredMembers = members.filter(m => {
    const term = search.toLowerCase()
    if (!term) return true
    const name = (m.full_name ?? m.user_id).toLowerCase()
    return name.includes(term) || m.role.toLowerCase().includes(term)
  })

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isPageLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 lg:px-8 lg:py-10 flex items-center justify-center min-h-[200px]">
        <p className="text-[var(--ink-500)] text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/admin/sops/builder/${sopId}`}
            className="flex items-center gap-2 text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors"
            aria-label="Back to SOP builder"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Review</span>
          </Link>
          <div className="flex-1" />
          <Link
            href={`/admin/sops/${sopId}/versions`}
            className="w-8 h-8 rounded-lg bg-white border border-[var(--ink-100)] hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors flex items-center justify-center"
            title="Version history"
          >
            <History size={16} />
          </Link>
          <Link
            href={`/admin/sops/${sopId}/video`}
            className="w-8 h-8 rounded-lg bg-white border border-[var(--ink-100)] hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors flex items-center justify-center"
            title="Video versions"
          >
            <Video size={16} />
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-[var(--ink-900)]">Assign SOP</h1>
        {sopTitle && (
          <p className="text-sm text-[var(--ink-500)] mt-1 truncate">{sopTitle}</p>
        )}
      </div>

      {/* Section 1: Assign by role */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-widest mb-3">
          Assign by role
        </h2>
        <ul className="space-y-2">
          {ALL_ROLES.map(({ value, label }) => {
            const assignment = getRoleAssignment(value)
            const key = `role-${value}`
            return (
              <li key={value}>
                <AssignmentRow
                  type="role"
                  name={label}
                  isAssigned={!!assignment}
                  assignmentId={assignment?.id}
                  isLoading={!!loadingStates[key]}
                  onAssign={() => handleAssignRole(value)}
                  onRemove={() =>
                    assignment && handleRemove(assignment.id, key)
                  }
                />
              </li>
            )
          })}
        </ul>
      </section>

      {/* Phase 15 / D-12 — Sub-trade tagging.
          Orthogonal to role assignment: both gates filter worker visibility
          via the RLS policy in migration 00030. Empty selection = visible
          to all workers regardless of sub-trade (backward compat). */}
      <section className="mb-8" data-testid="sop-sub-trade-section">
        <h2 className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-widest mb-3">
          Assign by sub-trade
        </h2>
        <p className="text-xs text-[var(--ink-500)] mb-3">
          Tag this SOP with one or more sub-trades. Workers carrying the
          matching tag will see this SOP in their library; others will not.
          Leave empty to make this SOP visible to all workers regardless of
          sub-trade.
        </p>
        <SubTradePicker mode="sop" sopId={sopId} />
      </section>

      {/* Section 3: Assign to individual workers */}
      <section>
        <h2 className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-widest mb-3">
          Assign to individual workers
        </h2>

        {members.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-[var(--ink-100)]">
            <Users size={32} className="text-[var(--ink-500)] mb-3" />
            <p className="text-base font-semibold text-[var(--ink-900)] mb-1">No workers yet</p>
            <p className="text-sm text-[var(--ink-500)]">
              Invite workers to your organisation first.
            </p>
          </div>
        ) : (
          <>
            {/* Search input */}
            <input
              type="search"
              placeholder="Search workers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-[56px] px-4 bg-white border border-[var(--ink-100)] rounded-xl text-[var(--ink-900)] placeholder:text-[var(--ink-500)] text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)]/50 focus:border-[var(--ink-900)]/50"
            />

            {filteredMembers.length === 0 ? (
              <p className="text-sm text-[var(--ink-500)] text-center py-6">
                No workers match &ldquo;{search}&rdquo;
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredMembers.map(member => {
                  const assignment = getUserAssignment(member.user_id)
                  const key = `user-${member.user_id}`
                  const displayName = member.full_name
                    ? member.full_name
                    : `Worker ${member.user_id.slice(0, 8)}`
                  const subtitleRole =
                    member.role.charAt(0).toUpperCase() +
                    member.role.slice(1).replace('_', ' ')
                  return (
                    <li key={member.user_id}>
                      <AssignmentRow
                        type="individual"
                        name={displayName}
                        subtitle={subtitleRole}
                        isAssigned={!!assignment}
                        assignmentId={assignment?.id}
                        isLoading={!!loadingStates[key]}
                        onAssign={() => handleAssignUser(member.user_id)}
                        onRemove={() =>
                          assignment && handleRemove(assignment.id, key)
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
