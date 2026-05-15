import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import type {
  StructuredBlock,
  StructuredDoc,
  TableBlock,
  TableRow,
  TableCell,
  ParagraphBlock,
  HeadingBlock,
  ListItemBlock,
  CaptionBlock,
  ImageRef,
} from './structural-doc'

/**
 * DOCX → StructuredDoc.
 *
 * Walks the WordprocessingML document tree directly (bypassing mammoth's
 * HTML linearisation) so the table-row containment that anchors images to
 * their step text is preserved. Phase 20 CONV-02 will land the equivalent
 * for PDF / scan / video sources; the StructuredDoc shape is the seam.
 *
 * Image indexes are assigned in document order during the walk and align
 * with the `images: ExtractedImage[]` array returned alongside, so callers
 * can upload images to Storage as today.
 */

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'

export interface ExtractedImage {
  base64: string
  contentType: string
  index: number
}

export interface StructuralExtractionResult {
  doc: StructuredDoc
  images: ExtractedImage[]
}

// Header keywords that mark a procedural table. Case-insensitive match.
const PROCEDURAL_STEP_HEADERS = [
  'step instruction',
  'step standard instruction',
  'standard instruction',
  'instruction',
]
const PROCEDURAL_IMAGE_HEADERS = ['images', 'standard images', 'image']
const PROCEDURAL_COMMENT_HEADERS = ['images & comments', 'comments', 'plant specific']

type RelationshipMap = Map<
  string,
  { target: string; type: string }
>

export async function extractDocxStructural(
  buffer: ArrayBuffer | Buffer
): Promise<StructuralExtractionResult> {
  const buf =
    buffer instanceof Buffer
      ? buffer
      : Buffer.from(new Uint8Array(buffer as ArrayBuffer))
  const zip = await JSZip.loadAsync(buf)

  const documentXml = await readXml(zip, 'word/document.xml')
  const relsXml = await readXml(zip, 'word/_rels/document.xml.rels').catch(() => null)

  const warnings: string[] = []
  const parser = new DOMParser({
    errorHandler: {
      warning: (msg: string) => warnings.push(`xml-warn: ${msg}`),
      error: (msg: string) => warnings.push(`xml-error: ${msg}`),
      fatalError: (msg: string) => {
        throw new Error(`docx xml parse failed: ${msg}`)
      },
    },
  })

  const doc = parser.parseFromString(documentXml, 'text/xml')
  const rels = relsXml
    ? parser.parseFromString(relsXml, 'text/xml')
    : null
  const relationships = buildRelationshipMap(rels)

  // Load all media blobs up-front. mapped by relationship id → buffer + content-type.
  const mediaCache = await buildMediaCache(zip, relationships)

  // Walk the body. Track image extraction in document order so blocks' image
  // indexes match the `images[]` array returned to the caller.
  const body = doc.getElementsByTagNameNS(NS_W, 'body').item(0)
  if (!body) throw new Error('docx body element missing')

  const ctx: WalkCtx = {
    blocks: [],
    images: [],
    imageRefs: [],
    relationships,
    mediaCache,
    paraIdCounter: 0,
    warnings,
    tableCounter: 0,
  }

  walkChildren(body, ctx, { depth: 0, inTable: false })

  // Stats
  const tableCount = ctx.blocks.filter((b) => b.kind === 'table').length
  const proceduralTableCount = ctx.blocks.filter(
    (b) => b.kind === 'table' && b.isProcedural
  ).length

  let imagesInTables = 0
  let imagesOutsideTables = 0
  for (const b of ctx.blocks) {
    if (b.kind === 'table') {
      for (const row of b.rows) {
        for (const cell of row.cells) imagesInTables += cell.images.length
      }
    } else if (b.kind === 'paragraph' || b.kind === 'listItem') {
      imagesOutsideTables += b.images.length
    }
  }

  const structuredDoc: StructuredDoc = {
    blocks: ctx.blocks,
    imageRefs: ctx.imageRefs,
    warnings: ctx.warnings,
    stats: {
      blockCount: ctx.blocks.length,
      tableCount,
      proceduralTableCount,
      imageCount: ctx.images.length,
      imagesInTables,
      imagesOutsideTables,
    },
  }

  return { doc: structuredDoc, images: ctx.images }
}

