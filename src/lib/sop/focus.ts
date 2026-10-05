/**
 * Phase 58 -- the one place that answers "in what order does a worker walk
 * this SOP, what can they open, what is still missing, what do we call it".
 *
 * Plain module: no directive, no React, no Supabase. Two private copies of the
 * hazard/PPE classifier drifted apart on 2026-09-27; the walk, the rail, the
 * review screen and the server hash all import this instead.
 *
 * Kinds come from the focus step row (`kind`), never re-derived from text.
 * `step_number` is section-scoped and is never shown as a global number: the
 * walk index (1-based position in walk order) is the only global number, and
 * the rail numbers within a section.
 */

export type FocusKind = 'hazard' | 'ppe' | 'step' | 'check'

export interface FocusStepLike {
  id: string
  section_id: string
  kind: FocusKind
  text: string
  photo_required: boolean
  sort_order: number
}

export interface FocusSectionLike {
  id: string
  title: string
  sort_order: number
}

export interface WalkEntry<S extends FocusStepLike = FocusStepLike> {
  step: S
  /** "Before you start" for hazard/PPE, otherwise the section title. */
  groupLabel: string
  /** 1-based position in walk order ("Step n of N"). */
  index: number
  sectionTitle: string
  /** 1-based position inside its own section (source order). */
  sectionPos: number
}

export const BEFORE_YOU_START = 'Before you start'

const byOrder = <T extends { id: string; sort_order: number }>(a: T, b: T) =>
  a.sort_order - b.sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const isBefore = (kind: FocusKind) => kind === 'hazard' || kind === 'ppe'

/** D-07: every hazard and PPE step first (source order), then every section's remaining steps in sequence. */
export function walkOrder<S extends FocusStepLike>(
  sections: readonly FocusSectionLike[],
  steps: readonly S[],
): WalkEntry<S>[] {
  const flat: Omit<WalkEntry<S>, 'index'>[] = []
  for (const section of [...sections].sort(byOrder)) {
    const own = steps.filter((s) => s.section_id === section.id).sort(byOrder)
    own.forEach((step, i) =>
      flat.push({
        step,
        groupLabel: isBefore(step.kind) ? BEFORE_YOU_START : section.title,
        sectionTitle: section.title,
        sectionPos: i + 1,
      }),
    )
  }
  const ordered = [...flat.filter((e) => isBefore(e.step.kind)), ...flat.filter((e) => !isBefore(e.step.kind))]
  return ordered.map((e, i) => ({ ...e, index: i + 1 }))
}

/** Index (0-based into `order`) of the first step not yet done; order.length when all are done. */
export function currentIndex(order: readonly WalkEntry[], done: ReadonlySet<string>): number {
  const i = order.findIndex((e) => !done.has(e.step.id))
  return i === -1 ? order.length : i
}

/** D-08: done steps and the current step by default; every step when the SOP allows jumping ahead. */
export function isReachable(
  order: readonly WalkEntry[],
  stepId: string,
  done: ReadonlySet<string>,
  allowForward = false,
): boolean {
  if (allowForward) return order.some((e) => e.step.id === stepId)
  const at = order.findIndex((e) => e.step.id === stepId)
  return at !== -1 && at <= currentIndex(order, done)
}

export interface ReviewState {
  /** Hazard/PPE step ids the worker acknowledged. */
  acked: ReadonlySet<string>
  /** Step ids that have a photo. */
  photos: ReadonlySet<string>
}

/** D-10: every missing hazard/PPE acknowledgement and required photo, always, whatever the jump-ahead setting. */
export function reviewMissing(
  order: readonly WalkEntry[],
  { acked, photos }: ReviewState,
): { stepId: string; index: number; text: string }[] {
  const out: { stepId: string; index: number; text: string }[] = []
  for (const { step, index } of order) {
    if (step.kind === 'hazard' && !acked.has(step.id)) {
      out.push({ stepId: step.id, index, text: `acknowledge the hazard on step ${index}` })
    } else if (step.kind === 'ppe' && !acked.has(step.id)) {
      out.push({ stepId: step.id, index, text: `confirm the PPE on step ${index}` })
    }
    if (step.photo_required && !photos.has(step.id)) {
      out.push({ stepId: step.id, index, text: `take the photo on step ${index}` })
    }
  }
  return out
}

const KIND_LABEL: Record<FocusKind, string> = { hazard: 'Hazard', ppe: 'PPE', step: 'Step', check: 'Check' }

export const kindLabel = (kind: FocusKind): string => KIND_LABEL[kind]

const PRIMARY: Record<FocusKind, string> = {
  hazard: 'I understand — continue',
  ppe: "I'm wearing it — continue",
  step: 'Done — next step',
  check: 'Confirmed — next step',
}

export const primaryLabel = (kind: FocusKind, isLast: boolean): string => (isLast ? 'Done — review' : PRIMARY[kind])

/** Rail label numbered within the section, e.g. "Mirror Cleaning · 3". */
export const railNumber = (e: Pick<WalkEntry, 'sectionTitle' | 'sectionPos'>): string =>
  `${e.sectionTitle} · ${e.sectionPos}`

/** The canonical string the server hashes for the walk: id, kind, text in walk order. */
export const hashInput = (order: readonly WalkEntry[]): string =>
  JSON.stringify(order.map(({ step }) => ({ id: step.id, kind: step.kind, text: step.text })))
