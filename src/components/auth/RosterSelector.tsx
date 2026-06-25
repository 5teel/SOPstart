'use client'

/**
 * RosterSelector — D-11 kiosk name-select component
 *
 * Fetches the org roster from organisation_members and renders large glove-friendly
 * name buttons (paper/ink tokens). On selecting a name, stores roster_worker_id in
 * component state AND sessionStorage for the walkthrough session.
 *
 * KEY DESIGN DECISIONS:
 * - The selected roster_worker_id is NOT a Supabase session. The kiosk account session
 *   (established once by the admin per RESEARCH Option A) remains unchanged.
 * - roster_worker_id is passed into submitCompletion at completion time as rosterWorkerId.
 * - sessionStorage persists the selection across page navigations within the browser tab;
 *   cleared on tab close (appropriate kiosk session longevity).
 * - The org roster is fetched via /api/roster?org=<orgCode> — the server validates the
 *   org and returns only display names + user_ids for members in that org.
 * - No escalation: this component only stores an attribution identity. The kiosk account
 *   (role='worker') session controls all data access via Supabase RLS (T-23-06-03).
 *
 * KIOSK ACCOUNT SETUP (one-time admin action per org — RESEARCH Open Question #1):
 * 1. Create auth.users: kiosk+{org_id}@internal (Supabase dashboard or SQL)
 * 2. Add to organisation_members: user_id = kiosk account uid, role = 'worker', org = target org
 * 3. Sign the shared kiosk device into this account and leave it authenticated
 * Auto-provisioning is deferred — this is a manual operator step for now.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const ROSTER_STORAGE_KEY = 'safestart_roster_worker_id'
const ROSTER_NAME_STORAGE_KEY = 'safestart_roster_worker_name'

interface RosterMember {
  user_id: string
  display_name: string
}

interface RosterSelectorProps {
  /** org query param from /login/kiosk?org=<orgCode> */
  orgCode: string
}

export default function RosterSelector({ orgCode }: RosterSelectorProps) {
  const router = useRouter()
  const [members, setMembers] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)

  // Load any previously selected name from sessionStorage on mount
  useEffect(() => {
    const storedId = sessionStorage.getItem(ROSTER_STORAGE_KEY)
    const storedName = sessionStorage.getItem(ROSTER_NAME_STORAGE_KEY)
    if (storedId && storedName) {
      setSelectedId(storedId)
      setSelectedName(storedName)
    }
  }, [])

  // Fetch org roster from /api/roster
  useEffect(() => {
    async function fetchRoster() {
      setLoading(true)
      setError(null)
      try {
        const url = orgCode
          ? `/api/roster?org=${encodeURIComponent(orgCode)}`
          : '/api/roster'
        const res = await fetch(url)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error ?? 'Could not load roster. Ask your supervisor to check the kiosk setup.')
          return
        }
        const data = await res.json()
        setMembers(data.members ?? [])
      } catch {
        setError('Could not connect. Check your internet connection.')
      } finally {
        setLoading(false)
      }
    }
    fetchRoster()
  }, [orgCode])

  function handleSelect(member: RosterMember) {
    setSelectedId(member.user_id)
    setSelectedName(member.display_name)
    // Store in sessionStorage — persists across page navigations within this tab
    // (kiosk session longevity: cleared when the tab/browser closes)
    sessionStorage.setItem(ROSTER_STORAGE_KEY, member.user_id)
    sessionStorage.setItem(ROSTER_NAME_STORAGE_KEY, member.display_name)
  }

  function handleContinue() {
    if (!selectedId) return
    // Navigate to the SOP library so the worker can pick an SOP to walk through
    router.push('/sops')
  }

  function handleClear() {
    setSelectedId(null)
    setSelectedName(null)
    sessionStorage.removeItem(ROSTER_STORAGE_KEY)
    sessionStorage.removeItem(ROSTER_NAME_STORAGE_KEY)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 size={32} className="text-[var(--ink-400)] animate-spin" />
        <p className="text-sm text-[var(--ink-500)]">Loading roster…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--accent-escalate)]/30 bg-[var(--accent-escalate)]/8 p-6 text-center">
        <AlertCircle size={24} className="text-[var(--accent-escalate)] mx-auto mb-3" />
        <p className="text-sm text-[var(--accent-escalate)] font-medium mb-1">Roster unavailable</p>
        <p className="text-xs text-[var(--ink-500)]">{error}</p>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--ink-100)] bg-[var(--paper-2)] p-6 text-center">
        <User size={24} className="text-[var(--ink-400)] mx-auto mb-3" />
        <p className="text-sm text-[var(--ink-500)]">No workers found for this kiosk.</p>
        <p className="text-xs text-[var(--ink-400)] mt-1">Ask your admin to add team members.</p>
      </div>
    )
  }

  // Worker confirmed — show confirmation before continuing
  if (selectedId && selectedName) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--accent-signoff)]/40 bg-[var(--accent-signoff)]/8 p-5 flex items-center gap-4">
          <CheckCircle size={28} className="text-[var(--accent-signoff)] flex-shrink-0" />
          <div>
            <p className="text-sm text-[var(--ink-500)] mb-0.5">Selected worker</p>
            <p className="text-base font-semibold text-[var(--ink-900)]">{selectedName}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="w-full h-[64px] rounded-xl bg-[var(--ink-900)] text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          Continue as {selectedName.split(' ')[0]}
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="w-full h-[48px] rounded-xl border border-[var(--ink-200)] text-[var(--ink-500)] text-sm font-medium hover:bg-[var(--paper-2)] transition-colors"
        >
          Not you? Select a different name
        </button>
      </div>
    )
  }

  // Name list — large glove-friendly tap targets (paper/ink tokens, D-11)
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <button
          key={member.user_id}
          type="button"
          onClick={() => handleSelect(member)}
          className="w-full h-[64px] rounded-xl border border-[var(--ink-100)] bg-[var(--paper)] hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] active:scale-[0.98] transition-all flex items-center gap-4 px-5 text-left"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--paper-2)] border border-[var(--ink-100)] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[var(--ink-700)]">
              {getInitials(member.display_name)}
            </span>
          </div>
          <span className="text-base font-semibold text-[var(--ink-900)]">
            {member.display_name}
          </span>
        </button>
      ))}
    </div>
  )
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
