'use client'

/**
 * Phase 21 (Plan 21-02, Task 2) — Persistent right-pane source viewer.
 *
 * Renders the original uploaded source document (PDF, DOCX, scan, or video)
 * alongside the builder canvas. Used inside `BuilderWithSourceViewer` —
 * NEVER mounted on a worker route (D-21-09).
 *
 * Hard requirements:
 *   - NO close button. The collapse toggle reduces width to 32px but the
 *     pane remains mounted (SCP-VIEWER-04, anti-pattern protection).
 *   - All four format renderers (PdfCanvasPage, DocxPreview, scan <img>,
 *     VideoSourcePreview) live behind one component family — same outer
 *     shell, discriminated child by `sourceType`.
 *   - Pane subscribes to `useSelectionSync()` indirectly via child
 *     renderers — the provider is mounted at the layout level
 *     (BuilderWithSourceViewer), not here.
 *
 * Source-URL fetching uses TanStack Query (project pattern; QueryProvider
 * is already mounted at `(protected)/layout.tsx`).
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, FileImage, Video, FileType2 } from 'lucide-react'
import { PdfCanvasPage } from './PdfCanvasPage'
import { DocxPreview } from './DocxPreview'
import { VideoSourcePreview, type TranscriptSegment } from './VideoSourcePreview'
import { BboxOverlayStyles } from './BboxOverlay'
import type { SourcePaneKind, SourceUrlResponse } from './types'

export type SourceViewerPaneProps = {
  sopId: string
  /** Initial render type — pane refines from server response when it arrives. */
  sourceType: SourcePaneKind | null
  /**
   * Optional pre-fetched transcript segments for video SOPs. The pane does
   * not own transcript persistence — Phase 6 owns the upstream parse_jobs
   * row. If `sourceType === 'video'` and segments are not supplied, the
   * transcript pane renders "no transcript available".
   */
  transcriptSegments?: TranscriptSegment[]
  /** Number of PDF pages to render eagerly. Defaults to 50 (Spike 002 finding #2). */
  eagerPageCount?: number
  className?: string
}

const EAGER_PAGE_LIMIT = 50
const COLLAPSED_WIDTH = 32
const EXPANDED_WIDTH = 520

async function fetchSourceUrl(sopId: string): Promise<SourceUrlResponse> {
  const res = await fetch(`/api/sops/${sopId}/source-url`, {
    credentials: 'include',
  })
  if (!res.ok) {
    if (res.status === 410) {
      return { url: null, expires_at: null, source_type: null }
    }
    throw new Error(`source-url ${res.status}`)
  }
  return (await res.json()) as SourceUrlResponse
}

