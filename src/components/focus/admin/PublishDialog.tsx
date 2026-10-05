'use client'

/**
 * Phase 58 (58-12, D-16, D-25) -- the focused publish confirmation. A popup over
 * the recessed screen; "Publish" posts the existing publish route (the server
 * gate still decides), and the outcome is one of three:
 *   - published: the caller shows the ledger line; no redirect.
 *   - pendingApproval: the category has an approval chain, so the SOP went to
 *     its approver instead; the caller shows the approval line.
 *   - refused: the gate's reason is shown here and nothing changes.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRegisterOverlay } from '@/hooks/useFocusBack'

export interface PublishDialogProps {
  open: boolean
  sopId: string
  /** This version's number, and the live one it replaces (null on a first publish). */
  version: number
  liveVersion: number | null
  onClose(): void
  onPublished(): void
  onPendingApproval(): void
}

type PublishBody = { error?: string; count?: number; pendingApproval?: boolean }

function refusal(body: PublishBody, status: number): string {
  if (body.error === 'unverified_steps') return `Cannot publish — ${body.count ?? 'some'} steps still need checking.`
  if (body.error === 'no_steps') return 'Cannot publish — this SOP has no steps yet.'
  if (body.error === 'open_findings') return `Cannot publish — ${body.count ?? 'some'} AI findings are still open.`
  return body.error || `Publish failed (${status})`
}

export function PublishDialog({ open, sopId, version, liveVersion, onClose, onPublished, onPendingApproval }: PublishDialogProps) {
  const queryClient = useQueryClient()
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useRegisterOverlay(open, onClose)

  if (!open) return null

  async function publish() {
    setPublishing(true)
    setError(null)
    try {
      const res = await fetch(`/api/sops/${sopId}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' } })
      const body = (await res.json().catch(() => ({}))) as PublishBody
      if (!res.ok) return setError(refusal(body, res.status))
      // The SOP, the gate, the approval line and the version list all moved.
      for (const key of ['focus-sop', 'focus-gate', 'focus-approval', 'focus-lineage']) {
        void queryClient.invalidateQueries({ queryKey: [key, sopId] })
      }
      onClose()
      if (body.pendingApproval === true) onPendingApproval()
      else onPublished()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const name = liveVersion === null ? 'SOP' : `v${version}`
  return (
    <div data-testid="publish-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Publish ${name}?`}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-paper-1 p-6"
      >
        <h2 className="text-reading font-semibold text-ink-900">Publish {name}?</h2>
        <p className="text-reading text-ink-700">
          {liveVersion === null
            ? 'Workers get it the next time they open this SOP.'
            : `Workers get v${version} the next time they open this SOP. v${liveVersion} stays on record.`}
        </p>
        {error && (
          <p role="alert" className="text-ui text-accent-escalate">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={publishing}
            onClick={() => void publish()}
            className="min-h-tap rounded-lg bg-accent-signoff px-4 text-reading font-semibold text-white disabled:bg-ink-300 disabled:text-ink-500"
          >
            {publishing ? 'Publishing…' : `Publish ${name}`}
          </button>
          <button type="button" onClick={onClose} className="min-h-tap rounded-lg border border-ink-300 px-4 text-ui text-ink-900">
            Not yet
          </button>
        </div>
      </div>
    </div>
  )
}
