'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, Loader2 } from 'lucide-react'
import { getUserMemberships, switchOrganisation, type UserMembership } from '@/actions/auth'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  safety_manager: 'Safety Manager',
  supervisor: 'Supervisor',
  worker: 'Worker',
}

export function OrgSwitcher() {
  const router = useRouter()
  const [memberships, setMemberships] = useState<UserMembership[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, startTransition] = useTransition()

  useEffect(() => {
    getUserMemberships().then((result) => {
      if ('memberships' in result) {
        setMemberships(result.memberships)
        setActiveOrgId(result.activeOrgId)
      }
      setLoading(false)
    })
  }, [])

  const handleSwitch = (orgId: string) => {
    if (orgId === activeOrgId) return
    startTransition(async () => {
      const result = await switchOrganisation(orgId)
      if ('success' in result) {
        setActiveOrgId(orgId)
        router.refresh()
      }
    })
  }

  if (loading) {
    return (
      <div className="blueprint-frame p-5">
        <div className="h-16 bg-[var(--paper-2)] rounded-lg animate-pulse" />
      </div>
    )
  }

  if (memberships.length === 0) {
    return (
      <div className="blueprint-frame p-5">
        <h2 className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider mb-2">
          Organisations
        </h2>
        <p className="text-sm text-[var(--ink-500)]">You are not a member of any organisation yet.</p>
      </div>
    )
  }

  return (
    <div className="blueprint-frame p-5">
      <h2 className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider mb-3">
        Organisations
      </h2>
      <div className="space-y-2">
        {memberships.map((m) => {
          const isActive = m.organisationId === activeOrgId
          return (
            <button
              key={m.organisationId}
              onClick={() => handleSwitch(m.organisationId)}
              disabled={switching || isActive}
              className={[
                'w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border',
                isActive
                  ? 'bg-[var(--ink-900)]/5 border-[var(--ink-900)]/20'
                  : 'bg-white border-[var(--ink-100)] hover:border-[var(--ink-300)] hover:bg-[var(--paper-2)]',
              ].join(' ')}
            >
              <Building2 size={18} className={isActive ? 'text-[var(--ink-900)]' : 'text-[var(--ink-500)]'} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${isActive ? 'text-[var(--ink-900)]' : 'text-[var(--ink-700)]'}`}>
                  {m.orgName}
                </p>
                <p className="text-xs text-[var(--ink-500)]">
                  {ROLE_LABELS[m.role] ?? m.role}
                </p>
              </div>
              {isActive && !switching && (
                <Check size={16} className="text-[var(--ink-900)] flex-shrink-0" />
              )}
              {switching && !isActive && (
                <Loader2 size={16} className="text-[var(--ink-500)] animate-spin flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>
      {memberships.length > 1 && (
        <p className="text-xs text-[var(--ink-300)] mt-2">
          Tap an organisation to switch your active workspace.
        </p>
      )}
    </div>
  )
}
