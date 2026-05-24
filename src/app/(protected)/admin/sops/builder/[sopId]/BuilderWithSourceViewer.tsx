'use client'

/**
 * Phase 21 (Plan 21-02, Task 3) — Builder + Source Viewer layout shell.
 *
 * Wraps the existing `<BuilderClient>` in a horizontal flex layout that
 * mounts `<SourceViewerPane>` as a persistent right-pane sibling. The
 * pane is dynamic-imported (D-21-09) so neither pdfjs nor mammoth touches
 * the worker `/sops/[sopId]/page` bundle.
 *
 * Selection-sync context (`<SourceViewerSelectionProvider>`) lives at this
 * level so both BuilderClient (left) and SourceViewerPane (right) read /
 * write the same `activeProvenance` state.
 *
 * Backward-compat:
 *   - If `sop.source_file_path` is missing OR `source_type === 'ai_prompt'`,
 *     skip the pane entirely (CONV-12). The builder renders full-width.
 *   - Pre-Phase-20 SOPs with `block_provenance` null on every block: the
 *     provider still mounts but `setActiveProvenance` always receives null
 *     and the pane stays in placeholder mode.
 *
 * Server component: passes the sop row + computed sourceType + transcript
 * segments (for video) into the client wrapper.
 */
import dynamic from 'next/dynamic'
import { BuilderClient } from './BuilderClient'
import {
  SourceViewerSelectionProvider,
} from '@/components/admin/source-viewer/useSelectionSync'
import type { SopWithSections, ParseJob } from '@/types/sop'
import type { SourcePaneKind, TranscriptSegment } from '@/components/admin/source-viewer'

// Dynamic-import the pane — pdfjs + mammoth only load on demand.
// SSR disabled because the pane fetches signed URLs + lazy-loads
// canvas-only deps; rendering server-side would just produce a flicker.
const SourceViewerPane = dynamic(
  () =>
    import('@/components/admin/source-viewer/SourceViewerPane').then(
      (m) => m.SourceViewerPane
    ),
  {
    ssr: false,
    loading: () => (
      <aside
        data-source-pane=""
        data-testid="source-viewer-loading"
        style={{
          width: 520,
          minWidth: 520,
          maxWidth: '50vw',
          height: '100%',
          borderLeft: '1px solid var(--ink-100, #e5e5e5)',
          background: '#fafafa',
        }}
      />
    ),
  }
)

function deriveSourcePaneKind(rawType: string | null | undefined): SourcePaneKind | null {
  if (!rawType) return null
  const v = rawType.toLowerCase()
  if (v === 'pdf') return 'pdf'
  if (v === 'docx' || v === 'doc') return 'docx'
  if (v === 'image' || v === 'scan' || v === 'jpg' || v === 'jpeg' || v === 'png') return 'scan'
  if (v === 'video' || v === 'mp4' || v === 'mov' || v === 'youtube') return 'video'
  return null
}

export type BuilderWithSourceViewerProps = {
  sopId: string
  initialSop: SopWithSections
  parseJob: ParseJob | null
}

export function BuilderWithSourceViewer({
  sopId,
  initialSop,
  parseJob,
}: BuilderWithSourceViewerProps): React.JSX.Element {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawType = (initialSop as any).source_file_type as string | null | undefined
  const sourceType = deriveSourcePaneKind(rawType)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceFilePath = (initialSop as any).source_file_path as string | null | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAiPrompt = ((initialSop as any).source_type ?? rawType) === 'ai_prompt'

  // CONV-12 backward-compat: AI-prompt SOPs or SOPs with no source render
  // the builder full-width. The provider still mounts so any code that
  // calls useSelectionSync() gets the no-op API safely.
  const showPane = !!sourceFilePath && !isAiPrompt && sourceType !== null

  // Video SOPs: extract transcript segments from parse job for the pane.
  const transcriptSegments: TranscriptSegment[] = []
  if (sourceType === 'video' && parseJob) {
    const raw = (parseJob as unknown as { transcript_segments?: unknown }).transcript_segments
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        const r = raw[i] as { id?: string; start?: number; end?: number; text?: string }
        if (
          r &&
          typeof r.start === 'number' &&
          typeof r.end === 'number' &&
          typeof r.text === 'string'
        ) {
          transcriptSegments.push({
            id: r.id ?? `seg_${i}`,
            start: r.start,
            end: r.end,
            text: r.text,
          })
        }
      }
    }
  }

  return (
    <SourceViewerSelectionProvider>
      <div
        data-testid="builder-with-source-viewer"
        style={{ display: 'flex', height: '100vh', minHeight: 0 }}
      >
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <BuilderClient sopId={sopId} initialSop={initialSop} />
        </div>
        {showPane && (
          <SourceViewerPane
            sopId={sopId}
            sourceType={sourceType}
            transcriptSegments={transcriptSegments}
          />
        )}
      </div>
    </SourceViewerSelectionProvider>
  )
}
