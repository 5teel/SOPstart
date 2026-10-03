/**
 * SOP converter (Phase 56, SOP-01): layout_data / sop_steps rows -> kinded
 * focus steps (hazard | ppe | step | check).
 *
 * Plain module: no React, no Supabase, no write path. It computes; the runner
 * (scripts/convert-sops-to-steps.ts) reads and, from 56-07, writes.
 *
 * Why not the existing block-content converters: the lenient one returns null (silently
 * drops a hazard with an empty body, and drops measurement tolerance); the
 * strict one throws and would abort a whole SOP. Each reader here returns an
 * explicit `unreadable` instead, so a hazard/PPE item can never vanish
 * quietly, and checkGate() turns any such loss into a per-SOP failure.
 *
 * Section kinds come ONLY from isHazardSection / isPpeSection (CLAUDE.md
 * 2026-09-27) — never a private keyword list here.
 */
import { createHash } from 'node:crypto'
import { isHazardSection, isPpeSection, type Section } from '@/lib/sop/sections'

export const CONVERTER_VERSION = 1

export type StepKind = 'hazard' | 'ppe' | 'step' | 'check'

/** Field names map 1:1 to the sop_focus_steps columns (snake_case there). */
export interface FocusStepDraft {
  sectionId: string
  kind: StepKind
  text: string
  tip: string | null
  photoRequired: boolean
  imagePaths: string[]
  requiredTools: string[] | null
  timeEstimateMinutes: number | null
  sortOrder: number
  sourceKey: string
}

export interface SourceCounts {
  hazardSources: number
  ppeSources: number
  ppeItems: string[]
  byType: Record<string, number>
  tipsFolded: number
  voiceDropped: number
  videoDropped: number
  emptyDropped: number
  images: number
  imagesMatched: number
  missingIds: number
  unreadable: string[]
}

export interface AfterCounts {
  hazard: number
  ppe: number
  step: number
  check: number
  photoRequired: number
  imagePaths: number
}

export interface SopConversion {
  sopId: string
  source: 'layout' | 'rows' | 'mixed' | 'empty'
  steps: FocusStepDraft[]
  before: SourceCounts
  after: AfterCounts
  gate: { ok: boolean; failures: string[] }
  hash: string
}

/** What a reader produces. `sourceKey` here is only a SUFFIX ('' main, ':w' generated hazard). */
type ReadStep = Omit<FocusStepDraft, 'sectionId' | 'sortOrder'>
export interface ReadResult {
  steps: ReadStep[]
  dropped?: 'voice' | 'video' | 'empty'
  unreadable?: string
}

type Props = Record<string, unknown>
type Item = { type?: unknown; props?: unknown }

// ---------------------------------------------------------------- helpers

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const rec = (v: unknown): Props => (v && typeof v === 'object' ? (v as Props) : {})
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** Not http(s), data: or blob: — i.e. a Supabase storage path (same test as sign-layout-data-images). */
function rawPath(s: unknown): string | null {
  return typeof s === 'string' && s.length > 0 && !/^https?:/i.test(s) && !s.startsWith('data:') && !s.startsWith('blob:')
    ? s
    : null
}

function draft(kind: StepKind, text: string, extra: Partial<ReadStep> = {}): ReadStep {
  return {
    kind,
    text,
    tip: null,
    photoRequired: false,
    imagePaths: [],
    requiredTools: null,
    timeEstimateMinutes: null,
    sourceKey: '',
    ...extra,
  }
}

const empty = (): ReadResult => ({ steps: [], dropped: 'empty' })
const one = (kind: StepKind, text: string, extra?: Partial<ReadStep>): ReadResult =>
  text ? { steps: [draft(kind, text, extra)] } : empty()

/** Default kind for free text, from the shared classifier (D-04). */
function sectionDefaultKind(section: Section): StepKind {
  if (isPpeSection(section)) return 'ppe'
  if (isHazardSection(section)) return 'hazard'
  return 'step'
}

