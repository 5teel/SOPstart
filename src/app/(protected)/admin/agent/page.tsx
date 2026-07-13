import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { getAgentDashboardData } from '@/actions/agent-layer'
import { AgentDashboardClient } from './AgentDashboardClient'

export const metadata: Metadata = {
  title: 'Agent layer',
}

/**
 * Phase 26.5 Plan 08 — /admin/agent SSR route (D-09 surface 2).
 *
 * Auth guard: same shape as /admin/departments/page.tsx — redirects
 * non-admin/safety_manager to /dashboard. Fetches org-wide pending
 * proposals + recent memory via getAgentDashboardData() (Plan 07) and hands
 * them to the client queue + activity feed.
 */
export default async function AgentDashboardPage() {
  const { userId, role } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const result = await getAgentDashboardData()
  const data = 'data' in result ? result.data : { pendingProposals: [], recentMemory: [] }
  const fetchError = 'error' in result ? result.error : null

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '26px 24px 60px',
        background: 'var(--paper)',
        minHeight: '100vh',
      }}
    >
      <h1
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--ink-900)',
          margin: '0 0 6px',
          fontFamily: 'var(--font-mono, monospace)',
        }}
      >
        ⚇ Agent layer
      </h1>
      <p
        style={{
          fontSize: '12px',
          color: 'var(--ink-500)',
          maxWidth: '620px',
          lineHeight: 1.5,
          margin: '0 0 22px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        What the machine layer has found across your SOPs — evidence-backed proposals waiting
        on a decision, and a feed of memory writes / metadata refreshes so you can see it&apos;s
        alive.
      </p>
      <AgentDashboardClient initialData={data} fetchError={fetchError} />
    </div>
  )
}