// ---------------------------------------------------------------------------
// Walker
// ---------------------------------------------------------------------------

interface WalkCtx {
  blocks: StructuredBlock[]
  images: ExtractedImage[]
  imageRefs: ImageRef[]
  relationships: RelationshipMap
  mediaCache: Map<string, { base64: string; contentType: string }>
  paraIdCounter: number
  warnings: string[]
  tableCounter: number
}

interface WalkOpts {
  depth: number
  inTable: boolean
}

function walkChildren(parent: Element, ctx: WalkCtx, opts: WalkOpts): void {
  const children = parent.childNodes
  for (let i = 0; i < children.length; i++) {
    const node = children.item(i)
    if (node?.nodeType !== 1 /* ELEMENT_NODE */) continue
    const el = node as Element
    if (el.namespaceURI !== NS_W) continue

    const local = el.localName
    if (local === 'p') {
      handleParagraph(el, ctx, opts)
    } else if (local === 'tbl') {
      // Only emit Table blocks at top level. Nested tables (rare) collapse
      // to text within the parent cell during cell-text extraction.
      if (!opts.inTable) {
        handleTable(el, ctx)
      }
    } else if (local === 'sdt') {
      // Structured Document Tag wrapper — descend into <w:sdtContent>.
      const content = el.getElementsByTagNameNS(NS_W, 'sdtContent').item(0)
      if (content) walkChildren(content as Element, ctx, opts)
    }
    // Other elements (sectPr, bookmarkStart/End, permStart, etc.) ignored.
  }
}

// ---------------------------------------------------------------------------
// Paragraph handler
// ---------------------------------------------------------------------------

function handleParagraph(el: Element, ctx: WalkCtx, opts: WalkOpts): void {
  const paraId = paragraphId(el, ctx)
  const text = paragraphText(el)
  const images = extractImageRefsIn(el, ctx)
  const pStyle = getPStyle(el)
  const numPr = el.getElementsByTagNameNS(NS_W, 'numPr').item(0) as Element | null

  // Empty paragraph with no images → skip (whitespace).
  if (!text && images.length === 0) return

  // Caption style → caption block.
  if (pStyle && /caption/i.test(pStyle)) {
    const forImage = images[0] ?? null
    const block: CaptionBlock = {
      kind: 'caption',
      text,
      forImage,
      paragraphId: paraId,
    }
    ctx.blocks.push(block)
    return
  }

  // Heading style → heading block. Detect by pStyle starting with "Heading"
  // followed by a digit (Heading1, Heading2, etc.). Falls through to paragraph
  // when style is absent.
  if (pStyle) {
    const headingMatch = /^heading\s*(\d)/i.exec(pStyle)
    if (headingMatch) {
      const level = Math.min(6, Math.max(1, parseInt(headingMatch[1], 10))) as 1 | 2 | 3 | 4 | 5 | 6
      const block: HeadingBlock = {
        kind: 'heading',
        text,
        level,
        paragraphId: paraId,
      }
      ctx.blocks.push(block)
      return
    }
    if (/^title$/i.test(pStyle)) {
      const block: HeadingBlock = {
        kind: 'heading',
        text,
        level: 1,
        paragraphId: paraId,
      }
      ctx.blocks.push(block)
      return
    }
  }

  // Numbered or bullet list item.
  if (numPr) {
    const ilvl = numPr.getElementsByTagNameNS(NS_W, 'ilvl').item(0) as Element | null
    const depthRaw = ilvl?.getAttribute('w:val') ?? '0'
    const depth = Math.min(8, Math.max(0, parseInt(depthRaw, 10) || 0))
    // Without resolving numbering.xml we can't tell bullet vs decimal precisely.
    // GPT only uses this as a soft hint, so 'unknown' is fine for the v1 contract.
    const block: ListItemBlock = {
      kind: 'listItem',
      text,
      depth,
      numbering: 'unknown',
      images,
      paragraphId: paraId,
    }
    ctx.blocks.push(block)
    return
  }

  // Default: paragraph.
  const block: ParagraphBlock = {
    kind: 'paragraph',
    text,
    images,
    paragraphId: paraId,
  }
  ctx.blocks.push(block)
}