export type CalloutRole = 'warning' | 'caution' | 'tip' | 'other'
function calloutRole(p: Props): CalloutRole {
  const t = str(p.title).toLowerCase()
  return t === 'warning' || t === 'caution' || t === 'tip' ? t : 'other'
}

/** PPE items arrive as string or { item } (puck-to-block-content idiom). */
function ppeItemsOf(p: Props): string[] {
  return arr(p.items)
    .map((x) => (typeof x === 'string' ? x : str(rec(x).item)))
    .map((s) => s.trim())
    .filter(Boolean)
}

const labelsOf = (items: unknown[]): string[] =>
  items.map((x) => (typeof x === 'string' ? x.trim() : str(rec(x).label))).filter(Boolean)

const captionsOf = (items: unknown[]): string[] =>
  items.map((x) => str(rec(x).caption) || str(rec(x).alt)).filter(Boolean)

// ---------------------------------------------------------------- readers

type Reader = (p: Props, section: Section) => ReadResult

const READERS: Record<string, Reader> = {
  HazardCardBlock: (p) => {
    const body = str(p.body)
    const title = str(p.title)
    const titled = title && !['hazard', 'untitled hazard'].includes(title.toLowerCase())
    if (!body && !titled) return { steps: [], unreadable: 'hazard card has no text' }
    const text = `${p.severity === 'critical' ? 'Critical: ' : ''}${titled && body ? `${title}: ` : ''}${body || title}`
    return one('hazard', text)
  },

  PPECardBlock: (p) => {
    const title = str(p.title)
    const items = ppeItemsOf(p)
    const head = title && title.toLowerCase() !== 'ppe required' ? [title] : []
    if (head.length === 0 && items.length === 0) return { steps: [], unreadable: 'PPE card has no items' }
    return one('ppe', [...head, ...items].join('\n'))
  },

  StepBlock: (p) => {
    const text = str(p.text)
    const warning = str(p.warning)
    const steps: ReadStep[] = []
    if (warning) steps.push(draft('hazard', `Warning: ${warning}`, { sourceKey: ':w' }))
    if (text) steps.push(draft('step', text, { tip: str(p.tip) || null }))
    return steps.length ? { steps } : empty()
  },

  StepWithPhotosBlock: (p) => {
    const paths = arr(p.photos).map((x) => rawPath(rec(x).src)).filter((s): s is string => !!s)
    return one('step', str(p.text) || captionsOf(arr(p.photos)).join('; ') || 'Take a photo', {
      photoRequired: true,
      imagePaths: paths,
    })
  },

  MeasurementBlock: (p) => {
    const label = str(p.label)
    if (!label) return empty()
    const unit = str(p.unit)
    const tol = rec(p.tolerance)
    const min = num(tol.min)
    const max = num(tol.max)
    const target = num(tol.target)
    const range =
      min !== undefined && max !== undefined ? `${min}–${max}` : min !== undefined ? `at least ${min}` : max !== undefined ? `at most ${max}` : ''
    let text = `Check ${label}`
    if (range) text += `: ${range}${unit ? ` ${unit}` : ''}`
    else if (unit) text += ` (${unit})`
    if (target !== undefined) text += `, target ${target}${unit ? ` ${unit}` : ''}`
    if (str(p.hint)) text += `. ${str(p.hint)}`
    return one('check', text)
  },

  InspectBlock: (p) => {
    const items = arr(p.items)
    const text = [str(p.title), ...labelsOf(items)].filter(Boolean).join('\n')
    return one('check', text, { photoRequired: items.some((x) => rec(x).requirePhoto === true) })
  },

  DecisionBlock: (p) => {
    const q = str(p.question)
    const opts = arr(p.options)
      .map((o) => {
        const label = str(rec(o).label)
        return label ? `If ${label}${rec(o).isEscalation === true ? ' (escalate)' : ''}` : ''
      })
      .filter(Boolean)
    return one('check', [q, ...opts].filter(Boolean).join('\n'))
  },

  SignOffBlock: (p) => {
    const title = str(p.title) || 'Supervisor sign-off'
    const ack = str(p.acknowledgementText)
    return one('check', `${title}${ack ? `: ${ack}` : ''} (needs ${str(p.requiredRole) || 'supervisor'})`)
  },

  CalloutBlock: (p, section) => {
    const body = str(p.body)
    const role = calloutRole(p)
    if (role === 'warning' || role === 'caution') {
      const label = role === 'warning' ? 'Warning' : 'Caution'
      return body ? one('hazard', `${label}: ${body}`) : { steps: [], unreadable: `${label} callout has no text` }
    }
    if (role === 'tip') return body ? one('step', `Tip: ${body}`) : empty()
    const title = str(p.title)
    return body ? one(sectionDefaultKind(section), title ? `${title}: ${body}` : body) : empty()
  },

  TextBlock: (p, section) => one(sectionDefaultKind(section), str(p.content)),
  HeadingBlock: (p) => one('step', str(p.text)),

  ZoneBlock: (p) => {
    const label = str(p.label)
    if (!label) return empty()
    const type = str(p.zoneType)
    return one('step', `${label}${type ? ` (${type})` : ''}${str(p.notes) ? `. ${str(p.notes)}` : ''}`)
  },

  EscalateBlock: (p) => {
    const title = str(p.title)
    return one('step', `${title}${str(p.reason) ? `: ${str(p.reason)}` : ''}`)
  },

  ModelBlock: (p) => {
    const labels = labelsOf(arr(p.hotspots))
    return one('step', labels.length ? `3D model: ${labels.join(', ')}` : '3D model')
  },

  PhotoBlock: (p) => {
    const path = rawPath(p.src)
    return one('step', str(p.caption) || str(p.alt) || 'Take a photo', {
      photoRequired: true,
      imagePaths: path ? [path] : [],
    })
  },

  PhotoGridBlock: (p) => {
    const items = arr(p.items)
    return one('step', captionsOf(items).join('; ') || 'Take photos', {
      photoRequired: true,
      imagePaths: items.map((x) => rawPath(rec(x).src)).filter((s): s is string => !!s),
    })
  },

  VisualBlock: (p) => {
    const items = arr(p.items)
    if (items.length === 0) return empty()
    const media = items.filter((x) => rec(x).medium !== 'video')
    if (media.length === 0) return { steps: [], dropped: 'video' }
    // ponytail: a mixed block keeps its photo/diagram items; the dropped video count is reported
    // only for all-video blocks. Add a per-item count if mixed blocks ever show up in production.
    const paths = media.map((x) => rawPath(rec(x).bakedSrc) ?? rawPath(rec(x).src)).filter((s): s is string => !!s)
    return one('step', captionsOf(media).join('; ') || 'Take a photo', { photoRequired: true, imagePaths: paths })
  },

  VoiceNoteBlock: () => ({ steps: [], dropped: 'voice' }),
}

