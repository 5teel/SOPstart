'use client'

import { useEffect, useRef, useState } from 'react'
import type { SopWithSections } from '@/types/sop'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { useDraftLayoutSync } from '@/hooks/useDraftLayoutSync'
import { useNetworkStore } from '@/stores/network'
import { db } from '@/lib/offline/db'
import { BuilderTreeRail } from '@/components/admin/builder/BuilderTreeRail'
import { RerunReviewerButton } from '@/components/admin/ai-reviewer/RerunReviewerButton'
import { EditableDocument } from '@/components/admin/builder-v2/EditableDocument'
import { AgentPanel } from '@/components/admin/builder-v2/agent/AgentPanel'
import { AgentBlockMeta } from '@/components/admin/builder-v2/agent/AgentBlockMeta'
import { AgentBanner } from '@/components/admin/builder-v2/agent/AgentBanner'
import {
  getSopAgentMetadata,
  getBlockAgentMetadata,
  getAgentDashboardData,
  approveProposalAction,
  declineProposalAction,
  type SopAgentMetadataView,
  type BlockAgentMetadataView,
  type AgentDashboardData,
} from '@/actions/agent-layer'

interface BuilderClientProps {
  sopId: string
  initialSop: SopWithSections
}

/**
 * Phase 26 (D-01): the Build stage canvas. Puck is removed — the canvas now
 * mounts the bespoke `<EditableDocument>` which renders the SAME worker block
 * components with edit affordances and autosaves through the UNCHANGED
 * `useBuilderAutosave` → Dexie → Supabase path (P11).
 *
 * Selection-sync, AI-flag overlays, structured-field panels and the tiered
 * inserter are RE-WIRED off Puck in later waves; this wave mounts the canvas
 * minimally while keeping the Build→Review→Publish stage flow (owned by
 * BuilderStageShell) intact.
 */
