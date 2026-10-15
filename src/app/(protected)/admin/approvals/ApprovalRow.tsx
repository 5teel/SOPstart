'use client'
import { useState } from 'react'
import { decideNewUser } from '@/actions/user-approval'

export interface WaitingPerson {
  userId: string
  email: string
  status: 'pending' | 'declined'
  createdAt: string
  site: string | null
  role: string | null
}

export function ApprovalRow({ person }: { person: WaitingPerson }) {
  const [state, setState] = useState<'idle' | 'busy' | 'approved' | 'declined'>('idle')
  const [error, setError] = useState<string | null>(null)
  async function decide(approve: boolean) {
    setState('busy')
    setError(null)
    const res = await decideNewUser(person.userId, approve)
    if (res.error) {
      setError(res.error)
      setState('idle')
    } else setState(approve ? 'approved' : 'declined')
  }
  const when = person.createdAt.slice(0, 10)
  return (
    <li data-testid="approval-row" data-email={person.email} className="list-row flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="truncate text-reading font-semibold text-ink-900">{person.email}</p>
        <p className="text-meta text-ink-600">
          {person.site ? `Invited to ${person.site}${person.role ? ` as ${person.role.replace('_', ' ')}` : ''}` : 'No site yet'} · {when}
        </p>
        {error && <p role="alert" className="text-meta text-accent-escalate">{error}</p>}
      </div>
      {state === 'approved' || state === 'declined' ? (
        <p data-testid="approval-done" className="text-ui font-semibold text-ink-900">{state === 'approved' ? 'Approved' : 'Turned down'}</p>
      ) : (
        <div className="flex gap-2">
          {person.status === 'pending' && (
            <button type="button" data-testid="approval-decline" disabled={state === 'busy'} onClick={() => decide(false)} className="min-h-tap rounded-lg border border-ink-200 px-4 text-ui text-ink-700">
              Turn down
            </button>
          )}
          <button type="button" data-testid="approval-approve" disabled={state === 'busy'} onClick={() => decide(true)} className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper">
            Approve
          </button>
        </div>
      )}
    </li>
  )
}