/** The block types this converter handles; the spec asserts parity with BLOCK_COMPONENTS. */
export const HANDLED_TYPES: string[] = Object.keys(READERS)

export function readItem(item: unknown, section: Section): ReadResult {
  const it = rec(item) as Item
  const type = typeof it.type === 'string' ? it.type : ''
  const reader = READERS[type]
  if (!reader) return { steps: [], unreadable: type ? `unknown type ${type}` : 'item without a type' }
  return reader(rec(it.props), section)
}

// ---------------------------------------------------------------- convertSop

type StepRow = Section['sop_steps'][number]
type Slot = { d: FocusStepDraft; stepItem: boolean }

const sortedRows = (s: Section): StepRow[] =>
  [...(s.sop_steps ?? [])].sort((a, b) => a.step_number - b.step_number || a.id.localeCompare(b.id))

const NEW_COUNTS = (): SourceCounts => ({
  hazardSources: 0,
  ppeSources: 0,
  ppeItems: [],
  byType: {},
  tipsFolded: 0,
  voiceDropped: 0,
  videoDropped: 0,
  emptyDropped: 0,
  images: 0,
  imagesMatched: 0,
  missingIds: 0,
  unreadable: [],
})

export function convertSop(input: { sopId: string; sections: Section[]; sopImagePaths: string[] }): SopConversion {
  const before = NEW_COUNTS()
  const known = new Set(input.sopImagePaths)
  const steps: FocusStepDraft[] = []
  let layoutSections = 0
  let rowSections = 0

  const sections = [...input.sections].sort((a, b) => a.sort_order - b.sort_order)
  for (const section of sections) {
    const layout = (section.layout_data as { content?: unknown } | null)?.content
    const slots = Array.isArray(layout) ? fromLayout(section, layout, before) : fromRows(section, before)
    applyToolsAndTime(slots, sortedRows(section))
    slots.forEach((s, i) => {
      s.d.sortOrder = i
      steps.push(s.d)
    })
    if (slots.length && Array.isArray(layout)) layoutSections++
    else if (slots.length) rowSections++
  }

  for (const s of steps) {
    before.images += s.imagePaths.length
    before.imagesMatched += s.imagePaths.filter((p) => known.has(p)).length
  }

  const after: AfterCounts = { hazard: 0, ppe: 0, step: 0, check: 0, photoRequired: 0, imagePaths: 0 }
  for (const s of steps) {
    after[s.kind]++
    if (s.photoRequired) after.photoRequired++
    after.imagePaths += s.imagePaths.length
  }

  return {
    sopId: input.sopId,
    source: layoutSections && rowSections ? 'mixed' : layoutSections ? 'layout' : rowSections ? 'rows' : 'empty',
    steps,
    before,
    after,
    gate: checkGate(before, after, steps),
    hash: conversionHash(sections),
  }
}

