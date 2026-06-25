'use client'

/**
 * Phase 23 Plan 23-05 — AFL-VER-02 / D-07: Side-by-side SOP version diff page.
 *
 * Route: /admin/sops/[sopId]/versions/diff?a=<sopAId>&b=<sopBId>
 *
 * Both versions are fetched via getSopVersionForDiff() which uses createAdminClient()
 * internally (RESEARCH Pitfall 5 — superseded versions may be invisible to the session
 * client; diff page is admin-only).
 *
 * Diff is computed CLIENT-SIDE using diffBlockContent() (D-07 reuse) — pure function,
 * no DB calls in the diff loop (RESEARCH anti-pattern: do not SSR diff on every change).
 *
 * NOTE: journeys.ts must reflect the new version/diff flow (see 23-07 same-change task).
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { diffBlockContent } from '@/lib/builder/diff-block-content'
import { getSopVersionForDiff, type SopVersionPayload } from '@/actions/versioning'

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type SectionDiff = {
  sectionTitle: string
  sortOrder: number
  contentChanged: boolean
  oldContent: string | null
  newContent: string | null
  fieldDiffs: Array<{ key: string; oldValue: string; newValue: string; changed: boolean }>
  layoutDiff: { changed: boolean; oldJson: string; newJson: string } | null
}

function computeSectionDiffs(
  sopA: SopVersionPayload,
  sopB: SopVersionPayload
): SectionDiff[] {
  const diffs: SectionDiff[] = []

  // Align sections by sort_order (same ordering assumption as cloneSopAsDraft)
  const maxLen = Math.max(sopA.sections.length, sopB.sections.length)
  for (let i = 0; i < maxLen; i++) {
    const secA = sopA.sections[i] ?? null
    const secB = sopB.sections[i] ?? null

    const title = secA?.title ?? secB?.title ?? `Section ${i + 1}`
    const sortOrder = secA?.sort_order ?? secB?.sort_order ?? i

    // Text content diff
    const oldContent = secA?.content ?? null
    const newContent = secB?.content ?? null
    const contentChanged = oldContent !== newContent

    // layout_data diff — attempt to parse as BlockContent for diffBlockContent
    let fieldDiffs: SectionDiff['fieldDiffs'] = []
    let layoutDiff: SectionDiff['layoutDiff'] = null

    const layoutA = secA?.layout_data
    const layoutB = secB?.layout_data

    if (layoutA !== null || layoutB !== null) {
      const layoutAStr = layoutA ? JSON.stringify(layoutA, null, 2) : ''
      const layoutBStr = layoutB ? JSON.stringify(layoutB, null, 2) : ''

      if (layoutAStr !== layoutBStr) {
        // Try to treat layout_data as BlockContent for rich field diff
        try {
          const blockA = layoutA as Parameters<typeof diffBlockContent>[0]
          const blockB = layoutB as Parameters<typeof diffBlockContent>[0]
          if (
            blockA &&
            blockB &&
            typeof (blockA as { kind?: unknown }).kind === 'string' &&
            typeof (blockB as { kind?: unknown }).kind === 'string'
          ) {
            const diff = diffBlockContent(blockA, blockB)
            fieldDiffs = diff.fields.map(f => ({
              key: f.key,
              oldValue: f.oldValue,
              newValue: f.newValue,
              changed: f.oldValue !== f.newValue,
            }))
          } else {
            layoutDiff = { changed: true, oldJson: layoutAStr, newJson: layoutBStr }
          }
        } catch {
          layoutDiff = { changed: true, oldJson: layoutAStr, newJson: layoutBStr }
        }
      }
    }

    diffs.push({
      sectionTitle: title,
      sortOrder,
      contentChanged,
      oldContent,
      newContent,
      fieldDiffs,
      layoutDiff,
    })
  }

  return diffs
}

function VersionBadge({ sop }: { sop: SopVersionPayload }) {
  const isCurrent = sop.superseded_by === null && sop.status === 'published'
  return isCurrent ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--ink-900)]/20 text-[var(--ink-900)] text-xs font-semibold rounded">
      Current
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 bg-[var(--paper-2)] text-[var(--ink-500)] text-xs font-medium rounded">
      Superseded
    </span>
  )
}

function DiffFieldRow({
  fieldKey,
  oldValue,
  newValue,
  changed,
}: {
  fieldKey: string
  oldValue: string
  newValue: string
  changed: boolean
}) {
  return (
    <div className={[
      'grid grid-cols-2 gap-0 text-xs border-b border-[var(--ink-100)] last:border-b-0',
      changed ? 'bg-amber-50' : '',
    ].join(' ')}>
      <div className="px-3 py-2 border-r border-[var(--ink-100)]">
        <span className="text-[var(--ink-400)] font-mono text-[10px] uppercase tracking-wider block mb-0.5">{fieldKey}</span>
        <span className={['font-mono text-xs whitespace-pre-wrap break-words', changed ? 'text-red-700' : 'text-[var(--ink-700)]'].join(' ')}>
          {oldValue || <span className="text-[var(--ink-300)] italic">empty</span>}
        </span>
      </div>
      <div className="px-3 py-2">
        <span className="text-[var(--ink-400)] font-mono text-[10px] uppercase tracking-wider block mb-0.5">{fieldKey}</span>
        <span className={['font-mono text-xs whitespace-pre-wrap break-words', changed ? 'text-green-700' : 'text-[var(--ink-700)]'].join(' ')}>
          {newValue || <span className="text-[var(--ink-300)] italic">empty</span>}
        </span>
      </div>
    </div>
  )
}

export default function SopVersionDiffPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sopId = params.sopId as string

  const sopAId = searchParams.get('a') ?? ''
  const sopBId = searchParams.get('b') ?? ''

  const [sopA, setSopA] = useState<SopVersionPayload | null>(null)
  const [sopB, setSopB] = useState<SopVersionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sopAId || !sopBId) {
      setError('Missing version IDs. Use ?a=<sopId>&b=<sopId> in the URL.')
      setLoading(false)
      return
    }

    async function loadVersions() {
      setLoading(true)
      setError(null)

      // Fetch both versions via admin client (Pitfall 5 — superseded versions)
      const [resultA, resultB] = await Promise.all([
        getSopVersionForDiff(sopAId),
        getSopVersionForDiff(sopBId),
      ])

      if (!resultA.success) { setError(`Version A error: ${resultA.error}`); setLoading(false); return }
      if (!resultB.success) { setError(`Version B error: ${resultB.error}`); setLoading(false); return }

      setSopA(resultA.sop)
      setSopB(resultB.sop)
      setLoading(false)
    }

    loadVersions()
  }, [sopAId, sopBId])

  // Compute diff client-side (pure — no DB) once both versions are loaded
  const sectionDiffs = sopA && sopB ? computeSectionDiffs(sopA, sopB) : []
  const hasAnyChange = sectionDiffs.some(
    d => d.contentChanged || d.fieldDiffs.some(f => f.changed) || d.layoutDiff?.changed
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/admin/sops/${sopId}/versions`}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-white hover:bg-[var(--paper-2)] transition-colors text-[var(--ink-500)] hover:text-[var(--ink-900)] flex-shrink-0"
          aria-label="Back to version history"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-[var(--ink-900)]">Version Comparison</h1>
          <p className="text-sm text-[var(--ink-500)] mt-0.5">Side-by-side diff of two SOP versions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-[var(--ink-500)]">Loading versions...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : sopA && sopB ? (
        <>
          {/* Version headers */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Version A card */}
            <div className="bg-white border border-[var(--ink-100)] rounded-xl px-4 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-lg font-bold text-[var(--ink-900)]">v{sopA.version}</span>
                <VersionBadge sop={sopA} />
              </div>
              <p className="text-sm text-[var(--ink-700)] font-medium truncate">{sopA.title ?? 'Untitled'}</p>
              <p className="text-xs text-[var(--ink-500)] mt-0.5">Published {formatDate(sopA.published_at)}</p>
              <p className="text-xs text-[var(--ink-300)] mt-1 font-mono truncate">{sopAId}</p>
            </div>

            {/* Version B card */}
            <div className="bg-white border border-[var(--ink-100)] rounded-xl px-4 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-lg font-bold text-[var(--ink-900)]">v{sopB.version}</span>
                <VersionBadge sop={sopB} />
              </div>
              <p className="text-sm text-[var(--ink-700)] font-medium truncate">{sopB.title ?? 'Untitled'}</p>
              <p className="text-xs text-[var(--ink-500)] mt-0.5">Published {formatDate(sopB.published_at)}</p>
              <p className="text-xs text-[var(--ink-300)] mt-1 font-mono truncate">{sopBId}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-4 flex items-center gap-2">
            {hasAnyChange ? (
              <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                Changes detected
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 bg-[var(--accent-signoff)]/10 text-[var(--accent-signoff)] text-xs font-semibold rounded-full">
                No differences found
              </span>
            )}
            <span className="text-xs text-[var(--ink-500)]">{sectionDiffs.length} section{sectionDiffs.length !== 1 ? 's' : ''} compared</span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-2 gap-0 mb-1 px-3">
            <span className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide">Version A (v{sopA.version})</span>
            <span className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide">Version B (v{sopB.version})</span>
          </div>

          {/* Section diffs */}
          <div className="flex flex-col gap-4">
            {sectionDiffs.map((sd, idx) => {
              const hasChanges = sd.contentChanged || sd.fieldDiffs.some(f => f.changed) || sd.layoutDiff?.changed
              return (
                <div
                  key={idx}
                  className={[
                    'bg-white border rounded-xl overflow-hidden',
                    hasChanges ? 'border-amber-200' : 'border-[var(--ink-100)]',
                  ].join(' ')}
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-[var(--paper)]/60 border-b border-[var(--ink-100)]">
                    <span className="text-sm font-semibold text-[var(--ink-900)]">{sd.sectionTitle}</span>
                    {hasChanges && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded uppercase tracking-wide">
                        Changed
                      </span>
                    )}
                  </div>

                  {/* Text content diff */}
                  {(sd.contentChanged || (sd.oldContent !== null || sd.newContent !== null)) && (
                    <DiffFieldRow
                      fieldKey="content"
                      oldValue={sd.oldContent ?? ''}
                      newValue={sd.newContent ?? ''}
                      changed={sd.contentChanged}
                    />
                  )}

                  {/* Field-level diffs (from diffBlockContent) */}
                  {sd.fieldDiffs.length > 0 && sd.fieldDiffs.map(f => (
                    <DiffFieldRow
                      key={f.key}
                      fieldKey={f.key}
                      oldValue={f.oldValue}
                      newValue={f.newValue}
                      changed={f.changed}
                    />
                  ))}

                  {/* Fallback layout JSON diff */}
                  {sd.layoutDiff?.changed && (
                    <DiffFieldRow
                      fieldKey="layout_data"
                      oldValue={sd.layoutDiff.oldJson}
                      newValue={sd.layoutDiff.newJson}
                      changed={true}
                    />
                  )}

                  {/* No changes indicator */}
                  {!hasChanges && (
                    <div className="px-4 py-3 text-xs text-[var(--ink-400)] italic">
                      No changes in this section
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
