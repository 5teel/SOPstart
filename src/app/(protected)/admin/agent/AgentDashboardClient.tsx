'use client'

/**
 * Phase 26.5 Plan 08 — org agent dashboard client (D-09/D-10/D-11).
 *
 * PRIMARY: the evidence-backed proposals queue. Each row shows kind,
 * description and structured evidence; Approve/Decline call
 * approveProposalAction/declineProposalAction (Plan 07) and, on success,
 * the row leaves the queue (behavioural, not a dead affordance —
 * CLAUDE.md 2026-06-05).
 *
 * SECONDARY: a read-only recent-activity feed of memory writes / metadata
 * refreshes (D-14 payoff — the layer is visibly alive). No cross-SOP graph
 * visualisation this phase (D-11/D-13).
 *
 * Reuses the .agentpanel/.arow/.ak/.av purple `--ai` classes lifted from the
 * sketch (blueprint-theme.css) — same machine-layer identity as the
 * builder's read-only AgentPanel (Plan 07).
 */

import { useState, useTransition } from 'react'
import { approveProposalAction, declineProposalAction } from '@/actions/agent-layer'
import type { AgentDashboardData } from '@/actions/agent-layer'

function displayEvidence(value: unknown): string {
  if (value == null) return '—'
  try {
    const s = JSON.stringify(value)
    return s === '{}' || s === '[]' ? '—' : s
  } catch {
    return String(value)
  }
}

interface AgentDashboardClientProps {
  initialData: AgentDashboardData
  fetchError?: string | null
}

export function AgentDashboardClient({
  initialData,
  fetchError = null,
}: AgentDashboardClientProps) {
  const [proposals, setProposals] = useState(initialData.pendingProposals)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleApprove(id: string) {
    setActionError(null)
    setPendingId(id)
    startTransition(async () => {
      const result = await approveProposalAction(id)
      setPendingId(null)
      if ('error' in result) {
        setActionError(result.error)
        return
      }
      setProposals((prev) => prev.filter((p) => p.id !== id))
    })
  }

  function handleDecline(id: string) {
    setActionError(null)
    setPendingId(id)
    startTransition(async () => {
      const result = await declineProposalAction(id)
      setPendingId(null)
      if ('error' in result) {
        setActionError(result.error)
        return
      }
      setProposals((prev) => prev.filter((p) => p.id !== id))
    })
  }

  return (
    <>
      {(fetchError || actionError) && (
        <p
          role="alert"
          style={{
            fontSize: '13px',
            color: 'var(--accent-hazard)',
            marginBottom: '16px',
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid var(--accent-hazard)',
            borderRadius: '6px',
          }}
        >
          {fetchError || actionError}
        </p>
      )}

      {/* PRIMARY — evidence-backed proposals queue (D-11) */}
      <section className="agentpanel" data-testid="agent-proposals-queue" style={{ marginBottom: '24px' }}>
        <h4>
          Proposals
          <span className="tag">{proposals.length} pending</span>
        </h4>
        {proposals.length === 0 ? (
          <div className="arow">
            <span className="av">No pending proposals. The synthesis job will surface new ones here.</span>
          </div>
        ) : (
          proposals.map((p) => (
            <div
              key={p.id}
              className="arow"
              data-proposal-id={p.id}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="ak">{p.kind}</span>
                <span className="av">{p.description}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span className="ak">evidence</span>
                <span className="av">{displayEvidence(p.evidence)}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" disabled={pendingId === p.id} onClick={() => handleApprove(p.id)}>
                  {pendingId === p.id ? 'Working…' : 'Approve'}
                </button>
                <button type="button" disabled={pendingId === p.id} onClick={() => handleDecline(p.id)}>
                  {pendingId === p.id ? 'Working…' : 'Decline'}
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* SECONDARY — recent activity feed: memory writes / metadata refreshes (D-14) */}
      <section className="agentpanel" data-testid="agent-activity-feed">
        <h4>
          Recent activity
          <span className="tag">{initialData.recentMemory.length}</span>
        </h4>
        {initialData.recentMemory.length === 0 ? (
          <div className="arow">
            <span className="av">No memory writes yet.</span>
          </div>
        ) : (
          initialData.recentMemory.map((m) => (
            <div key={m.id} className="arow">
              <span className="ak">{m.scope}</span>
              <span className="av">
                {m.observation}
                {m.signalSource ? ` (${m.signalSource})` : ''}
              </span>
            </div>
          ))
        )}
      </section>
    </>
  )
}
