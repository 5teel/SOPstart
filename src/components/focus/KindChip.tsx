import { kindLabel, type FocusKind } from '@/lib/sop/focus'

/**
 * Colour is for safety (ADR-0007), in the AS 1319 sign colours and shapes (ADR-0013):
 * a hazard is a warning sign (yellow, black triangle), PPE a mandatory sign (blue circle).
 * An ordinary step or check is ink. No coloured left edges anywhere.
 */
export const KIND_CHIP: Record<FocusKind, string> = {
  hazard: 'bg-sign-warning text-ink-900',
  ppe: 'bg-sign-mandatory text-paper',
  step: 'border border-ink-300 text-ink-700',
  check: 'border border-ink-300 text-ink-700',
}

/** The rail mark, sized and shaped here: the sign shape for hazard and PPE, a plain dot otherwise. */
export const KIND_DOT: Record<FocusKind, string> = {
  hazard: 'sign-triangle',
  ppe: 'size-2.5 shrink-0 rounded-full bg-sign-mandatory',
  step: 'size-2 shrink-0 rounded-full bg-ink-300',
  check: 'size-2 shrink-0 rounded-full bg-ink-700',
}

const GLYPH: Partial<Record<FocusKind, string>> = { hazard: '▲', ppe: '●' }

/** Only hazard and PPE need a tag where the step is read; an ordinary step is just the step. */
export const isSignal = (kind: FocusKind) => kind === 'hazard' || kind === 'ppe'

export function KindChip({ kind }: { kind: FocusKind }) {
  return (
    <span data-testid="focus-kind-chip" data-kind={kind} className={`mono inline-flex items-center gap-1 rounded px-2 py-1 text-meta uppercase ${KIND_CHIP[kind]}`}>
      {GLYPH[kind] && <span aria-hidden="true">{GLYPH[kind]}</span>}
      {kindLabel(kind)}
    </span>
  )
}
