'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { promoteSuggestion, rejectSuggestion } from '@/actions/blocks'
import type { BlockSuggestion } from '@/types/sop'
import type { BlockContent } from '@/lib/validators/blocks'
import { HazardCardBlock } from '@/components/sop/blocks/HazardCardBlock'
import { PPECardBlock } from '@/components/sop/blocks/PPECardBlock'
import { StepBlock } from '@/components/sop/blocks/StepBlock'

export type SuggestionReviewRowProps = {
  suggestion: BlockSuggestion
  /** Optional callback fired after a successful Promote / Reject. Default: router.refresh(). */
  onDecision?: () => void
}

/**
 * Phase 13 plan 13-05: Per-row UI for the suggestions queue.
 *
 * LEFT pane: snapshot preview using the same worker-facing components
 *            (Phase 12.5 paper/ink theme is route-scoped to /sops, so the
 *            admin route renders these inside the steel-900 admin chrome).
 * MIDDLE:    metadata (suggesting org, suggesting user, submitted, name, tags).
 * RIGHT:     decision form — optional note + Promote / Reject buttons.
 *
 * Promote calls promoteSuggestion (built in 13-01) which inserts a global
 * block (organisation_id = null) and marks the suggestion promoted.
 * Reject calls rejectSuggestion (also from 13-01) and records the decision note.
 */
