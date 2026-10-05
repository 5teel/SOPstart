'use client'

/**
 * OWN-02: inline ≤2-click owner reassignment.
 * Click 1 opens the popover (fetches org members via getOrgMembers — reused,
 * not hand-rolled). Click 2 picks a member (or "No owner") → setSopOwner then
 * closes and tells the caller through `onDone`, so the caller decides what to
 * refresh. Esc closes the popover and nothing else (the Office stays put).
 * Errors surfaced inline, never swallowed.
 */

import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { getOrgMembers, type OrgMemberWithProfile } from '@/actions/assignments'
import { setSopOwner } from '@/actions/governance'

function memberLabel(m: OrgMemberWithProfile): string {
  return m.full_name ?? m.email ?? 'someone who has left'
}

export function OwnerPicker({
  sopId,
  ownerUserId,
  ownerLabel,
  onDone,
  triggerClassName = 'evidence-btn !min-h-9 text-sm inline-flex items-center gap-1.5',
  triggerTestId,
}: {
  sopId: string
  ownerUserId: string | null
  ownerLabel: string
  onDone?: (r: { logged: boolean; ownerLabel: string | null }) => void
  triggerClassName?: string
  triggerTestId?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Capture phase and preventDefault: the shell's own Esc handler sees a
  // handled key and leaves the Office open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

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
    const picked = userId ? members.find((m) => m.user_id === userId) : null
    onDone?.({ logged: result.logged, ownerLabel: picked ? memberLabel(picked) : null })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        data-testid={triggerTestId}
        className={triggerClassName}
      >
        <User className="h-3.5 w-3.5" />
        {ownerUserId ? 'Reassign' : 'Assign owner'}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-ink-200 bg-paper-1 p-2 shadow-lg">
          <p className="mono mb-2 text-meta uppercase tracking-wider text-ink-500">Current: {ownerLabel}</p>
          {loading && <p className="text-xs text-ink-500">Loading members…</p>}
          {error && <p className="mb-2 text-xs text-accent-escalate">{error}</p>}
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => handlePick(null)}
                disabled={saving}
                className="min-h-tap w-full rounded px-2 text-left text-sm text-ink-500 hover:bg-paper-2"
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
                  className="min-h-tap w-full rounded px-2 text-left text-sm text-ink-900 hover:bg-paper-2"
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