function fromLayout(section: Section, content: unknown[], before: SourceCounts): Slot[] {
  const out: Slot[] = []
  const used = new Set<string>()
  let stepIdx: number | null = null // index in `out` of the step a following Warning/Caution/Tip belongs to

  content.forEach((raw, index) => {
    const item = rec(raw) as Item
    const type = typeof item.type === 'string' ? item.type : ''
    const p = rec(item.props)
    before.byType[type || '(none)'] = (before.byType[type || '(none)'] ?? 0) + 1

    // Stable key: the item's own props.id; duplicates get #2, #3; a missing id falls back to position.
    let key = str(p.id)
    if (!key) {
      key = `pos:${section.id}:${index}`
      before.missingIds++
    } else if (used.has(key)) {
      let n = 2
      while (used.has(`${key}#${n}`)) n++
      key = `${key}#${n}`
      before.missingIds++
    }
    used.add(key)

    const role = type === 'CalloutBlock' ? calloutRole(p) : 'other'
    if (type === 'HazardCardBlock' || role === 'warning' || role === 'caution') before.hazardSources++
    if (type === 'StepBlock' && str(p.warning)) before.hazardSources++
    if (type === 'PPECardBlock') {
      before.ppeSources++
      before.ppeItems.push(...ppeItemsOf(p))
    }

    // Tip after a step folds into that step; no row of its own.
    if (role === 'tip' && stepIdx !== null && str(p.body)) {
      const d = out[stepIdx].d
      d.tip = d.tip ? `${d.tip}\n${str(p.body)}` : str(p.body)
      before.tipsFolded++
      return
    }

    const r = readItem(item, section)
    if (r.unreadable) before.unreadable.push(`Section "${section.title}": ${r.unreadable}`)
    if (r.dropped === 'voice') before.voiceDropped++
    else if (r.dropped === 'video') before.videoDropped++
    else if (r.dropped === 'empty') before.emptyDropped++

    const made: Slot[] = r.steps.map((s) => ({
      d: { ...s, sectionId: section.id, sortOrder: 0, sourceKey: `${key}${s.sourceKey}` },
      stepItem: s.kind === 'step' && (type === 'StepBlock' || type === 'StepWithPhotosBlock'),
    }))

    if ((role === 'warning' || role === 'caution') && stepIdx !== null && made.length) {
      // D-03: the hazard goes immediately BEFORE the step it follows; that step shifts down.
      out.splice(stepIdx, 0, ...made)
      stepIdx += made.length
      return
    }

    out.push(...made)
    if (role !== 'other' || type === 'CalloutBlock') return // any callout leaves the tracker alone
    stepIdx = made.some((m) => m.stepItem) ? out.length - 1 : null
  })
  return out
}