export function SuggestionReviewRow({ suggestion, onDecision }: SuggestionReviewRowProps) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePromote() {
    setError(null)
    setToast(null)
    startTransition(async () => {
      const trimmed = note.trim() || undefined
      const res = await promoteSuggestion(suggestion.id, trimmed)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setToast('Promoted to global library')
      if (onDecision) {
        onDecision()
      } else {
        router.refresh()
      }
    })
  }

  function handleReject() {
    setError(null)
    setToast(null)
    startTransition(async () => {
      const trimmed = note.trim() || undefined
      const res = await rejectSuggestion(suggestion.id, trimmed)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setToast('Rejected')
      if (onDecision) {
        onDecision()
      } else {
        router.refresh()
      }
    })
  }

  const submittedRel = relativeDate(suggestion.created_at)

  return (
    <div className="bg-steel-800 border border-steel-700 rounded-lg p-4 lg:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — snapshot preview (5/12) */}
        <div className="lg:col-span-5">
          <div className="text-[11px] uppercase tracking-wider text-steel-400 mb-2">
            Snapshot preview
          </div>
          <div className="bg-steel-900 border border-steel-700 rounded-md p-3">
            {renderSnapshot(suggestion.snapshot.kind_slug, suggestion.snapshot.content)}
          </div>
        </div>

        {/* MIDDLE — metadata (3/12) */}
        <div className="lg:col-span-3 text-sm">
          <div className="text-[11px] uppercase tracking-wider text-steel-400 mb-2">
            Submission
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-[11px] text-steel-500">Block name</dt>
              <dd className="text-steel-100 font-medium break-words">
                {suggestion.snapshot.name}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-steel-500">Kind</dt>
              <dd className="text-steel-200">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-steel-900 border border-steel-700 text-steel-300">
                  {suggestion.snapshot.kind_slug}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-steel-500">Categories</dt>
              <dd className="text-steel-300 text-xs">
                {suggestion.snapshot.category_tags?.length
                  ? suggestion.snapshot.category_tags.join(', ')
                  : '—'}
              </dd>
            </div>
            {suggestion.snapshot.free_text_tags?.length ? (
              <div>
                <dt className="text-[11px] text-steel-500">Free-text tags</dt>
                <dd className="text-steel-300 text-xs">
                  {suggestion.snapshot.free_text_tags.join(', ')}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[11px] text-steel-500">Suggesting org</dt>
              <dd className="text-steel-300 font-mono text-[11px]">
                {truncId(suggestion.suggested_by_org_id)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-steel-500">Suggested by</dt>
              <dd className="text-steel-300 font-mono text-[11px]">
                {truncId(suggestion.suggested_by_user)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-steel-500">Submitted</dt>
              <dd className="text-steel-300 text-xs">{submittedRel}</dd>
            </div>
          </dl>
        </div>

        {/* RIGHT — decision form (4/12) */}
        <div className="lg:col-span-4">
          <div className="text-[11px] uppercase tracking-wider text-steel-400 mb-2">
            Decision
          </div>
          <label
            htmlFor={`note-${suggestion.id}`}
            className="block text-[11px] text-steel-500 mb-1"
          >
            Decision note (optional)
          </label>
          <textarea
            id={`note-${suggestion.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 'Cleaned up phrasing — promoted as canonical hazard.'"
            rows={3}
            disabled={isPending}
            className="w-full bg-steel-900 border border-steel-700 rounded-md px-3 py-2 text-sm text-steel-100 placeholder:text-steel-500 focus:outline-none focus:border-brand-yellow disabled:opacity-60"
          />

          {error && (
            <p
              role="alert"
              className="text-xs text-red-300 bg-red-950/40 border border-red-700/40 rounded px-2 py-1.5 mt-2"
            >
              {error}
            </p>
          )}
          {toast && (
            <p
              role="status"
              className="text-xs text-green-300 bg-green-950/40 border border-green-700/40 rounded px-2 py-1.5 mt-2"
            >
              {toast}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handlePromote}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-brand-yellow text-steel-900 font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Promote to global
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-steel-900 border border-steel-600 text-steel-200 text-sm hover:bg-red-950/40 hover:border-red-700/40 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncId(value: string | null): string {
  if (!value) return '—'
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diffMs = Date.now() - then
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.round(hr / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Renders the snapshot using worker-facing components when possible.
 * Mirrors BlockPickerPreview from 13-03 for the savable kinds; falls back to a
 * compact JSON dump for kinds that don't have a curated preview yet.
 */
function renderSnapshot(kindSlug: string, content: BlockContent) {
  switch (content.kind) {
    case 'hazard':
      return (
        <HazardCardBlock
          title={kindLabel(kindSlug, 'Hazard')}
          body={content.text}
          severity={content.severity}
        />
      )
    case 'ppe':
      return <PPECardBlock title="PPE Required" items={content.items} />
    case 'step':
      return (
        <div>
          <StepBlock number={1} text={content.text} />
          {content.warning && (
            <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2">
              Warning: {content.warning}
            </div>
          )}
          {content.tip && (
            <div className="mt-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded p-2">
              Tip: {content.tip}
            </div>
          )}
        </div>
      )
    case 'emergency':
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="text-sm font-bold uppercase tracking-widest text-red-400 mb-2">
            Emergency
          </div>
          <p className="text-base text-steel-100 leading-relaxed">{content.text}</p>
          {content.contacts && content.contacts.length > 0 && (
            <ul className="mt-2 text-sm text-steel-300 list-disc pl-5">
              {content.contacts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )
    case 'measurement':
      return (
        <div className="bg-steel-900 border border-steel-700 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-steel-400 mb-1">
            Measurement
          </div>
          <div className="text-base text-steel-100">
            {content.label}{' '}
            <span className="text-steel-400">({content.unit})</span>
          </div>
          {content.hint && (
            <div className="mt-2 text-xs text-steel-400">{content.hint}</div>
          )}
        </div>
      )
    default:
      return (
        <div className="text-xs text-steel-400">
          <div className="text-[11px] uppercase tracking-wider text-steel-500 mb-1">
            Content (kind: {content.kind})
          </div>
          <pre className="bg-steel-900 border border-steel-700 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-steel-300">
            {JSON.stringify(content, null, 2)}
          </pre>
        </div>
      )
  }
}

function kindLabel(kindSlug: string, fallback: string): string {
  if (kindSlug === 'hazard') return 'Hazard'
  if (kindSlug === 'ppe') return 'PPE'
  if (kindSlug === 'step') return 'Step'
  if (kindSlug === 'emergency') return 'Emergency'
  return fallback
}