// ---------------------------------------------------------------------------
// Table handler
// ---------------------------------------------------------------------------

function handleTable(el: Element, ctx: WalkCtx): void {
  const tableIndex = ctx.tableCounter++
  const tableParaId = `tbl-${tableIndex}`
  const rows: TableRow[] = []
  const rowEls = el.getElementsByTagNameNS(NS_W, 'tr')
  for (let r = 0; r < rowEls.length; r++) {
    const rowEl = rowEls.item(r) as Element
    // Skip <w:tr> nodes that belong to a NESTED table (their .parentNode
    // chain has another <w:tbl> before reaching `el`). DOM getElementsByTagNameNS
    // returns descendants, not just direct children.
    if (!isDirectRowOf(rowEl, el)) continue

    const cellEls = rowEl.getElementsByTagNameNS(NS_W, 'tc')
    const cells: TableCell[] = []
    for (let c = 0; c < cellEls.length; c++) {
      const cellEl = cellEls.item(c) as Element
      if (!isDirectCellOf(cellEl, rowEl)) continue
      const cellText = paragraphText(cellEl)
      const cellImages = extractImageRefsIn(cellEl, ctx)
      const cell: TableCell = {
        colIndex: cells.length,
        text: cellText,
        images: cellImages,
      }
      cells.push(cell)
    }

    rows.push({
      rowIndex: rows.length,
      isHeader: rows.length === 0, // best-effort; w:tblHeader could refine this
      cells,
    })
  }

  // Detect procedural table by header row content.
  let isProcedural = false
  let roleHint: TableBlock['roleHint'] = null
  if (rows.length > 0) {
    const headerCells = rows[0].cells
    let stepCol: number | null = null
    let imagesCol: number | null = null
    let commentsCol: number | null = null
    for (const c of headerCells) {
      const t = c.text.toLowerCase().trim()
      if (stepCol === null && PROCEDURAL_STEP_HEADERS.some((h) => t.includes(h))) {
        stepCol = c.colIndex
      } else if (imagesCol === null && PROCEDURAL_IMAGE_HEADERS.some((h) => t === h)) {
        imagesCol = c.colIndex
      } else if (commentsCol === null && PROCEDURAL_COMMENT_HEADERS.some((h) => t.includes(h))) {
        commentsCol = c.colIndex
      }
    }
    if (stepCol !== null && imagesCol !== null) {
      isProcedural = true
      roleHint = { stepCol, imagesCol, commentsCol }
    }
  }

  const block: TableBlock = {
    kind: 'table',
    tableIndex,
    rows,
    isProcedural,
    roleHint,
    paragraphId: tableParaId,
  }
  ctx.blocks.push(block)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paragraphId(el: Element, ctx: WalkCtx): string {
  // <w14:paraId> is the native id; fall back to a synthesised counter.
  const w14Id = el.getAttribute('w14:paraId')
  if (w14Id) return `p14-${w14Id}`
  ctx.paraIdCounter++
  return `p-${ctx.paraIdCounter}`
}

function getPStyle(el: Element): string | null {
  const pPr = el.getElementsByTagNameNS(NS_W, 'pPr').item(0) as Element | null
  if (!pPr) return null
  // pStyle is a direct child of pPr.
  const children = pPr.childNodes
  for (let i = 0; i < children.length; i++) {
    const c = children.item(i)
    if (c?.nodeType === 1) {
      const ce = c as Element
      if (ce.namespaceURI === NS_W && ce.localName === 'pStyle') {
        return ce.getAttribute('w:val')
      }
    }
  }
  return null
}

function paragraphText(scope: Element): string {
  // Collect <w:t> text nodes in document order WITHIN this paragraph or cell.
  // Multiple paragraphs inside a cell concatenate with a space separator.
  const ts = scope.getElementsByTagNameNS(NS_W, 't')
  let out = ''
  for (let i = 0; i < ts.length; i++) {
    out += ts.item(i)?.textContent ?? ''
    out += ' '
  }
  return out.replace(/\s+/g, ' ').trim()
}

function extractImageRefsIn(scope: Element, ctx: WalkCtx): number[] {
  const blips = scope.getElementsByTagNameNS(NS_A, 'blip')
  const localIndexes: number[] = []
  for (let i = 0; i < blips.length; i++) {
    const blip = blips.item(i) as Element
    const embedId = blip.getAttribute('r:embed')
    if (!embedId) continue
    const media = ctx.mediaCache.get(embedId)
    if (!media) {
      ctx.warnings.push(`unresolved image relationship: ${embedId}`)
      continue
    }
    // Look up alt text from the enclosing <wp:docPr descr="..."> if present.
    const altText = findDocPrDescr(blip)
    const index = ctx.images.length
    ctx.images.push({
      base64: media.base64,
      contentType: media.contentType,
      index,
    })
    ctx.imageRefs.push({ index, altText })
    localIndexes.push(index)
  }
  return localIndexes
}

function findDocPrDescr(blipEl: Element): string | null {
  // Walk up until we find a <wp:docPr> sibling — typically inside the same
  // <wp:inline> or <wp:anchor> drawing wrapper.
  let node: Node | null = blipEl
  for (let i = 0; i < 8 && node; i++) {
    node = node.parentNode
    if (node?.nodeType !== 1) continue
    const el = node as Element
    if (el.namespaceURI === NS_WP && (el.localName === 'inline' || el.localName === 'anchor')) {
      const docPr = el.getElementsByTagNameNS(NS_WP, 'docPr').item(0) as Element | null
      const descr = docPr?.getAttribute('descr')
      return descr && descr.trim() ? descr.trim() : null
    }
  }
  return null
}

function isDirectRowOf(rowEl: Element, tableEl: Element): boolean {
  // Walk up from rowEl; the FIRST ancestor <w:tbl> must be tableEl.
  let node: Node | null = rowEl.parentNode
  while (node) {
    if (node.nodeType === 1) {
      const el = node as Element
      if (el.namespaceURI === NS_W && el.localName === 'tbl') {
        return el === tableEl
      }
    }
    node = node.parentNode
  }
  return false
}

function isDirectCellOf(cellEl: Element, rowEl: Element): boolean {
  let node: Node | null = cellEl.parentNode
  while (node) {
    if (node.nodeType === 1) {
      const el = node as Element
      if (el.namespaceURI === NS_W && el.localName === 'tr') {
        return el === rowEl
      }
    }
    node = node.parentNode
  }
  return false
}

async function readXml(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path)
  if (!file) throw new Error(`docx is missing ${path}`)
  return await file.async('string')
}