function fromRows(section: Section, before: SourceCounts): Slot[] {
  const out: Slot[] = []
  // Rows carry their own tools/time, so these slots never take part in the layout zip.
  const push = (d: Partial<FocusStepDraft> & Pick<FocusStepDraft, 'kind' | 'text' | 'sourceKey'>) =>
    out.push({
      d: {
        sectionId: section.id,
        tip: null,
        photoRequired: false,
        imagePaths: [],
        requiredTools: null,
        timeEstimateMinutes: null,
        sortOrder: 0,
        ...d,
      },
      stepItem: false,
    })
  const rows = sortedRows(section)

  if (rows.length) {
    before.byType['row:step'] = (before.byType['row:step'] ?? 0) + rows.length
    for (const row of rows) {
      const warning = str(row.warning)
      const caution = str(row.caution)
      if (warning) {
        before.hazardSources++
        push({ kind: 'hazard', text: `Warning: ${warning}`, sourceKey: `row:${row.id}:warning` })
      }
      if (caution) {
        before.hazardSources++
        push({ kind: 'hazard', text: `Caution: ${caution}`, sourceKey: `row:${row.id}:caution` })
      }
      if (str(row.text)) {
        push(
          {
            kind: 'step',
            text: str(row.text),
            tip: str(row.tip) || null,
            photoRequired: row.photo_required === true,
            imagePaths: (section.sop_images ?? []).filter((i) => i.step_id === row.id).map((i) => i.storage_path),
            requiredTools: (row.required_tools ?? []).length ? row.required_tools : null,
            timeEstimateMinutes: row.time_estimate_minutes == null ? null : Number(row.time_estimate_minutes),
            sourceKey: `row:${row.id}`,
          },
        )
      } else before.emptyDropped++
    }
    return out
  }

  const lines = (section.content ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return out
  before.byType['row:content'] = (before.byType['row:content'] ?? 0) + 1
  if (isHazardSection(section)) {
    before.hazardSources += lines.length
    lines.forEach((l, i) => push({ kind: 'hazard', text: l, sourceKey: `row:${section.id}:content:${i}` }))
  } else if (isPpeSection(section)) {
    before.ppeSources++
    before.ppeItems.push(...lines)
    push({ kind: 'ppe', text: lines.join('\n'), sourceKey: `row:${section.id}:content` })
  } else push({ kind: 'step', text: lines.join('\n'), sourceKey: `row:${section.id}:content` })
  return out
}

/**
 * Tools and time live only on sop_steps rows (A5). Zip by ARRAY INDEX when the
 * step-type drafts and rows line up; never by step_number (CLAUDE.md 2026-06-26).
 * ponytail: when counts differ, the union of tools and the summed minutes go on
 * the first step-type draft. Per-step precision there needs a real mapping from
 * layout items to rows, which the data does not carry.
 */
function applyToolsAndTime(slots: Slot[], rows: StepRow[]) {
  const targets = slots.filter((s) => s.stepItem)
  if (!targets.length || !rows.length) return
  const tools = (r: StepRow) => (r.required_tools ?? []).map((t) => t.trim()).filter(Boolean)
  const mins = (r: StepRow) => (r.time_estimate_minutes == null ? null : Number(r.time_estimate_minutes))
  if (targets.length === rows.length) {
    targets.forEach((t, i) => {
      t.d.requiredTools = tools(rows[i]).length ? tools(rows[i]) : null
      t.d.timeEstimateMinutes = mins(rows[i])
    })
    return
  }
  const union = [...new Set(rows.flatMap(tools))]
  const withTime = rows.map(mins).filter((m): m is number => m !== null)
  targets[0].d.requiredTools = union.length ? union : null
  targets[0].d.timeEstimateMinutes = withTime.length ? withTime.reduce((a, b) => a + b, 0) : null
}

// ---------------------------------------------------------------- gate

/** SOP-01's hard gate: nothing hazard or PPE may be lost. */
export function checkGate(
  before: SourceCounts,
  after: AfterCounts,
  steps: Array<Pick<FocusStepDraft, 'kind' | 'text'>>,
): { ok: boolean; failures: string[] } {
  const failures = before.unreadable.map((u) => `${u}.`)
  if (after.hazard < before.hazardSources) {
    failures.push(`Only ${after.hazard} hazard steps came out of ${before.hazardSources} hazard sources.`)
  }
  if (after.ppe < before.ppeSources) {
    failures.push(`Only ${after.ppe} PPE steps came out of ${before.ppeSources} PPE cards.`)
  }
  const ppeText = steps.filter((s) => s.kind === 'ppe').map((s) => s.text).join('\n')
  for (const item of before.ppeItems) {
    if (!ppeText.includes(item)) failures.push(`PPE item "${item}" is missing from the converted PPE steps.`)
  }
  return { ok: failures.length === 0, failures }
}

// ---------------------------------------------------------------- hash + plan

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** Everything the converter reads, so a builder edit (or a converter bump) changes the hash. */
export function conversionHash(sections: Section[]): string {
  const body = {
    v: CONVERTER_VERSION,
    sections: [...sections]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id,
        section_type: s.section_type,
        title: s.title,
        render_family: s.section_kind?.render_family ?? null,
        layout_data: s.layout_data ?? null,
        content: s.content ?? null,
        steps: sortedRows(s).map((r) => ({
          id: r.id,
          text: r.text,
          warning: r.warning,
          caution: r.caution,
          tip: r.tip,
          photo_required: r.photo_required ?? false,
          required_tools: r.required_tools,
          time_estimate_minutes: r.time_estimate_minutes,
        })),
      })),
  }
  return createHash('sha256').update(stable(body)).digest('hex')
}