export function SourceViewerPane({
  sopId,
  sourceType,
  transcriptSegments = [],
  eagerPageCount = EAGER_PAGE_LIMIT,
  className,
}: SourceViewerPaneProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['source-url', sopId],
    queryFn: () => fetchSourceUrl(sopId),
    // Refresh URL well before its 5-min TTL so an open pane doesn't hit a
    // dead link mid-review. 4-min stale-time → React Query refetches on
    // window focus / interval ticks past 4 min.
    staleTime: 4 * 60 * 1000,
    // Disable when the parent already determined this SOP has no source
    // (saves a 200 round-trip and keeps the pane in placeholder mode).
    enabled: sourceType !== null,
  })

  const effectiveType = data?.source_type ?? sourceType
  const sourceUrl = data?.url ?? null

  return (
    <aside
      data-source-pane=""
      data-testid="source-viewer"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-source-type={effectiveType ?? 'none'}
      className={className}
      style={{
        width: collapsed ? `${COLLAPSED_WIDTH}px` : `${EXPANDED_WIDTH}px`,
        minWidth: collapsed ? `${COLLAPSED_WIDTH}px` : `${EXPANDED_WIDTH}px`,
        maxWidth: collapsed ? `${COLLAPSED_WIDTH}px` : '50vw',
        height: '100%',
        borderLeft: '1px solid var(--ink-100, #e5e5e5)',
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        transition: 'width 160ms ease-out, min-width 160ms ease-out',
        overflow: 'hidden',
      }}
    >
      <BboxOverlayStyles />
      {/* Header — collapse toggle + source-type badge. NO close button. */}
      <header
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid var(--ink-100, #e5e5e5)',
          fontSize: 11,
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--ink-700, #444)',
          background: '#ffffff',
        }}
      >
        <button
          type="button"
          data-testid="source-viewer-toggle"
          aria-label={collapsed ? 'Expand source viewer' : 'Collapse source viewer'}
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            color: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        {!collapsed && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <SourceTypeIcon kind={effectiveType} /> Source ·{' '}
            {effectiveType ?? 'none'}
          </span>
        )}
      </header>

      {/* Body */}
      {!collapsed && (
        <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: 8 }}>
          {sourceType === null && (
            <Placeholder text="No source document attached to this SOP." />
          )}
          {sourceType !== null && isLoading && <Placeholder text="Loading source…" />}
          {sourceType !== null && isError && (
            <Placeholder text="Source unavailable. Try reloading the page." />
          )}
          {effectiveType !== null && !isLoading && !isError && sourceUrl === null && (
            <Placeholder text="Source file is missing from storage." />
          )}
          {effectiveType === 'pdf' && sourceUrl && (
            <PdfBody url={sourceUrl} eagerPageCount={eagerPageCount} />
          )}
          {effectiveType === 'docx' && sourceUrl && <DocxPreview url={sourceUrl} />}
          {effectiveType === 'scan' && sourceUrl && (
            <img
              src={sourceUrl}
              alt="Source scan"
              data-testid="source-viewer-scan"
              style={{ width: '100%', display: 'block' }}
            />
          )}
          {effectiveType === 'video' && (
            <VideoSourcePreview url={sourceUrl} segments={transcriptSegments} />
          )}
        </div>
      )}
    </aside>
  )
}

function SourceTypeIcon({ kind }: { kind: SourcePaneKind | null }) {
  if (kind === 'pdf') return <FileText size={12} />
  if (kind === 'docx') return <FileType2 size={12} />
  if (kind === 'scan') return <FileImage size={12} />
  if (kind === 'video') return <Video size={12} />
  return null
}

function Placeholder({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      data-testid="source-viewer-placeholder"
      style={{
        padding: 16,
        fontSize: 12,
        color: 'var(--ink-500, #666)',
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  )
}

/**
 * PDF body — fetches numPages once (via a lightweight pdfjs head load) and
 * mounts one `<PdfCanvasPage>` per page up to `eagerPageCount`. Pages
 * beyond the eager limit are rendered as placeholders that hydrate on
 * intersection (deferred).
 *
 * For v1 we use the same pdfjs module that PdfCanvasPage caches — the
 * import lives in PdfCanvasPage to keep the dynamic-import boundary on
 * one module (D-21-09 isolation).
 */
function PdfBody({ url, eagerPageCount }: { url: string; eagerPageCount: number }) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function discover() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = (await import('pdfjs-dist')) as any
        const doc = await mod.getDocument({ url, disableFontFace: true }).promise
        if (!cancelled) setNumPages(doc.numPages as number)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void discover()
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) return <Placeholder text={`Cannot read PDF: ${error}`} />
  if (numPages === null) return <Placeholder text="Reading PDF…" />

  const eagerPages = Math.min(numPages, eagerPageCount)
  const overflow = numPages - eagerPages

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from({ length: eagerPages }, (_, i) => (
        <PdfCanvasPage key={i + 1} url={url} page={i + 1} />
      ))}
      {overflow > 0 && (
        <div
          style={{
            padding: 12,
            fontSize: 11,
            color: 'var(--ink-500, #666)',
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          {overflow} more page{overflow === 1 ? '' : 's'} (open original to view)
        </div>
      )}
    </div>
  )
}
