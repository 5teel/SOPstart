'use client'

/**
 * Phase 26.5 Plan 07 — sticky agentview banner (D-09).
 *
 * Purely informational, passive. No handlers, no editable fields — shown
 * only while `agentview` is on so admins know they are looking at the
 * machine layer, not the human-facing SOP content.
 */
export function AgentBanner() {
  return (
    <div className="agentbanner" data-testid="agent-banner">
      ⚇ Agent layer visible — read-only machine metadata. It regenerates on
      publish; nothing here is hand-editable.
    </div>
  )
}
