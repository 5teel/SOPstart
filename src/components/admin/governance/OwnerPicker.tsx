'use client'

/**
 * OWN-02: inline ≤2-click owner reassignment.
 * Click 1 opens the popover (fetches org members via getOrgMembers — reused,
 * not hand-rolled). Click 2 picks a member (or "No owner") → setSopOwner then
 * closes + refreshes. Errors surfaced inline, never swallowed.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'
import { getOrgMembers, type OrgMemberWithProfile } from '@/actions/assignments'
import { setSopOwner } from '@/actions/governance'

function memberLabel(m: OrgMemberWithProfile): string {
  return m.email ?? m.full_name ?? `${m.role} (${m.user_id.slice(0, 8)})`
}

export function OwnerPicker({
  sopId,
  ownerUserId,
  ownerLabel,
}: {
  sopId: string
  ownerUserId: string | null
  ownerLabel: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleOpen() {
    setError(null)
    setOpen((o) => !o)
    if (open || members.length > 0) return
    setLoading(true)
    const result = await getOrgMembers()
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setMembers(result.members)
  }

  async function handlePick(userId: string | null) {
    setSaving(true)
    setError(null)
    const result = await setSopOwner(sopId, userId)
    setSaving(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="evidence-btn !min-h-[36px] text-sm inline-flex items-center gap-1.5"
      >
        <User className="h-3.5 w-3.5" />
        {ownerUserId ? 'Reassign' : 'Assign owner'}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 blueprint-frame bg-[var(--paper-1)] shadow-lg p-2">
          <p className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] mb-2">
            Current: {ownerLabel}
          </p>
          {loading && <p className="text-xs text-[var(--ink-500)]">Loading members…</p>}
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <ul className="max-h-56 overflow-y-auto space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => handlePick(null)}
                disabled={saving}
                className="w-full text-left text-sm px-2 py-1 rounded hover:bg-[var(--paper-2)] text-[var(--ink-500)]"
              >
                No owner
              </button>
            </li>
            {members.map((m) => (
              <li key={m.user_id}>
                <button
                  type="button"
                  onClick={() => handlePick(m.user_id)}
                  disabled={saving}
                  className="w-full text-left text-sm px-2 py-1 rounded hover:bg-[var(--paper-2)] text-[var(--ink-900)]"
                >
                  {memberLabel(m)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