export interface ExistingFocusStep {
  id: string
  section_id: string
  source_key: string
  kind: string
  text: string
  tip: string | null
  photo_required: boolean
  image_paths: string[] | null
  required_tools: string[] | null
  time_estimate_minutes: number | null
  sort_order: number
}

/**
 * Re-run diff keyed by (section_id, source_key): unchanged rows are left alone
 * (so a standard attached to one survives), changed rows are updated in place
 * (existing id kept), keys no longer produced are deleted, new keys inserted.
 */
export function planFocusStepWrites(desired: FocusStepDraft[], existing: ExistingFocusStep[]) {
  const k = (section: string, key: string) => `${section}|${key}`
  const have = new Map(existing.map((e) => [k(e.section_id, e.source_key), e]))
  const upserts: Array<FocusStepDraft & { id?: string }> = []
  let unchanged = 0
  const wanted = new Set<string>()

  for (const d of desired) {
    const key = k(d.sectionId, d.sourceKey)
    wanted.add(key)
    const e = have.get(key)
    if (!e) {
      upserts.push(d)
      continue
    }
    const same =
      e.kind === d.kind &&
      e.text === d.text &&
      (e.tip ?? null) === d.tip &&
      e.photo_required === d.photoRequired &&
      stable(e.image_paths ?? []) === stable(d.imagePaths) &&
      stable(e.required_tools ?? null) === stable(d.requiredTools) &&
      (e.time_estimate_minutes == null ? null : Number(e.time_estimate_minutes)) === d.timeEstimateMinutes &&
      e.sort_order === d.sortOrder
    if (same) unchanged++
    else upserts.push({ ...d, id: e.id })
  }

  const deleteIds = existing.filter((e) => !wanted.has(k(e.section_id, e.source_key))).map((e) => e.id)
  return { upserts, deleteIds, unchanged }
}
