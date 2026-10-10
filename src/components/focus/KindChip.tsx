import { kindLabel, type FocusKind } from '@/lib/sop/focus'

/**
 * Colour is for safety (design base 2026-10-10, ADR-0007): hazard and PPE carry their
 * accent; an ordinary step or check is ink. No coloured left edges anywhere.
 */
export const KIND_CHIP: Record<FocusKind, string> = {
  hazard: 'text-accent-hazard bg-accent-hazard/10',
  ppe: 'text-accent-decision bg-accent-decision/10',
  step: 'border border-ink-300 text-ink-700',
  check: 'border border-ink-300 text-ink-700',
}

export const KIND_DOT: Record<FocusKind, string> = {
  hazard: 'bg-accent-hazard',
  ppe: 'bg-accent-decision',
  step: 'bg-ink-300',
  check: 'bg-ink-700',
}

/** Hollow dot: the kind's border colour, no fill. */
export const KIND_RING: Record<FocusKind, string> = {
  hazard: 'border-accent-hazard',
  ppe: 'border-accent-decision',
  step: 'border-ink-300',
  check: 'border-ink-700',
}

/** Only hazard and PPE need a tag where the step is read; an ordinary step is just the step. */
export const isSignal = (kind: FocusKind) => kind === 'hazard' || kind === 'ppe'

export function KindChip({ kind }: { kind: FocusKind }) {
  return (
    <span data-testid="focus-kind-chip" data-kind={kind} className={`mono rounded px-2 py-1 text-meta uppercase ${KIND_CHIP[kind]}`}>
      {kindLabel(kind)}
    </span>
  )
}