export function BuilderClient({ sopId, initialSop }: BuilderClientProps) {
  const sections = [...(initialSop.sop_sections ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '')
  const activeSection = sections.find((s) => s.id === activeSectionId)

  // Canvas shows ONE section at a time; selecting a section in the tree rail is
  // the navigation act. Scroll the canvas back to the top of the newly-selected
  // section so clicking a section row always lands the admin at its start
  // instead of mid-content wherever the previous section was scrolled to.
  const canvasRef = useRef<HTMLElement>(null)
  useEffect(() => {
    canvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeSectionId])

  // Autosave/sync hooks. useDraftLayoutSync registers the mount/online/
  // visibility triggers that flush dirty draftLayouts rows to Supabase.
  const { syncing, lastSyncResult } = useDraftLayoutSync()
  const isOnline = useNetworkStore((s) => s.isOnline)

  // Track last-synced timestamp for the SAVED pill (polls Dexie every 2s).
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [savedTick, setSavedTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const rows = await db.draftLayouts.where('sop_id').equals(sopId).toArray()
        const synced = rows.filter((r) => r.syncState === 'synced')
        const latest = synced.reduce((acc, r) => (r.updated_at > acc ? r.updated_at : acc), 0)
        if (!cancelled) setLastSavedAt(latest > 0 ? latest : null)
      } catch {
        // Dexie not ready / SSR — leave lastSavedAt as-is
      }
    }
    void refresh()
    const poll = setInterval(refresh, 2_000)
    const tick = setInterval(() => setSavedTick((t) => t + 1), 1_000)
    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [sopId])

  // D-07: surface a quiet toast when a cross-admin overwrite is reported.
  const [overwriteToast, setOverwriteToast] = useState<string | null>(null)
  useEffect(() => {
    if (!lastSyncResult?.overwrittenByServer?.length) return
    const overwrittenTitles = lastSyncResult.overwrittenByServer.map(
      (id) => sections.find((s) => s.id === id)?.title ?? id.slice(0, 8)
    )
    setOverwriteToast(`Updated by another admin - ${overwrittenTitles.join(', ')}`)
    const t = setTimeout(() => setOverwriteToast(null), 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncResult])

  // D-16: section-level toast when layout_data is structurally broken.
  const [layoutErrorToast, setLayoutErrorToast] = useState<string | null>(null)
  useEffect(() => {
    if (!activeSection || activeSection.layout_data == null) {
      setLayoutErrorToast(null)
      return
    }
    const parsed = LayoutDataSchema.safeParse(activeSection.layout_data)
    setLayoutErrorToast(
      parsed.success
        ? null
        : `Section "${activeSection.title}" has broken layout data - revert to last save?`
    )
  }, [activeSection])

  // Phase 26.5 (D-09): agentview toggle reveals the read-only machine-layer
  // panel + per-block metadata rows over the same canvas. Lazy-fetched only
  // while the toggle is on — admins who never look at the agent layer never
  // pay the query cost.
  const [agentview, setAgentview] = useState(false)
  const [agentLoading, setAgentLoading] = useState(false)
  const [sopAgentData, setSopAgentData] = useState<SopAgentMetadataView | null>(null)
  const [blockAgentRows, setBlockAgentRows] = useState<BlockAgentMetadataView[]>([])
  const [sopProposals, setSopProposals] = useState<AgentDashboardData['pendingProposals']>([])
  const [proposalActionError, setProposalActionError] = useState<string | null>(null)
  // WR-06 (review fix): a failed/offline load must render a distinct error
  // state, not the "No synthesis run yet" empty state.
  const [agentError, setAgentError] = useState<string | null>(null)

  useEffect(() => {
    if (!agentview) return
    let cancelled = false
    setAgentLoading(true)
    setAgentError(null)
    Promise.all([getSopAgentMetadata(sopId), getBlockAgentMetadata(sopId), getAgentDashboardData()])
      .then(([sopRes, blockRes, dashRes]) => {
        if (cancelled) return
        // Surface a server-action { error } instead of conflating it with
        // "no data" (WR-06) — the SOP-level read is the panel's primary source.
        if ('error' in sopRes) setAgentError(sopRes.error)
        setSopAgentData('data' in sopRes ? sopRes.data : null)
        setBlockAgentRows('data' in blockRes ? blockRes.data : [])
        setSopProposals(
          'data' in dashRes ? dashRes.data.pendingProposals.filter((p) => p.sopId === sopId) : []
        )
      })
      .catch(() => {
        // Transport-level rejection (offline, server unreachable) — WR-06:
        // without this the rejection was unhandled and the panel silently
        // showed the "No synthesis run yet" empty state.
        if (cancelled) return
        setSopAgentData(null)
        setBlockAgentRows([])
        setSopProposals([])
        setAgentError('Failed to load the agent layer — check your connection and retry.')
      })
      .finally(() => {
        if (!cancelled) setAgentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentview, sopId])

  // WR-01 (review fix): await first, check the result, only remove on success
  // (mirrors AgentDashboardClient) — optimistic removal that ignores a failed
  // action makes the proposal silently vanish while staying pending in the DB.
  async function handleApproveProposal(proposalId: string) {
    setProposalActionError(null)
    const result = await approveProposalAction(proposalId)
    if ('error' in result) {
      setProposalActionError(result.error)
      return
    }
    setSopProposals((prev) => prev.filter((p) => p.id !== proposalId))
  }
  async function handleDeclineProposal(proposalId: string) {
    setProposalActionError(null)
    const result = await declineProposalAction(proposalId)
    if ('error' in result) {
      setProposalActionError(result.error)
      return
    }
    setSopProposals((prev) => prev.filter((p) => p.id !== proposalId))
  }

  const savePillLabel = !isOnline
    ? 'OFFLINE · QUEUED'
    : syncing
      ? 'SAVING…'
      : lastSavedAt
        ? `SAVED ${Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000))}s AGO`
        : 'SAVED'
  // Reference savedTick so React re-runs the render each tick for the label.
  void savedTick

  return (
    <div
      className={`agent-layer-root flex h-screen flex-col bg-[var(--paper)] text-[var(--ink-900)] ${agentview ? 'agentview' : ''}`}
    >
      {/* 32-uat: navigation + SOP title live ONCE in BuilderStageShell's top
          bar — this row is status + tools only (no duplicate title). */}
      <header className="flex items-center justify-end border-b border-[var(--ink-100)] px-4 py-3">
        <div className="flex items-center gap-3">
          {layoutErrorToast && (
            <div
              role="alert"
              className="cursor-pointer rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-red-300"
              onClick={() => setLayoutErrorToast(null)}
            >
              {layoutErrorToast} (click to dismiss)
            </div>
          )}
          {overwriteToast && (
            <span
              role="status"
              className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-amber-300"
            >
              {overwriteToast}
            </span>
          )}
          <span className="rounded border border-[var(--ink-300)] px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
            {savePillLabel}
          </span>
          {/* 32-uat: tools cluster — matches the shell top bar's bordered
              "Tools" grouping so tools read distinctly from status/navigation. */}
          <div
            data-testid="builder-tools-cluster-edit"
            className="flex items-center gap-2 rounded border border-[var(--ink-100)] px-2 py-1"
          >
            <span
              aria-hidden="true"
              className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink-500)]"
            >
              Tools
            </span>
            <RerunReviewerButton sopId={sopId} />
            <button
              type="button"
              onClick={() => setAgentview((v) => !v)}
              aria-pressed={agentview}
              className="rounded border border-[var(--ink-300)] px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] data-[on=true]:border-[var(--ai)] data-[on=true]:text-[var(--ai)]"
              data-on={agentview}
              data-testid="agentview-toggle"
            >
              ⚇ Agent layer
            </button>
          </div>
        </div>
      </header>
      <AgentBanner />
      <div className="flex min-h-0 flex-1">
        <BuilderTreeRail
          sections={sections}
          activeSection={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (activeSection ?? null) as any
          }
          activeSectionId={activeSectionId}
          onSelect={setActiveSectionId}
          sopId={sopId}
        />
        <main ref={canvasRef} className="relative min-w-0 flex-1 overflow-auto">
          {agentview && (
            <div className="px-4 pt-4">
              {proposalActionError && (
                <p
                  role="alert"
                  className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-xs text-red-400"
                >
                  Proposal action failed: {proposalActionError}
                </p>
              )}
              {agentError ? (
                <p
                  role="alert"
                  className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-xs text-red-400"
                  data-testid="agent-layer-error"
                >
                  Agent layer unavailable: {agentError}
                </p>
              ) : (
                <>
                  <AgentPanel
                    data={sopAgentData}
                    loading={agentLoading}
                    pendingProposals={sopProposals}
                    onApprove={handleApproveProposal}
                    onDecline={handleDeclineProposal}
                  />
                  <AgentBlockMeta rows={blockAgentRows} />
                </>
              )}
            </div>
          )}
          {activeSection ? (
            <EditableDocument
              key={activeSection.id}
              section={activeSection}
              sopId={sopId}
              renderFamily={activeSection.section_kind?.render_family ?? 'custom'}
              sopCategory={initialSop.category_tag ?? null}
            />
          ) : (
            <div className="p-8 text-[var(--ink-500)]">
              No sections yet — add one from the sidebar.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