function buildRelationshipMap(relsDoc: Document | null): RelationshipMap {
  const map: RelationshipMap = new Map()
  if (!relsDoc) return map
  const rels = relsDoc.getElementsByTagName('Relationship')
  for (let i = 0; i < rels.length; i++) {
    const r = rels.item(i)
    const id = r?.getAttribute('Id')
    const target = r?.getAttribute('Target') ?? ''
    const type = r?.getAttribute('Type') ?? ''
    if (id) map.set(id, { target, type })
  }
  return map
}

async function buildMediaCache(
  zip: JSZip,
  relationships: RelationshipMap
): Promise<Map<string, { base64: string; contentType: string }>> {
  const cache = new Map<string, { base64: string; contentType: string }>()
  for (const [id, { target, type }] of relationships) {
    if (!/image/i.test(type)) continue
    const path = resolveRelTarget(target)
    const file = zip.file(path)
    if (!file) continue
    const base64 = await file.async('base64')
    const contentType = inferContentType(path)
    cache.set(id, { base64, contentType })
  }
  return cache
}

function resolveRelTarget(target: string): string {
  // Targets are usually `media/image1.png` relative to `word/`.
  if (target.startsWith('/')) return target.slice(1)
  return `word/${target}`
}

function inferContentType(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.emf')) return 'image/x-emf'
  if (lower.endsWith('.wmf')) return 'image/x-wmf'
  return 'application/octet-stream'
}
