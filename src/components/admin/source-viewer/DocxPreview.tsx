'use client'

/**
 * Phase 21 (Plan 21-02, Task 2) — DOCX source renderer.
 *
 * Fetches the signed DOCX URL, runs mammoth's browser-safe
 * `convertToHtml({arrayBuffer})` to get an HTML string, post-processes the
 * markup to inject `data-paragraph-id="p_<index>"` on each top-level
 * paragraph so the selection-sync layer can scroll the matching paragraph
 * into view + apply a 2-second yellow underline when the builder canvas
 * selects a block with a docx provenance.
 *
 * Paragraph ID contract — mirrors `extract-docx-paragraph.ts` paragraph_id
 * shape (`p_0`, `p_1`, …) — the parser writes paragraph_id during ingest
 * and this UI reads it back from `region.paragraph_id`.
 *
 * Reverse-channel: clicking on a paragraph calls `onSourceClick(paragraphId)`
 * so the builder canvas can highlight the block whose provenance points to
 * that paragraph (SCP-VIEWER-03).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelectionSync } from './useSelectionSync'

export type DocxPreviewProps = {
  /** Signed-URL pointer to the DOCX file. */
  url: string
  className?: string
}

const HIGHLIGHT_MS = 2000

export function DocxPreview({ url, className }: DocxPreviewProps): React.JSX.Element {
  const [html, setHtml] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { activeProvenance, onSourceClick } = useSelectionSync()

  // 1. Fetch + convert. mammoth is browser-safe via its bundled ESM build
  //    (already a project dep). Idempotent: cancel if unmounted mid-flight.
  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`fetch ${res.status}`)
        const buf = await res.arrayBuffer()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mammoth = (await import('mammoth')) as any
        const result = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (cancelled) return
        setHtml(injectParagraphIds(result.value as string))
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [url])

  // 2. When activeProvenance points at this docx, scroll and highlight.
  const activeParagraphId = useMemo(() => {
    if (!activeProvenance || activeProvenance.kind !== 'docx') return null
    return activeProvenance.paragraph_id
  }, [activeProvenance])

  useEffect(() => {
    if (!activeParagraphId || !containerRef.current) return
    const el = containerRef.current.querySelector<HTMLElement>(
      `[data-paragraph-id="${cssEscape(activeParagraphId)}"]`
    )
    if (!el) return
    // Scroll + highlight in next frame so paint is one tick.
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'auto', block: 'center' })
      el.classList.add('sv-docx-active')
    })
    const timeout = setTimeout(() => {
      el.classList.remove('sv-docx-active')
    }, HIGHLIGHT_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timeout)
      el.classList.remove('sv-docx-active')
    }
  }, [activeParagraphId])

  // 3. Reverse channel: click on a paragraph → fire onSourceClick with its id.
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    function handleClick(e: MouseEvent) {
      let node = e.target as HTMLElement | null
      while (node && node !== container) {
        const pid = node.getAttribute?.('data-paragraph-id')
        if (pid) {
          onSourceClick(pid)
          return
        }
        node = node.parentElement
      }
    }
    container.addEventListener('click', handleClick)
    return () => {
      container.removeEventListener('click', handleClick)
    }
  }, [onSourceClick, html])

  return (
    <div className={className}>
      <style>{`
        .sv-docx-root p, .sv-docx-root h1, .sv-docx-root h2, .sv-docx-root h3,
        .sv-docx-root h4, .sv-docx-root li, .sv-docx-root td {
          cursor: pointer;
        }
        .sv-docx-active {
          background-color: rgba(250, 204, 21, 0.25);
          box-shadow: inset 0 -2px 0 0 #facc15;
          transition: background-color 0.2s ease-in-out;
        }
      `}</style>
      {loadError && (
        <div style={{ padding: 16, fontSize: 12, color: '#7a1d1d' }}>
          source unavailable: {loadError}
        </div>
      )}
      {!html && !loadError && (
        <div style={{ padding: 16, fontSize: 12, color: '#666' }}>loading source…</div>
      )}
      {html && (
        <div
          ref={containerRef}
          className="sv-docx-root"
          // Mammoth output is escaped HTML from the user's own DOCX upload;
          // pdfjs trust boundary (T-21-02-02) applies — admin uploaded this
          // file themselves. Same trust posture as the legacy OriginalDocViewer.
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            padding: '16px 20px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            lineHeight: 1.55,
            color: '#1a1a1a',
            background: '#ffffff',
          }}
        />
      )}
    </div>
  )
}

/**
 * Inject sequential `data-paragraph-id` attributes onto top-level paragraph-
 * bearing elements in the mammoth output. Sequence matches
 * `extractDocxParagraphAnchors`: index ordering over heading / paragraph /
 * listItem / caption / table-cell blocks.
 *
 * Implementation uses DOMParser so we don't bring in cheerio or similar.
 */
function injectParagraphIds(html: string): string {
  if (typeof window === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<root>${html}</root>`, 'text/html')
  // text/html wraps the fragment in <html><body><root>…</root></body></html>;
  // grab our root container.
  const root = doc.querySelector('root')
  if (!root) return html
  // Walk top-level paragraph-ish elements in document order. Tables get one
  // anchor per cell to mirror extract-docx-paragraph.ts.
  let idx = 0
  function tagIfBlock(node: Element) {
    const tag = node.tagName.toLowerCase()
    if (tag === 'table') {
      const cells = node.querySelectorAll('td, th')
      cells.forEach((cell) => {
        cell.setAttribute('data-paragraph-id', `p_${idx++}`)
      })
      return
    }
    if (
      tag === 'p' ||
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'h5' ||
      tag === 'h6' ||
      tag === 'li'
    ) {
      node.setAttribute('data-paragraph-id', `p_${idx++}`)
    }
  }
  Array.from(root.children).forEach((child) => {
    tagIfBlock(child)
    // Lists: also walk children of <ul>/<ol> so each <li> gets its own id.
    if (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol') {
      child.querySelectorAll(':scope > li').forEach((li) => {
        li.setAttribute('data-paragraph-id', `p_${idx++}`)
      })
    }
  })
  return root.innerHTML
}

/**
 * Minimal CSS.escape fallback for older runtimes. We only need to handle
 * the characters extract-docx-paragraph.ts produces (`p_0`, table cell
 * ids like `p_3::r0c1`) — but `::` is a CSS pseudo-element marker so we
 * must escape colons.
 */
function cssEscape(s: string): string {
  if (typeof window !== 'undefined' && typeof (window as unknown as { CSS?: { escape?: (v: string) => string } }).CSS?.escape === 'function') {
    return (window as unknown as { CSS: { escape: (v: string) => string } }).CSS.escape(s)
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
}
