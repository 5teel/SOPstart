'use client'

/**
 * Phase 26.5 Plan 07 — per-block agent metadata rows (D-02/D-09/D-10).
 *
 * Each row is keyed by `junctionId` (sop_section_blocks.id — the SAME id the
 * junction/provenance system already uses everywhere else), NOT block_id or
 * sort_order. STRICTLY READ-ONLY — tags/entities/embedding render as static
 * chips/text, never an editable form control (D-10).
 *
 * Grouped as a flat list under the SOP-level AgentPanel rather than injected
 * per-block into EditableDocument's render loop — keeps this plan's diff to
 * new files only and avoids touching the live edit canvas (executor's
 * discretion per the plan; still keyed by junctionId so a future plan can
 * relocate these into the block tree without changing the data shape).
 */

import type { BlockAgentMetadataView } from '@/actions/agent-layer'

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

interface AgentBlockMetaProps {
  rows: BlockAgentMetadataView[]
}

export function AgentBlockMeta({ rows }: AgentBlockMetaProps) {
  if (rows.length === 0) return null

  return (
    <div className="ameta" data-testid="agent-block-meta">
      {rows.map((row) => (
        <div key={row.junctionId} data-junction-id={row.junctionId} className="mrow-group">
          <div className="mrow">
            <span className="mk">id</span>
            <span className="mv">{row.junctionId}</span>
          </div>
          <div className="mrow">
            <span className="mk">tags</span>
            <span className="mv">
              {row.tags.length
                ? row.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))
                : '—'}
            </span>
          </div>
          <div className="mrow">
            <span className="mk">entities</span>
            <span className="mv">{displayJson(row.entities)}</span>
          </div>
          <div className="mrow">
            <span className="mk">vector</span>
            <span className="mv">
              {row.hasEmbedding ? <span className="ok">✓ embedded</span> : 'not embedded'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
