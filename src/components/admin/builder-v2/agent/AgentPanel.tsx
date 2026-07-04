'use client'

/**
 * Phase 26.5 Plan 07 — SOP-level agent panel (D-09/D-10).
 *
 * Renders the machine layer's synthesis output for the whole SOP: summary,
 * tags, entities, embedding presence, and cross-SOP/block-library links.
 * STRICTLY READ-ONLY — every field is a static text span, never an editable
 * form control (D-10: hand-editing machine metadata is pointless, it
 * regenerates on the next publish). The only interactive affordance is
 * proposal approve/decline, which the caller wires via onApprove/onDecline
 * (calling approveProposalAction/declineProposalAction).
 */

import type { AgentDashboardData, SopAgentMetadataView } from '@/actions/agent-layer'

function displayJson(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value || '—'
  try {
    const s = JSON.stringify(value)
    return s === '{}' || s === '[]' ? '—' : s
  } catch {
    return String(value)
  }
}

interface AgentPanelProps {
  data: SopAgentMetadataView | null
  loading?: boolean
  pendingProposals?: AgentDashboardData['pendingProposals']
  onApprove?: (proposalId: string) => void
  onDecline?: (proposalId: string) => void
}

export function AgentPanel({
  data,
  loading = false,
  pendingProposals = [],
  onApprove,
  onDecline,
}: AgentPanelProps) {
  return (
    <div className="agentpanel" data-testid="agent-panel">
      <h4>
        ⚇ Agent layer
        <span className="tag">{data?.assessment ?? 'unsynthesised'}</span>
      </h4>

      {loading ? (
        <div className="arow">
          <span className="av">Loading agent metadata…</span>
        </div>
      ) : !data ? (
        <div className="arow">
          <span className="av">No synthesis run yet for this SOP.</span>
        </div>
      ) : (
        <>
          <div className="arow">
            <span className="ak">summary</span>
            <span className="av">{data.summary || '—'}</span>
          </div>
          <div className="arow">
            <span className="ak">tags</span>
            <span className="av">
              {data.tags.length
                ? data.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))
                : '—'}
            </span>
          </div>
          <div className="arow">
            <span className="ak">entities</span>
            <span className="av">{displayJson(data.entities)}</span>
          </div>
          <div className="arow">
            <span className="ak">vector</span>
            <span className="av">
              {data.hasEmbedding ? <span className="ok">✓ embedded</span> : 'not embedded'}
            </span>
          </div>
          <div className="arow">
            <span className="ak">links</span>
            <span className="av link">{displayJson(data.links)}</span>
          </div>
          <div className="arow">
            <span className="ak">last synthesis</span>
            <span className="av">
              {data.lastSynthesisStatus ?? '—'}
              {data.lastSynthesisError ? ` — ${data.lastSynthesisError}` : ''}
            </span>
          </div>
        </>
      )}

      {pendingProposals.length > 0 && (
        <div className="arow" data-testid="agent-proposals">
          <span className="ak">proposals</span>
          <span className="av">
            {pendingProposals.map((p) => (
              <div key={p.id} data-proposal-id={p.id} style={{ marginBottom: 4 }}>
                {p.description}{' '}
                <button type="button" onClick={() => onApprove?.(p.id)}>
                  Approve
                </button>{' '}
                <button type="button" onClick={() => onDecline?.(p.id)}>
                  Decline
                </button>
              </div>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
